# Realtime translation notes

## Input language hints

The `gpt-realtime-translate` session does not support an input transcription
language hint. The endpoint rejects
`session.audio.input.transcription.language` with:

```text
Unknown parameter: 'session.audio.input.transcription.language'.
```

Use the translation slide's target language selector for output language only.
For source-language hints, use the standalone `gpt-realtime-whisper`
transcription slide, where `audio.input.transcription.language` belongs to the
`type: "transcription"` session contract.
