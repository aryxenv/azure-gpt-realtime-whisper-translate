# Realtime transcription notes

## Quality Control Delay

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

## Language hints

OpenAI documents `audio.input.transcription.language` as one optional string,
for example `de`. It does not document a list of language hints.

Azure rejects arrays for this field:

```text
Invalid type for 'session.audio.input.transcription.language': expected one of
..., but got an array instead.
```

The backend therefore omits `language` by default so the model can auto-detect
the spoken language. For controlled single-language tests, set exactly one hint:

```env
AZURE_OPENAI_REALTIME_LANGUAGE_HINT=de
```

## Detected language events

The Realtime transcription delta/completed events do not expose a detected
language code. The API can auto-detect internally when `language` is omitted,
but there is no documented event field we can use to show "this segment was
German/French/etc." in the client.

## EU language coverage

OpenAI publishes a general Speech-to-text supported language list, but I did
not find a separate `gpt-realtime-whisper`-only supported-language table. The
Realtime docs describe `language` only as an optional ISO-639-1 hint, and the
Azure validation error exposes the accepted hint enum.

Comparing those documented/accepted language codes with the 24 EU official
languages, 22 are covered:

```text
bg, hr, cs, da, nl, en, et, fi, fr, de, el, hu, it, lv, lt, pl,
pt, ro, sk, sl, es, sv
```

The likely gaps are Irish (`ga`) and Maltese (`mt`): they are not listed in
OpenAI's supported speech-to-text languages and are not accepted as `language`
hints by the Azure Realtime endpoint. The model may still produce output for
unlisted languages, but quality should be treated as lower/unsupported.
