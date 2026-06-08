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
import { cn } from "@/lib/utils";

type CaptureStatus = "idle" | "connecting" | "listening" | "stopping" | "error";

interface TranscriptServerEvent {
  type: string;
  itemId?: string;
  delta?: string;
  transcript?: string;
  message?: string;
  status?: string;
}

function getRealtimeWebSocketUrl() {
  const configuredUrl = import.meta.env.VITE_REALTIME_WS_URL as
    | string
    | undefined;
  if (configuredUrl) {
    return configuredUrl;
  }

  return "ws://localhost:8000/realtime/whisper";
}

function appendDelta(text: string, delta: string | undefined) {
  if (!delta) {
    return text;
  }

  return text + delta;
}

export function RealtimeTranscriptionDemo({ isActive }: SlideProps) {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const captureRef = useRef<RealtimeAudioCaptureHandles | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const isListening = status === "listening";
  const isBusy = status === "connecting" || status === "stopping";
  const websocketUrl = useMemo(() => getRealtimeWebSocketUrl(), []);
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

    if (event.type === "transcript.delta") {
      setTranscript((current) => appendDelta(current, event.delta));
      return;
    }

    if (event.type === "audio.committed") {
      return;
    }

    if (
      event.type === "transcript.completed" &&
      typeof event.transcript === "string"
    ) {
      const completedTranscript = event.transcript;
      setTranscript((current) =>
        event.itemId ? current || completedTranscript : completedTranscript,
      );
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
    setTranscript("");
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
      title="Speak once. Watch the transcript stream back."
      titleClassName="lg:whitespace-normal"
    >
      <div className="grid grid-cols-1 gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="flex min-w-0 flex-col justify-between gap-6 p-6">
          <div>
            <Badge variant={isListening ? "default" : "outline"}>
              {status === "listening" ? "Streaming" : "Local demo"}
            </Badge>
            <p className="mt-5 text-2xl font-semibold tracking-[-0.03em]">
              Browser mic to Azure Realtime Whisper.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Audio streams through the local FastAPI websocket. The server
              stays thin, forwards PCM chunks, and lets the realtime endpoint
              produce transcript events for this slide to render.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              className={cn(
                "h-16 w-full rounded-full text-base",
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
              <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                {error}
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <p className="font-semibold">Transcript</p>
              <p className="text-xs text-muted-foreground">
                Pure input transcript deltas
              </p>
            </div>
            <Badge variant={hasTranscript ? "default" : "muted"}>
              {hasTranscript ? "Live text" : "Waiting"}
            </Badge>
          </div>
          <div
            ref={transcriptScrollRef}
            className="min-h-[18rem] flex-1 overflow-y-auto p-5 lg:min-h-0"
          >
            {hasTranscript ? (
              <p className="whitespace-pre-wrap text-2xl leading-relaxed tracking-[-0.02em]">
                {transcript}
              </p>
            ) : (
              <div className="flex h-full min-h-[14rem] items-center justify-center rounded-lg border border-dashed border-border bg-muted p-6 text-center">
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
