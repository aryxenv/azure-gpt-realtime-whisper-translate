import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
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

interface TranslationServerEvent {
  type: string;
  delta?: string;
  message?: string;
  status?: string;
  transcript?: string;
  translation?: string;
}

interface LanguageOption {
  code: string;
  label: string;
}

interface StreamPaneProps {
  emptyText: string;
  label: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  subtitle: string;
  text: string;
  title: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "nl", label: "Dutch" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
];

function getTranslationWebSocketBaseUrl() {
  const configuredUrl = import.meta.env.VITE_REALTIME_TRANSLATION_WS_URL as
    | string
    | undefined;
  if (configuredUrl) {
    return configuredUrl;
  }

  return "ws://localhost:8000/realtime/translation";
}

function getTranslationWebSocketUrl(targetLanguage: string) {
  const baseUrl = getTranslationWebSocketBaseUrl();
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("targetLanguage", targetLanguage);
    return url.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}targetLanguage=${encodeURIComponent(
      targetLanguage,
    )}`;
  }
}

function appendDelta(text: string, delta: string | undefined) {
  if (!delta) {
    return text;
  }

  return text + delta;
}

function StreamPane({
  emptyText,
  label,
  scrollRef,
  subtitle,
  text,
  title,
}: StreamPaneProps) {
  const hasText = text.trim().length > 0;

  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Badge className="shrink-0" variant={hasText ? "default" : "muted"}>
          {label}
        </Badge>
      </div>
      <div
        ref={scrollRef}
        className="min-h-[16rem] flex-1 overflow-y-auto p-5 lg:min-h-0"
      >
        {hasText ? (
          <p className="whitespace-pre-wrap text-2xl leading-relaxed tracking-[-0.02em]">
            {text}
          </p>
        ) : (
          <div className="flex h-full min-h-[13rem] items-center justify-center rounded-lg border border-dashed border-border bg-muted p-6 text-center">
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              {emptyText}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export function RealtimeTranslationDemo({ isActive }: SlideProps) {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("nl");
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const captureRef = useRef<RealtimeAudioCaptureHandles | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const translationScrollRef = useRef<HTMLDivElement | null>(null);
  const isListening = status === "listening";
  const isBusy = status === "connecting" || status === "stopping";
  const websocketUrl = useMemo(
    () => getTranslationWebSocketUrl(targetLanguage),
    [targetLanguage],
  );
  const targetLanguageLabel =
    LANGUAGE_OPTIONS.find((option) => option.code === targetLanguage)?.label ??
    targetLanguage.toUpperCase();

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
    let event: TranslationServerEvent;
    try {
      if (typeof message.data !== "string") {
        throw new Error("Realtime server sent a non-text message.");
      }
      event = JSON.parse(message.data) as TranslationServerEvent;
    } catch {
      setError("Realtime translation server sent a non-JSON message.");
      setStatus("error");
      return;
    }

    if (event.type === "transcript.delta") {
      setTranscript((current) => appendDelta(current, event.delta));
      return;
    }

    if (event.type === "translation.delta") {
      setTranslation((current) => appendDelta(current, event.delta));
      return;
    }

    if (event.type === "transcript.completed" && event.transcript) {
      setTranscript(event.transcript);
      return;
    }

    if (event.type === "translation.completed" && event.translation) {
      setTranslation(event.translation);
      return;
    }

    if (event.type === "error") {
      setError(event.message ?? "Realtime translation failed.");
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
    setTranslation("");
    setStatus("connecting");

    try {
      captureRef.current = await startRealtimeAudioCapture({
        websocketUrl,
        onMessage: handleServerMessage,
        onSocketError: () => {
          setError("Realtime translation websocket failed.");
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

  useEffect(() => {
    const translationScroll = translationScrollRef.current;
    if (!translationScroll || !translation) {
      return;
    }

    translationScroll.scrollTop = translationScroll.scrollHeight;
  }, [translation]);

  return (
    <SlideFrame
      eyebrow="Realtime translation"
      title="Speak once. Stream transcript and translation together."
      titleClassName="lg:whitespace-normal"
    >
      <div className="grid grid-cols-1 gap-6 xl:h-full xl:min-h-0 xl:grid-cols-[0.75fr_1fr_1fr]">
        <Card className="flex min-w-0 flex-col justify-between gap-6 p-6">
          <div>
            <Badge variant={isListening ? "default" : "outline"}>
              {isListening ? "Translating" : "Local demo"}
            </Badge>
            <p className="mt-5 text-2xl font-semibold tracking-[-0.03em]">
              Browser mic to GPT Realtime Translate.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Audio streams through the same local FastAPI proxy, while Foundry
              returns both input transcript deltas and translated transcript
              deltas.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Target language
              </span>
              <select
                className="h-12 w-full rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBusy || isListening}
                onChange={(event) => setTargetLanguage(event.target.value)}
                value={targetLanguage}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

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
                  ? `Ready for ${targetLanguageLabel}`
                  : status}
            </p>
            {error ? (
              <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                {error}
              </p>
            ) : null}
          </div>
        </Card>

        <StreamPane
          emptyText="Start the microphone and speak naturally. The source transcript stream will appear here."
          label="Source"
          scrollRef={transcriptScrollRef}
          subtitle="Input transcript deltas"
          text={transcript}
          title="Raw transcript"
        />

        <StreamPane
          emptyText={`Choose ${targetLanguageLabel}, start the microphone, and translated text will stream here.`}
          label={targetLanguageLabel}
          scrollRef={translationScrollRef}
          subtitle="Translated output deltas"
          text={translation}
          title="Translation"
        />
      </div>
    </SlideFrame>
  );
}
