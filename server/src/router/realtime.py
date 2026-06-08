import json
import logging
import os
from typing import Any
from urllib.parse import quote

from azure.core.exceptions import AzureError
from azure.identity.aio import DefaultAzureCredential
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from websockets.asyncio.client import connect
from websockets.exceptions import WebSocketException

from src.utils.realtime import (
    PCM_SAMPLE_RATE,
    RealtimeEventNormalizer,
    RealtimeProxyState,
    RealtimeUpstreamProtocol,
    close_if_connected,
    get_auth_headers,
    get_azure_openai_host,
    get_required_env,
    normalize_error_event,
    proxy_realtime_events,
    send_client_event,
)

router = APIRouter(prefix="/realtime", tags=["realtime"])
logger = logging.getLogger(__name__)

DEFAULT_TRANSLATION_MODEL = "gpt-realtime-translate"
DEFAULT_TRANSLATION_INPUT_TRANSCRIPTION_MODEL = "gpt-realtime-whisper"
DEFAULT_TRANSLATION_LANGUAGE = "nl"
SUPPORTED_TRANSLATION_LANGUAGES = {
    "nl": "Dutch",
    "en": "English",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "it": "Italian",
    "pt": "Portuguese",
}
WHISPER_UPSTREAM_PROTOCOL = RealtimeUpstreamProtocol(
    audio_append_event_type="input_audio_buffer.append",
    audio_commit_event_type="input_audio_buffer.commit",
    auto_commit_audio=True,
)
TRANSLATION_UPSTREAM_PROTOCOL = RealtimeUpstreamProtocol(
    audio_append_event_type="session.input_audio_buffer.append",
    session_close_event_type="session.close",
)


def get_language_hint() -> str | None:
    value = os.getenv("AZURE_OPENAI_REALTIME_LANGUAGE_HINT")
    if not value:
        return None

    language = value.strip()
    if "," in language:
        raise ValueError(
            "AZURE_OPENAI_REALTIME_LANGUAGE_HINT must be one language code, "
            "for example 'de'. Leave it empty for automatic language detection."
        )

    return language


def get_optional_model_env(name: str, default: str) -> str:
    value = os.getenv(name, default).strip()
    if not value:
        raise ValueError(f"{name} must not be empty.")

    return value


def build_whisper_realtime_url() -> str:
    return f"wss://{get_azure_openai_host()}/openai/v1/realtime?intent=transcription"


def build_translation_realtime_url() -> str:
    model = get_optional_model_env(
        "AZURE_OPENAI_REALTIME_TRANSLATION_MODEL",
        DEFAULT_TRANSLATION_MODEL,
    )
    return (
        f"wss://{get_azure_openai_host()}/openai/v1/realtime/translations"
        f"?model={quote(model, safe='')}"
    )


def build_whisper_session_update() -> dict[str, Any]:
    model = get_required_env("AZURE_OPENAI_REALTIME_DEPLOYMENT")
    transcription: dict[str, Any] = {"model": model}
    language_hint = get_language_hint()
    if language_hint:
        transcription["language"] = language_hint

    return {
        "type": "session.update",
        "session": {
            "type": "transcription",
            "audio": {
                "input": {
                    "format": {"type": "audio/pcm", "rate": PCM_SAMPLE_RATE},
                    "transcription": transcription,
                    "turn_detection": None,
                }
            },
        },
    }


def get_translation_target_language(websocket: WebSocket) -> str:
    value = (
        websocket.query_params.get("targetLanguage")
        or websocket.query_params.get("language")
        or DEFAULT_TRANSLATION_LANGUAGE
    )
    language = value.strip().lower()
    if language not in SUPPORTED_TRANSLATION_LANGUAGES:
        supported = ", ".join(sorted(SUPPORTED_TRANSLATION_LANGUAGES))
        raise ValueError(
            f"Unsupported translation target language '{value}'. "
            f"Supported languages: {supported}."
        )

    return language


def build_translation_session_update(target_language: str) -> dict[str, Any]:
    input_model = get_optional_model_env(
        "AZURE_OPENAI_REALTIME_TRANSLATION_INPUT_TRANSCRIPTION_MODEL",
        DEFAULT_TRANSLATION_INPUT_TRANSCRIPTION_MODEL,
    )

    return {
        "type": "session.update",
        "session": {
            "audio": {
                "input": {
                    "transcription": {
                        "model": input_model,
                    },
                },
                "output": {
                    "language": target_language,
                },
            },
        },
    }


def assign_item_sequence(
    state: RealtimeProxyState,
    event: dict[str, Any],
) -> dict[str, Any] | None:
    item_id = event.get("item_id")
    if not item_id or not state.pending_sequences:
        return None

    sequence = state.pending_sequences.popleft()
    state.item_sequences[item_id] = sequence
    return {
        "type": "audio.committed",
        "itemId": item_id,
        "sequence": sequence,
    }


def normalize_transcription_delta(
    state: RealtimeProxyState,
    event: dict[str, Any],
) -> dict[str, Any]:
    item_id = event.get("item_id")
    normalized: dict[str, Any] = {
        "type": "transcript.delta",
        "itemId": item_id,
        "contentIndex": event.get("content_index"),
        "delta": event.get("delta", ""),
    }

    if item_id in state.item_sequences:
        normalized["sequence"] = state.item_sequences[item_id]

    return normalized


def normalize_transcription_completed(
    state: RealtimeProxyState,
    event: dict[str, Any],
) -> dict[str, Any]:
    item_id = event.get("item_id")
    normalized: dict[str, Any] = {
        "type": "transcript.completed",
        "itemId": item_id,
        "contentIndex": event.get("content_index"),
        "transcript": event.get("transcript", ""),
    }

    if item_id in state.item_sequences:
        normalized["sequence"] = state.item_sequences[item_id]

    return normalized


def normalize_whisper_event(
    state: RealtimeProxyState,
    event: dict[str, Any],
) -> dict[str, Any] | None:
    event_type = event.get("type")

    if event_type == "input_audio_buffer.committed":
        return assign_item_sequence(state, event)

    if event_type == "conversation.item.input_audio_transcription.delta":
        return normalize_transcription_delta(state, event)

    if event_type == "conversation.item.input_audio_transcription.completed":
        return normalize_transcription_completed(state, event)

    if event_type == "conversation.item.input_audio_transcription.failed":
        return normalize_error_event(event)

    if event_type == "error":
        return normalize_error_event(event)

    if event_type in {"session.created", "session.updated"}:
        return {"type": "status", "status": event_type}

    return None


def get_text_delta(event: dict[str, Any]) -> str:
    for field_name in ("delta", "text", "transcript"):
        value = event.get(field_name)
        if isinstance(value, str):
            return value

    return ""


def normalize_translation_event(
    _state: RealtimeProxyState,
    event: dict[str, Any],
) -> dict[str, Any] | None:
    event_type = event.get("type")

    if event_type == "session.input_transcript.delta":
        return {
            "type": "transcript.delta",
            "delta": get_text_delta(event),
        }

    if event_type == "session.output_transcript.delta":
        return {
            "type": "translation.delta",
            "delta": get_text_delta(event),
        }

    if event_type in {"session.input_transcript.completed", "session.input_transcript.done"}:
        return {
            "type": "transcript.completed",
            "transcript": get_text_delta(event),
        }

    if event_type in {
        "session.output_transcript.completed",
        "session.output_transcript.done",
    }:
        return {
            "type": "translation.completed",
            "translation": get_text_delta(event),
        }

    if event_type == "session.output_audio.delta":
        return None

    if event_type == "error":
        return normalize_error_event(event)

    if event_type in {"session.created", "session.updated"}:
        return {"type": "status", "status": event_type}

    return None


async def run_realtime_proxy(
    websocket: WebSocket,
    realtime_url: str,
    session_update: dict[str, Any],
    normalize_event: RealtimeEventNormalizer,
    *,
    additional_headers: dict[str, str] | None = None,
    protocol: RealtimeUpstreamProtocol,
) -> None:
    credential = DefaultAzureCredential()
    try:
        auth_headers = await get_auth_headers(credential)
        headers = {**auth_headers, **(additional_headers or {})}
        async with connect(
            realtime_url,
            additional_headers=headers,
            max_size=None,
        ) as azure_realtime:
            await azure_realtime.send(json.dumps(session_update))
            await send_client_event(
                websocket,
                {
                    "type": "status",
                    "status": "connected",
                },
            )
            await proxy_realtime_events(
                websocket,
                azure_realtime,
                normalize_event,
                protocol=protocol,
            )
    except WebSocketDisconnect:
        return
    except AzureError:
        logger.exception("Failed to get Azure OpenAI realtime bearer token.")
        await close_if_connected(
            websocket,
            status.WS_1011_INTERNAL_ERROR,
            "Azure credential failed.",
        )
    except (OSError, WebSocketException):
        logger.exception("Azure OpenAI realtime websocket connection failed.")
        await close_if_connected(
            websocket,
            status.WS_1011_INTERNAL_ERROR,
            "Azure OpenAI realtime connection failed.",
        )
    finally:
        await credential.close()


@router.websocket("/whisper")
async def whisper(websocket: WebSocket) -> None:
    await websocket.accept()

    try:
        realtime_url = build_whisper_realtime_url()
        session_update = build_whisper_session_update()
    except ValueError as error:
        logger.warning("Invalid realtime configuration: %s", error)
        await close_if_connected(
            websocket,
            status.WS_1011_INTERNAL_ERROR,
            "Invalid Azure OpenAI realtime configuration.",
        )
        return

    await run_realtime_proxy(
        websocket,
        realtime_url,
        session_update,
        normalize_whisper_event,
        protocol=WHISPER_UPSTREAM_PROTOCOL,
    )


@router.websocket("/translation")
async def translation(websocket: WebSocket) -> None:
    await websocket.accept()

    try:
        target_language = get_translation_target_language(websocket)
    except ValueError as error:
        logger.warning("Invalid realtime translation language: %s", error)
        await close_if_connected(
            websocket,
            status.WS_1008_POLICY_VIOLATION,
            "Unsupported translation target language.",
        )
        return

    try:
        realtime_url = build_translation_realtime_url()
        session_update = build_translation_session_update(target_language)
    except ValueError as error:
        logger.warning("Invalid realtime translation configuration: %s", error)
        await close_if_connected(
            websocket,
            status.WS_1011_INTERNAL_ERROR,
            "Invalid Azure OpenAI realtime translation configuration.",
        )
        return

    await run_realtime_proxy(
        websocket,
        realtime_url,
        session_update,
        normalize_translation_event,
        additional_headers={"openai-alpha": "translation=v1"},
        protocol=TRANSLATION_UPSTREAM_PROTOCOL,
    )
