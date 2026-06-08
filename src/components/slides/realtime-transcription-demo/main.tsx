import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SlideProps } from "@/components/slides/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SlideFrame } from "@/components/ui/slide-frame";
import { cn } from "@/lib/utils";

const TARGET_SAMPLE_RATE = 24000;
const PROCESSOR_BUFFER_SIZE = 4096;

type CaptureStatus = "idle" | "connecting" | "listening" | "stopping" | "error";

interface TranscriptItem {
  itemId: string;
  sequence: number;
  text: string;
  isFinal: boolean;
}

interface TranscriptServerEvent {
  type: string;
  itemId?: string;
  sequence?: number;
  delta?: string;
  transcript?: string;
  message?: string;
  status?: string;
}

interface AudioCaptureHandles {
  context: AudioContext;
  mute: GainNode;
  processor: ScriptProcessorNode;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
  socket: WebSocket;
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

function floatToPcm16(samples: Float32Array) {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(index * 2, value, true);
  });

  return buffer;
}

function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
) {
  if (fromRate === toRate) {
    return samples;
  }

  const ratio = fromRate / toRate;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.min(lowerIndex + 1, samples.length - 1);
    const weight = sourceIndex - lowerIndex;
    output[index] =
      samples[lowerIndex] * (1 - weight) + samples[upperIndex] * weight;
  }

  return output;
}

function upsertTranscriptItem(
  items: TranscriptItem[],
  itemId: string,
  sequence: number | undefined,
  text: string,
  isFinal: boolean,
) {
  const fallbackSequence = items.length + 1;
  const nextSequence = sequence ?? fallbackSequence;
  const existingIndex = items.findIndex((item) => item.itemId === itemId);

  if (existingIndex === -1) {
    return [
      ...items,
      {
        itemId,
        sequence: nextSequence,
        text,
        isFinal,
      },
    ].sort((a, b) => a.sequence - b.sequence);
  }

  return items
    .map((item, index) =>
      index === existingIndex
        ? {
            ...item,
            sequence: sequence ?? item.sequence,
            text: isFinal ? text : item.text + text,
            isFinal: item.isFinal || isFinal,
          }
        : item,
    )
    .sort((a, b) => a.sequence - b.sequence);
}

function cleanupCapture(
  handles: AudioCaptureHandles | null,
  { gracefulStop = false }: { gracefulStop?: boolean } = {},
) {
  if (!handles) {
    return;
  }

  handles.processor.disconnect();
  handles.mute.disconnect();
  handles.source.disconnect();
  handles.stream.getTracks().forEach((track) => track.stop());

  if (handles.socket.readyState === WebSocket.OPEN) {
    handles.socket.send(JSON.stringify({ type: "stop" }));
  }

  if (gracefulStop) {
    window.setTimeout(() => handles.socket.close(), 1300);
  } else {
    handles.socket.close();
  }

  void handles.context.close();
}

export function RealtimeTranscriptionDemo({ isActive }: SlideProps) {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  const captureRef = useRef<AudioCaptureHandles | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const isListening = status === "listening";
  const isBusy = status === "connecting" || status === "stopping";
  const websocketUrl = useMemo(() => getRealtimeWebSocketUrl(), []);
  const visibleTranscriptItems = transcriptItems.filter((item) =>
    item.text.trim(),
  );
  const transcriptText = visibleTranscriptItems
    .map((item) => item.text)
    .join(" ")
    .trim();

  const stopListening = useCallback(() => {
    const capture = captureRef.current;
    if (!capture) {
      setStatus("idle");
      return;
    }

    setStatus("stopping");
    cleanupCapture(capture, { gracefulStop: true });
    captureRef.current = null;
  }, []);

  const handleServerMessage = useCallback((message: MessageEvent<string>) => {
    let event: TranscriptServerEvent;
    try {
      event = JSON.parse(message.data) as TranscriptServerEvent;
    } catch {
      setError("Realtime server sent a non-JSON message.");
      setStatus("error");
      return;
    }

    if (event.type === "transcript.delta" && event.itemId && event.delta) {
      setTranscriptItems((items) =>
        upsertTranscriptItem(
          items,
          event.itemId,
          event.sequence,
          event.delta ?? "",
          false,
        ),
      );
      return;
    }

    if (event.type === "audio.committed" && event.itemId) {
      setTranscriptItems((items) =>
        upsertTranscriptItem(items, event.itemId, event.sequence, "", false),
      );
      return;
    }

    if (
      event.type === "transcript.completed" &&
      event.itemId &&
      typeof event.transcript === "string"
    ) {
      setTranscriptItems((items) =>
        upsertTranscriptItem(
          items,
          event.itemId,
          event.sequence,
          event.transcript ?? "",
          true,
        ),
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
    setStatus("connecting");
    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const socket = new WebSocket(websocketUrl);
      socket.binaryType = "arraybuffer";

      await new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true });
        socket.addEventListener(
          "error",
          () => reject(new Error("Could not connect to realtime server.")),
          { once: true },
        );
      });

      const context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(
        PROCESSOR_BUFFER_SIZE,
        1,
        1,
      );
      const mute = context.createGain();
      mute.gain.value = 0;

      socket.addEventListener("message", handleServerMessage);
      socket.addEventListener("error", () => {
        setError("Realtime server websocket failed.");
        setStatus("error");
      });
      socket.addEventListener("close", () => {
        captureRef.current = null;
        setStatus((current) =>
          current === "stopping" || current === "listening" ? "idle" : current,
        );
      });

      processor.onaudioprocess = (event) => {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        const input = event.inputBuffer.getChannelData(0);
        const samples = resampleLinear(
          input,
          context.sampleRate,
          TARGET_SAMPLE_RATE,
        );
        socket.send(floatToPcm16(samples));
      };

      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);

      captureRef.current = {
        context,
        mute,
        processor,
        source,
        stream,
        socket,
      };
      setStatus("listening");
    } catch (startError) {
      cleanupCapture(captureRef.current);
      stream?.getTracks().forEach((track) => track.stop());
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
    return () => cleanupCapture(captureRef.current);
  }, []);

  useEffect(() => {
    const transcriptScroll = transcriptScrollRef.current;
    if (!transcriptScroll || !transcriptText) {
      return;
    }

    transcriptScroll.scrollTop = transcriptScroll.scrollHeight;
  }, [transcriptText]);

  return (
    <SlideFrame
      eyebrow="Realtime transcription"
      title="Speak once. Watch the transcript stream back."
      titleClassName="lg:whitespace-normal"
    >
      <div className="grid grid-cols-1 gap-6 pb-6 sm:pb-8 lg:h-full lg:min-h-0 lg:grid-cols-[0.8fr_1.2fr]">
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
              commits short PCM windows and returns transcript events for this
              slide to render.
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
                Ordered by committed audio window
              </p>
            </div>
            <Badge variant="muted">{transcriptItems.length} items</Badge>
          </div>
          <div
            ref={transcriptScrollRef}
            className="min-h-[18rem] flex-1 overflow-y-auto p-5 lg:min-h-0"
          >
            {transcriptText ? (
              <p className="whitespace-pre-wrap text-2xl leading-relaxed tracking-[-0.02em]">
                {visibleTranscriptItems.map((item, index) => (
                  <span
                    className={cn(
                      item.isFinal ? "text-foreground" : "text-muted-foreground",
                    )}
                    key={item.itemId}
                  >
                    {index > 0 ? " " : ""}
                    {item.text}
                  </span>
                ))}
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
