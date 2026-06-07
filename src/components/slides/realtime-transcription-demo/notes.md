# Realtime transcription notes

OpenAI's Realtime transcription docs list `audio.input.transcription.delay` as
an optional latency/accuracy tradeoff for `gpt-realtime-whisper`, with values
`minimal`, `low`, `medium`, `high`, and `xhigh`.

Azure's current Realtime wrapper for this deployment rejects that field with:

```text
Unknown parameter: 'session.audio.input.transcription.delay'
```

So the implementation intentionally omits `delay` from `session.update` for now.
Quality/latency tuning currently happens through the server's manual commit
window instead:

```env
AZURE_OPENAI_REALTIME_COMMIT_INTERVAL_MS=2000
AZURE_OPENAI_REALTIME_MIN_COMMIT_AUDIO_MS=500
AZURE_OPENAI_REALTIME_MIN_AUDIO_RMS=0.01
AZURE_OPENAI_REALTIME_STOP_DRAIN_MS=2200
```

Longer commit windows usually improve transcription quality by giving the model
more audio context, but transcript updates arrive later.
