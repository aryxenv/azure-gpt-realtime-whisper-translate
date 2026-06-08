import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SlideProps } from "@/components/slides/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SlideFrame } from "@/components/ui/slide-frame";
import {
  cleanupRealtimeAudioCapture,
  startRealtimeAudioCapture,
  type RealtimeAudioCaptureHandles,
} from "@/lib/realtime-audio";
import {
  applyTranscriptEvent,
  createTranscriptStreamState,
  getTranscriptText,
  type RealtimeTranscriptEvent,
} from "@/lib/realtime-transcript";
import { getServerWebSocketUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

type CaptureStatus = "idle" | "connecting" | "listening" | "stopping" | "error";

interface TranscriptServerEvent extends RealtimeTranscriptEvent {
  type: string;
  message?: string;
  status?: string;
}

interface LanguageOption {
  code: string;
  label: string;
}

const AUTO_LANGUAGE_HINT = "auto";

const LANGUAGE_HINT_OPTIONS: LanguageOption[] = [
  { code: AUTO_LANGUAGE_HINT, label: "Auto detect" },
  { code: "nl", label: "Dutch" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
];

function getRealtimeWebSocketUrl(languageHint: string) {
  const configuredUrl = import.meta.env.VITE_REALTIME_WS_URL as
    | string
    | undefined;
  const baseUrl =
    configuredUrl || getServerWebSocketUrl("/realtime/whisper");
  if (languageHint === AUTO_LANGUAGE_HINT) {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("languageHint", languageHint);
    return url.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}languageHint=${encodeURIComponent(
      languageHint,
    )}`;
  }
}

export function RealtimeTranscriptionDemo({ isActive }: SlideProps) {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [languageHint, setLanguageHint] = useState(AUTO_LANGUAGE_HINT);
  const [transcriptState, setTranscriptState] = useState(
    createTranscriptStreamState,
  );
  const captureRef = useRef<RealtimeAudioCaptureHandles | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const isListening = status === "listening";
  const isBusy = status === "connecting" || status === "stopping";
  const websocketUrl = useMemo(
    () => getRealtimeWebSocketUrl(languageHint),
    [languageHint],
  );
  const transcript = useMemo(
    () => getTranscriptText(transcriptState),
    [transcriptState],
  );
  const hasTranscript = transcript.trim().length > 0;

  const stopListening = useCallback(() => {
    const capture = captureRef.current;
    if (!capture) {
      setStatus("idle");
      return;
    }

    setStatus("stopping");
    cleanupRealtimeAudioCapture(capture, { gracefulStop: true });
    captureRef.current = null;
  }, []);

  const handleServerMessage = useCallback((message: MessageEvent) => {
    let event: TranscriptServerEvent;
    try {
      if (typeof message.data !== "string") {
        throw new Error("Realtime server sent a non-text message.");
      }
      event = JSON.parse(message.data) as TranscriptServerEvent;
    } catch {
      setError("Realtime server sent a non-JSON message.");
      setStatus("error");
      return;
    }

    if (
      event.type === "transcript.delta" ||
      event.type === "transcript.completed"
    ) {
      setTranscriptState((current) => applyTranscriptEvent(current, event));
      return;
    }

    if (event.type === "error") {
      setError(event.message ?? "Realtime transcription failed.");
      setStatus("error");
      return;
    }

    if (event.type === "status" && event.status === "connected") {
      setStatus("listening");
    }
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    setTranscriptState(createTranscriptStreamState());
    setStatus("connecting");

    try {
      captureRef.current = await startRealtimeAudioCapture({
        websocketUrl,
        onMessage: handleServerMessage,
        onSocketError: () => {
          setError("Realtime server websocket failed.");
          setStatus("error");
        },
        onSocketClose: () => {
          captureRef.current = null;
          setStatus((current) =>
            current === "stopping" || current === "listening"
              ? "idle"
              : current,
          );
        },
      });
      setStatus("listening");
    } catch (startError) {
      cleanupRealtimeAudioCapture(captureRef.current);
      captureRef.current = null;
      setError(
        startError instanceof Error
          ? startError.message
          : "Could not start microphone capture.",
      );
      setStatus("error");
    }
  }, [handleServerMessage, websocketUrl]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }

    if (isBusy) {
      return;
    }

    void startListening();
  }, [isBusy, isListening, startListening, stopListening]);

  useEffect(() => {
    if (!isActive) {
      stopListening();
    }
  }, [isActive, stopListening]);

  useEffect(() => {
    return () => cleanupRealtimeAudioCapture(captureRef.current);
  }, []);

  useEffect(() => {
    const transcriptScroll = transcriptScrollRef.current;
    if (!transcriptScroll || !transcript) {
      return;
    }

    transcriptScroll.scrollTop = transcriptScroll.scrollHeight;
  }, [transcript]);

  return (
    <SlideFrame
      eyebrow="Realtime transcription"
      title="Watch the transcript stream back."
      titleClassName="lg:whitespace-normal"
    >
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[0.8fr_1.2fr] lg:overflow-hidden">
        <Card className="flex min-h-0 min-w-0 flex-col justify-between gap-5 p-4 sm:gap-6 sm:p-6">
          <div>
            <Badge variant={isListening ? "default" : "outline"}>
              {status === "listening" ? "Streaming" : "Local demo"}
            </Badge>
            <p className="mt-4 text-xl font-semibold tracking-[-0.03em] sm:mt-5 sm:text-2xl">
              Browser mic to GPT Realtime Whisper.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Audio streams through the local FastAPI websocket. The server
              stays thin, forwards PCM chunks, and lets the realtime endpoint
              produce transcript events for this slide to render.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Language hint
              </span>
              <select
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 sm:h-12"
                disabled={isBusy || isListening}
                onChange={(event) => setLanguageHint(event.target.value)}
                value={languageHint}
              >
                {LANGUAGE_HINT_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <Button
              className={cn(
                "h-14 w-full rounded-full text-base sm:h-16",
                isListening &&
                  "bg-foreground text-background hover:bg-foreground/90",
              )}
              disabled={isBusy}
              onClick={toggleListening}
              type="button"
            >
              {status === "connecting"
                ? "Connecting..."
                : status === "stopping"
                  ? "Stopping..."
                  : isListening
                    ? "Stop microphone"
                    : "Start microphone"}
            </Button>
            <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {status === "error"
                ? "Error"
                : status === "idle"
                  ? "Ready"
                  : status}
            </p>
            {error ? (
              <p className="break-words rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {error}
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
            <div>
              <p className="font-semibold">Transcript</p>
              <p className="text-xs text-muted-foreground">
                Input transcript deltas
              </p>
            </div>
            <Badge variant={hasTranscript ? "default" : "muted"}>
              {hasTranscript ? "Live text" : "Waiting"}
            </Badge>
          </div>
          <div
            ref={transcriptScrollRef}
            className="max-h-[45dvh] min-h-[13rem] min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:min-h-[18rem] sm:p-5 lg:max-h-none lg:min-h-0"
          >
            {hasTranscript ? (
              <p className="whitespace-pre-wrap break-words text-xl leading-relaxed tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-2xl">
                {transcript}
              </p>
            ) : (
              <div className="flex h-full min-h-[10rem] items-center justify-center rounded-lg border border-dashed border-border bg-muted p-4 text-center sm:min-h-[14rem] sm:p-6">
                <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                  Press the microphone button and start speaking. Transcript
                  deltas and final segments will appear here.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </SlideFrame>
  );
}
