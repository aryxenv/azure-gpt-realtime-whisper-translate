# Server

This is a server layer for your demos within the slides.
CORS is open, not a production grade set up, but for demos.

## Get started

setup with uv:

```pwsh
uv sync
```

start server (dev mode):

```pwsh
uv run fastapi dev
```

## Structure

Keeping it simple:

- Keep shared utils in `src/utils`
- Keep routes in `src/router`
- use `main.py` as entry point with routes added here

## Realtime routes

- `/realtime/whisper` proxies audio to the realtime transcription endpoint. It
  appends audio chunks continuously and, by default, commits on pause-aligned
  boundaries so standalone `gpt-realtime-whisper` does not receive one giant
  multilingual buffer. It accepts an optional per-session language hint from the
  client websocket query string.
- `/realtime/translation` proxies audio to the realtime translation endpoint and
  accepts the target output language from the client websocket query string. It
  forwards real low-energy microphone frames so the endpoint can detect natural
  utterance boundaries, then uses the translation session lifecycle and drains
  after `session.close`.
