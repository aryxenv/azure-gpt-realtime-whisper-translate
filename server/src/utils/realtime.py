import asyncio
import base64
import json
import logging
import math
import os
import struct
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from json import JSONDecodeError
from typing import Any

from azure.identity.aio import DefaultAzureCredential
from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

DEFAULT_TOKEN_SCOPE = "https://cognitiveservices.azure.com/.default"
DEFAULT_COMMIT_INTERVAL_MS = 2000
DEFAULT_SILENCE_COMMIT_MS = 900
DEFAULT_MAX_COMMIT_AUDIO_MS = 12000
DEFAULT_MIN_COMMIT_AUDIO_MS = 500
DEFAULT_MIN_AUDIO_RMS = 0.01
DEFAULT_STOP_DRAIN_MS = 2200
PCM_SAMPLE_RATE = 24000
PCM_BYTES_PER_SAMPLE = 2

NormalizedRealtimeEvent = dict[str, Any] | list[dict[str, Any]] | None
RealtimeEventNormalizer = Callable[
    ["RealtimeProxyState", dict[str, Any]],
    NormalizedRealtimeEvent,
]


@dataclass
class RealtimeProxyState:
    commit_interval_seconds: float
    silence_commit_seconds: float
    max_commit_audio_bytes: int
    min_audio_rms: float
    min_commit_audio_bytes: int
    stop_drain_seconds: float
    uncommitted_audio_bytes: int = 0
    uncommitted_has_speech: bool = False
    silent_audio_seconds: float = 0
    next_sequence: int = 1
    pending_sequences: deque[int] = field(default_factory=deque)
    pending_item_ids: set[str] = field(default_factory=set)
    item_sequences: dict[str, int] = field(default_factory=dict)
    finalization_event: asyncio.Event = field(default_factory=asyncio.Event)
    session_closed_event: asyncio.Event = field(default_factory=asyncio.Event)
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


@dataclass(frozen=True)
class RealtimeUpstreamProtocol:
    audio_append_event_type: str
    audio_commit_event_type: str | None = None
    session_close_event_type: str | None = None
    commit_strategy: str = "none"
    filter_low_energy_audio: bool = True
    close_session_before_drain: bool = False
    force_commit_on_stop: bool = False
    wait_for_pending_finalizations_on_stop: bool = False
    wait_for_session_closed_on_stop: bool = False


def get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"{name} environment variable is not set.")
    return value


def get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        parsed = int(value)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer.") from error

    if parsed <= 0:
        raise ValueError(f"{name} must be greater than zero.")

    return parsed


def get_float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        parsed = float(value)
    except ValueError as error:
        raise ValueError(f"{name} must be a number.") from error

    if parsed < 0 or parsed > 1:
        raise ValueError(f"{name} must be between 0 and 1.")

    return parsed


def get_azure_openai_host() -> str:
    resource_name = get_required_env("AZURE_OPENAI_RESOURCE_NAME")
    return f"{resource_name}.openai.azure.com"


def build_proxy_state() -> RealtimeProxyState:
    min_commit_audio_ms = get_int_env(
        "AZURE_OPENAI_REALTIME_MIN_COMMIT_AUDIO_MS",
        DEFAULT_MIN_COMMIT_AUDIO_MS,
    )
    min_commit_audio_bytes = int(
        PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE * (min_commit_audio_ms / 1000)
    )

    max_commit_audio_ms = get_int_env(
        "AZURE_OPENAI_REALTIME_MAX_COMMIT_AUDIO_MS",
        DEFAULT_MAX_COMMIT_AUDIO_MS,
    )
    max_commit_audio_bytes = int(
        PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE * (max_commit_audio_ms / 1000)
    )

    return RealtimeProxyState(
        commit_interval_seconds=get_int_env(
            "AZURE_OPENAI_REALTIME_COMMIT_INTERVAL_MS",
            DEFAULT_COMMIT_INTERVAL_MS,
        )
        / 1000,
        silence_commit_seconds=get_int_env(
            "AZURE_OPENAI_REALTIME_SILENCE_COMMIT_MS",
            DEFAULT_SILENCE_COMMIT_MS,
        )
        / 1000,
        max_commit_audio_bytes=max_commit_audio_bytes,
        min_audio_rms=get_float_env(
            "AZURE_OPENAI_REALTIME_MIN_AUDIO_RMS",
            DEFAULT_MIN_AUDIO_RMS,
        ),
        min_commit_audio_bytes=min_commit_audio_bytes,
        stop_drain_seconds=get_int_env(
            "AZURE_OPENAI_REALTIME_STOP_DRAIN_MS",
            DEFAULT_STOP_DRAIN_MS,
        )
        / 1000,
    )


def get_audio_duration_seconds(audio_bytes: bytes) -> float:
    return len(audio_bytes) / (PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE)


async def get_auth_headers(credential: DefaultAzureCredential) -> dict[str, str]:
    token_scope = os.getenv("AZURE_OPENAI_TOKEN_SCOPE", DEFAULT_TOKEN_SCOPE)
    token = await credential.get_token(token_scope)
    return {"Authorization": f"Bearer {token.token}"}


def supports_audio_commit(protocol: RealtimeUpstreamProtocol) -> bool:
    return protocol.audio_commit_event_type is not None


async def close_if_connected(websocket: WebSocket, code: int, reason: str) -> None:
    if websocket.application_state == WebSocketState.CONNECTED:
        await websocket.close(code=code, reason=reason)


async def send_client_event(client: WebSocket, event: dict[str, Any]) -> None:
    if client.application_state == WebSocketState.CONNECTED:
        await client.send_text(json.dumps(event))


def get_pcm16_rms(audio_bytes: bytes) -> float:
    sample_count = len(audio_bytes) // PCM_BYTES_PER_SAMPLE
    if sample_count == 0:
        return 0

    samples = struct.unpack(
        f"<{sample_count}h",
        audio_bytes[: sample_count * PCM_BYTES_PER_SAMPLE],
    )
    square_sum = sum(sample * sample for sample in samples)
    return math.sqrt(square_sum / sample_count) / 32768


async def append_audio_chunk(
    azure_realtime: Any,
    state: RealtimeProxyState,
    audio_bytes: bytes,
    *,
    protocol: RealtimeUpstreamProtocol,
) -> bool:
    rms = get_pcm16_rms(audio_bytes)
    is_low_energy = rms < state.min_audio_rms
    if is_low_energy:
        state.silent_audio_seconds += get_audio_duration_seconds(audio_bytes)
        if supports_audio_commit(protocol) and not state.uncommitted_has_speech:
            logger.debug("Skipping leading low-energy audio chunk: rms=%.5f", rms)
            return False
        if protocol.filter_low_energy_audio:
            if (
                protocol.commit_strategy == "silence"
                and state.uncommitted_has_speech
                and state.uncommitted_audio_bytes >= state.min_commit_audio_bytes
                and state.silent_audio_seconds >= state.silence_commit_seconds
            ):
                await commit_audio_buffer(azure_realtime, state, protocol)
                state.silent_audio_seconds = 0
            logger.debug("Skipping low-energy audio chunk: rms=%.5f", rms)
            return False

    audio_event = {
        "type": protocol.audio_append_event_type,
        "audio": base64.b64encode(audio_bytes).decode("ascii"),
    }

    async with state.send_lock:
        await azure_realtime.send(json.dumps(audio_event))
        if supports_audio_commit(protocol):
            state.uncommitted_audio_bytes += len(audio_bytes)
            if not is_low_energy:
                state.uncommitted_has_speech = True
                state.silent_audio_seconds = 0
        logger.debug(
            "Appended audio chunk: bytes=%s rms=%.5f pending_bytes=%s",
            len(audio_bytes),
            rms,
            state.uncommitted_audio_bytes,
        )

    if (
        protocol.commit_strategy == "silence"
        and state.uncommitted_has_speech
        and state.silent_audio_seconds >= state.silence_commit_seconds
        and state.uncommitted_audio_bytes >= state.min_commit_audio_bytes
    ):
        await commit_audio_buffer(azure_realtime, state, protocol)
    elif (
        protocol.commit_strategy == "silence"
        and state.uncommitted_has_speech
        and state.uncommitted_audio_bytes >= state.max_commit_audio_bytes
    ):
        await commit_audio_buffer(azure_realtime, state, protocol)

    return True


async def commit_audio_buffer(
    azure_realtime: Any,
    state: RealtimeProxyState,
    protocol: RealtimeUpstreamProtocol,
    *,
    force: bool = False,
) -> bool:
    if not supports_audio_commit(protocol):
        return False

    async with state.send_lock:
        if (
            state.uncommitted_audio_bytes <= 0
            or not state.uncommitted_has_speech
            or (
                not force
                and state.uncommitted_audio_bytes < state.min_commit_audio_bytes
            )
        ):
            logger.debug(
                "Skipping commit: pending_bytes=%s min_bytes=%s",
                state.uncommitted_audio_bytes,
                state.min_commit_audio_bytes,
            )
            return False

        logger.info(
            "Committing realtime audio buffer: bytes=%s",
            state.uncommitted_audio_bytes,
        )
        await azure_realtime.send(json.dumps({"type": protocol.audio_commit_event_type}))
        state.pending_sequences.append(state.next_sequence)
        state.finalization_event.set()
        state.next_sequence += 1
        state.uncommitted_audio_bytes = 0
        state.uncommitted_has_speech = False
        state.silent_audio_seconds = 0
        return True


def mark_pending_item_finalization(
    state: RealtimeProxyState,
    item_id: str,
) -> None:
    state.pending_item_ids.add(item_id)
    state.finalization_event.set()


def mark_item_finalized(
    state: RealtimeProxyState,
    item_id: str | None,
) -> None:
    if not item_id:
        return

    state.pending_item_ids.discard(item_id)
    state.finalization_event.set()


def mark_session_closed(state: RealtimeProxyState) -> None:
    state.session_closed_event.set()


def discard_pending_sequence(state: RealtimeProxyState) -> None:
    if state.pending_sequences:
        state.pending_sequences.popleft()
        state.finalization_event.set()


def has_pending_finalizations(state: RealtimeProxyState) -> bool:
    return bool(state.pending_sequences or state.pending_item_ids)


async def wait_for_pending_finalizations(
    state: RealtimeProxyState,
    timeout_seconds: float,
) -> None:
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout_seconds

    while has_pending_finalizations(state):
        remaining_seconds = deadline - loop.time()
        if remaining_seconds <= 0:
            logger.info(
                "Timed out waiting for realtime finalization: pending_sequences=%s pending_items=%s",
                len(state.pending_sequences),
                len(state.pending_item_ids),
            )
            return

        state.finalization_event.clear()
        if not has_pending_finalizations(state):
            return

        try:
            await asyncio.wait_for(
                state.finalization_event.wait(),
                timeout=remaining_seconds,
            )
        except TimeoutError:
            logger.info(
                "Timed out waiting for realtime finalization: pending_sequences=%s pending_items=%s",
                len(state.pending_sequences),
                len(state.pending_item_ids),
            )
            return


async def wait_for_session_closed(
    state: RealtimeProxyState,
    timeout_seconds: float,
) -> None:
    try:
        await asyncio.wait_for(state.session_closed_event.wait(), timeout=timeout_seconds)
    except TimeoutError:
        logger.info("Timed out waiting for realtime session.closed.")


async def close_upstream_session(
    azure_realtime: Any,
    state: RealtimeProxyState,
    protocol: RealtimeUpstreamProtocol,
) -> None:
    if protocol.session_close_event_type is None:
        return

    async with state.send_lock:
        await azure_realtime.send(json.dumps({"type": protocol.session_close_event_type}))


async def handle_client_control(
    client: WebSocket,
    azure_realtime: Any,
    state: RealtimeProxyState,
    stop_event: asyncio.Event,
    message: str,
    *,
    protocol: RealtimeUpstreamProtocol,
) -> None:
    try:
        event = json.loads(message)
    except JSONDecodeError:
        await send_client_event(
            client,
            {
                "type": "error",
                "message": "Client websocket text messages must be JSON.",
            },
        )
        return

    event_type = event.get("type")
    if event_type == "stop":
        if supports_audio_commit(protocol):
            await commit_audio_buffer(
                azure_realtime,
                state,
                protocol,
                force=protocol.force_commit_on_stop,
            )
        if protocol.close_session_before_drain:
            await close_upstream_session(azure_realtime, state, protocol)
        if protocol.wait_for_session_closed_on_stop:
            await wait_for_session_closed(state, state.stop_drain_seconds)
        elif protocol.wait_for_pending_finalizations_on_stop:
            await wait_for_pending_finalizations(state, state.stop_drain_seconds)
        else:
            await asyncio.sleep(state.stop_drain_seconds)
        if not protocol.close_session_before_drain:
            await close_upstream_session(azure_realtime, state, protocol)
        stop_event.set()
        return

    if event_type == "commit":
        if not supports_audio_commit(protocol):
            await send_client_event(
                client,
                {
                    "type": "status",
                    "status": "commit_skipped",
                    "reason": "Manual commit is disabled for this realtime session.",
                },
            )
            return

        committed = await commit_audio_buffer(azure_realtime, state, protocol)
        if not committed:
            await send_client_event(
                client,
                {
                    "type": "status",
                    "status": "commit_skipped",
                    "reason": "No pending audio to commit.",
                },
            )
        return

    await send_client_event(
        client,
        {
            "type": "error",
            "message": f"Unsupported client event type: {event_type}",
        },
    )


async def forward_client_events(
    client: WebSocket,
    azure_realtime: Any,
    state: RealtimeProxyState,
    stop_event: asyncio.Event,
    *,
    protocol: RealtimeUpstreamProtocol,
) -> None:
    while not stop_event.is_set():
        message = await client.receive()
        message_type = message["type"]

        if message_type == "websocket.disconnect":
            stop_event.set()
            return

        text = message.get("text")
        if text is not None:
            await handle_client_control(
                client,
                azure_realtime,
                state,
                stop_event,
                text,
                protocol=protocol,
            )
            continue

        audio_bytes = message.get("bytes")
        if audio_bytes is not None:
            await append_audio_chunk(
                azure_realtime,
                state,
                audio_bytes,
                protocol=protocol,
            )


async def auto_commit_audio(
    azure_realtime: Any,
    state: RealtimeProxyState,
    stop_event: asyncio.Event,
    protocol: RealtimeUpstreamProtocol,
) -> None:
    while not stop_event.is_set():
        await asyncio.sleep(state.commit_interval_seconds)
        await commit_audio_buffer(azure_realtime, state, protocol)


def normalize_error_event(event: dict[str, Any]) -> dict[str, Any]:
    error = event.get("error")
    message = None
    if isinstance(error, dict):
        message = error.get("message")

    message = message or event.get("message") or "Azure realtime error."
    if "buffer too small" in message.lower():
        logger.info("Azure skipped a too-small audio commit: %s", message)
        return {
            "type": "status",
            "status": "commit_skipped",
            "reason": message,
            "source": "azure",
        }

    logger.warning("Azure realtime error: %s", message)
    return {
        "type": "error",
        "message": message,
        "source": "azure",
    }


async def send_normalized_client_events(
    client: WebSocket,
    normalized: NormalizedRealtimeEvent,
) -> None:
    if normalized is None:
        return

    events = normalized if isinstance(normalized, list) else [normalized]
    for event in events:
        await send_client_event(client, event)


async def forward_azure_events(
    client: WebSocket,
    azure_realtime: Any,
    state: RealtimeProxyState,
    normalize_event: RealtimeEventNormalizer,
) -> None:
    async for message in azure_realtime:
        if isinstance(message, bytes):
            continue

        try:
            event = json.loads(message)
        except JSONDecodeError:
            await send_client_event(
                client,
                {
                    "type": "error",
                    "message": "Azure realtime sent a non-JSON message.",
                    "source": "azure",
                },
            )
            continue

        await send_normalized_client_events(client, normalize_event(state, event))


async def proxy_realtime_events(
    client: WebSocket,
    azure_realtime: Any,
    normalize_event: RealtimeEventNormalizer,
    *,
    protocol: RealtimeUpstreamProtocol,
) -> None:
    state = build_proxy_state()
    stop_event = asyncio.Event()
    client_to_azure = asyncio.create_task(
        forward_client_events(
            client,
            azure_realtime,
            state,
            stop_event,
            protocol=protocol,
        )
    )
    azure_to_client = asyncio.create_task(
        forward_azure_events(client, azure_realtime, state, normalize_event)
    )
    tasks = {client_to_azure, azure_to_client}

    if protocol.commit_strategy == "fixed":
        tasks.add(
            asyncio.create_task(
                auto_commit_audio(azure_realtime, state, stop_event, protocol)
            )
        )

    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for task in pending:
        task.cancel()

    await asyncio.gather(*pending, return_exceptions=True)
    for task in done:
        if not task.cancelled():
            task.result()
