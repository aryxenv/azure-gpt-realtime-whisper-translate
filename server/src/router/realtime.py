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
    discard_pending_sequence,
    get_auth_headers,
    get_azure_openai_host,
    get_required_env,
    mark_item_finalized,
    mark_pending_item_finalization,
    normalize_error_event,
    proxy_realtime_events,
    send_client_event,
)

router = APIRouter(prefix="/realtime", tags=["realtime"])
logger = logging.getLogger(__name__)

DEFAULT_TRANSLATION_MODEL = "gpt-realtime-translate"
DEFAULT_TRANSLATION_INPUT_TRANSCRIPTION_MODEL = "gpt-realtime-whisper"
DEFAULT_TRANSLATION_LANGUAGE = "nl"
DEFAULT_WHISPER_COMMIT_STRATEGY = "none"
SUPPORTED_TRANSCRIPTION_DELAYS = {"minimal", "low", "medium", "high", "xhigh"}
SUPPORTED_WHISPER_COMMIT_STRATEGIES = {"fixed", "none", "silence"}
SUPPORTED_TRANSLATION_LANGUAGES = {
    "nl": "Dutch",
    "en": "English",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "it": "Italian",
    "pt": "Portuguese",
}
TRANSLATION_UPSTREAM_PROTOCOL = RealtimeUpstreamProtocol(
    audio_append_event_type="session.input_audio_buffer.append",
    session_close_event_type="session.close",
    close_session_before_drain=True,
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


def get_whisper_commit_strategy() -> str:
    strategy = os.getenv(
        "AZURE_OPENAI_REALTIME_COMMIT_STRATEGY",
        DEFAULT_WHISPER_COMMIT_STRATEGY,
    ).strip().lower()
    if strategy not in SUPPORTED_WHISPER_COMMIT_STRATEGIES:
        supported = ", ".join(sorted(SUPPORTED_WHISPER_COMMIT_STRATEGIES))
        raise ValueError(
            "AZURE_OPENAI_REALTIME_COMMIT_STRATEGY must be one of: "
            f"{supported}."
        )

    return strategy


def get_transcription_delay() -> str | None:
    value = os.getenv("AZURE_OPENAI_REALTIME_TRANSCRIPTION_DELAY")
    if not value:
        return None

    delay = value.strip().lower()
    if delay not in SUPPORTED_TRANSCRIPTION_DELAYS:
        supported = ", ".join(sorted(SUPPORTED_TRANSCRIPTION_DELAYS))
        raise ValueError(
            "AZURE_OPENAI_REALTIME_TRANSCRIPTION_DELAY must be one of: "
            f"{supported}."
        )

    return delay


def build_whisper_upstream_protocol() -> RealtimeUpstreamProtocol:
    commit_strategy = get_whisper_commit_strategy()
    return RealtimeUpstreamProtocol(
        audio_append_event_type="input_audio_buffer.append",
        audio_commit_event_type="input_audio_buffer.commit",
        commit_strategy=commit_strategy,
        filter_low_energy_audio=commit_strategy != "none",
        force_commit_on_stop=True,
        wait_for_pending_finalizations_on_stop=True,
    )


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
    transcription_delay = get_transcription_delay()
    if transcription_delay:
        transcription["delay"] = transcription_delay

    return {
        "type": "session.update",
        "session": {
            "type": "transcription",
            "audio": {
                "input": {
                    "format": {"type": "audio/pcm", "rate": PCM_SAMPLE_RATE},
                    "transcription": transcription,
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
    if not item_id:
        return None

    sequence = state.item_sequences.get(item_id)
    if sequence is None:
        if state.pending_sequences:
            sequence = state.pending_sequences.popleft()
        else:
            sequence = state.next_sequence
            state.next_sequence += 1
        state.item_sequences[item_id] = sequence
    mark_pending_item_finalization(state, item_id)
    return {
        "type": "audio.committed",
        "itemId": item_id,
        "sequence": sequence,
    }


def get_text_delta(event: dict[str, Any]) -> str:
    for field_name in ("delta", "text", "transcript"):
        value = event.get(field_name)
        if isinstance(value, str):
            return value

    return ""


def normalize_transcription_delta(
    state: RealtimeProxyState,
    event: dict[str, Any],
) -> dict[str, Any]:
    item_id = event.get("item_id")
    normalized: dict[str, Any] = {
        "type": "transcript.delta",
        "delta": get_text_delta(event),
    }

    if item_id:
        normalized["itemId"] = item_id
        normalized["contentIndex"] = event.get("content_index")

    if item_id in state.item_sequences:
        normalized["sequence"] = state.item_sequences[item_id]

    return normalized


def normalize_transcription_completed(
    state: RealtimeProxyState,
    event: dict[str, Any],
) -> dict[str, Any]:
    item_id = event.get("item_id")
    mark_item_finalized(state, item_id)
    normalized: dict[str, Any] = {
        "type": "transcript.completed",
        "transcript": get_text_delta(event),
    }

    if item_id:
        normalized["itemId"] = item_id
        normalized["contentIndex"] = event.get("content_index")

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

    if event_type == "session.input_transcript.delta":
        return {
            "type": "transcript.delta",
            "delta": get_text_delta(event),
        }

    if event_type in {"session.input_transcript.completed", "session.input_transcript.done"}:
        return {
            "type": "transcript.completed",
            "transcript": get_text_delta(event),
        }

    if event_type == "conversation.item.input_audio_transcription.failed":
        mark_item_finalized(state, event.get("item_id"))
        return normalize_error_event(event)

    if event_type == "error":
        normalized = normalize_error_event(event)
        if normalized.get("status") == "commit_skipped":
            discard_pending_sequence(state)
        return normalized

    if event_type in {"session.created", "session.updated"}:
        return {"type": "status", "status": event_type}

    return None


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
            await close_if_connected(
                websocket,
                status.WS_1000_NORMAL_CLOSURE,
                "Realtime session ended.",
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
        protocol = build_whisper_upstream_protocol()
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
        protocol=protocol,
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
