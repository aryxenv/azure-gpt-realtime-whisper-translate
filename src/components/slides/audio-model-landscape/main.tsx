import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { SlideProps } from "@/components/slides/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SlideFrame } from "@/components/ui/slide-frame";
import { cn } from "@/lib/utils";

const modelCatalogUrl =
  "https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure?pivots=azure-openai#audio-models";
const realtimeAudioUrl =
  "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio";
const maiTranscribeUrl =
  "https://learn.microsoft.com/azure/ai-services/speech-service/mai-transcribe";

const modelDots = [
  {
    name: "whisper",
    label: "Batch file baseline",
    category: "Audio API",
    focus: false,
  },
  {
    name: "gpt-realtime",
    label: "Adjacent voice-agent option",
    category: "Context only",
    focus: false,
  },
  {
    name: "MAI-Transcribe-1.5",
    label: "Strong non-realtime STT option",
    category: "Azure Speech",
    focus: false,
  },
  {
    name: "gpt-4o-transcribe",
    label: "Batch STT quality option",
    category: "Audio API",
    focus: false,
  },
  {
    name: "gpt-realtime-whisper",
    label: "Focus: live transcription",
    category: "Realtime transcription",
    focus: true,
  },
  {
    name: "gpt-realtime-translate",
    label: "Focus: live translation",
    category: "Realtime translation",
    focus: true,
  },
] as const;

type ModelName = (typeof modelDots)[number]["name"];
type ModelStats = {
  summary: string;
  stats: [string, string][];
  sources: { label: string; url: string }[];
};

const decisionRows = [
  {
    kicker: "Batch context",
    title: "Recorded audio files",
    detail: "File audio after capture.",
    modelIndexes: [0, 2, 3],
    focus: false,
  },
  {
    kicker: "Adjacent context",
    title: "Voice-agent interaction",
    detail: "Speech-in / speech-out agents.",
    modelIndexes: [1],
    focus: false,
  },
  {
    kicker: "Realtime transcription",
    title: "Live transcript",
    detail: "Live speech-to-text.",
    modelIndexes: [4],
    focus: true,
  },
  {
    kicker: "Realtime translation",
    title: "Live translation",
    detail: "Source and translated text.",
    modelIndexes: [5],
    focus: true,
  },
];

const modelStats = {
  whisper: {
    summary: "General-purpose speech recognition model for batch audio.",
    stats: [
      ["Job", "Speech-to-text / speech translation"],
      ["Interaction", "Recorded audio file"],
      ["Max request", "25 MB audio file"],
      ["Positioning", "Baseline Audio API option"],
      ["Region", "Validate in target Azure region"],
    ],
    sources: [{ label: "Foundry audio model catalog", url: modelCatalogUrl }],
  },
  "gpt-realtime": {
    summary: "Realtime speech-in / speech-out model for conversational apps.",
    stats: [
      ["Job", "Live voice interaction"],
      ["Interaction", "Low-latency realtime session"],
      ["Output", "Speech and events"],
      ["Positioning", "Adjacent context, not this demo focus"],
      ["Region", "Validate in target Azure region"],
    ],
    sources: [{ label: "Azure OpenAI realtime audio", url: realtimeAudioUrl }],
  },
  "MAI-Transcribe-1.5": {
    summary:
      "A strong non-realtime transcription option through Azure Speech LLM Speech.",
    stats: [
      ["Job", "Speech-to-text"],
      ["Interaction", "Non-realtime transcription"],
      ["API path", "Azure Speech LLM Speech API"],
      ["Status", "Preview"],
      ["Region", "North Europe"],
    ],
    sources: [
      { label: "MAI-Transcribe in Azure Speech", url: maiTranscribeUrl },
    ],
  },
  "gpt-4o-transcribe": {
    summary: "GPT-4o powered speech-to-text model for batch audio.",
    stats: [
      ["Job", "Speech-to-text"],
      ["Interaction", "Recorded audio file"],
      ["Max request", "25 MB audio file"],
      ["Status", "Preview"],
      ["Region", "Validate in target Azure region"],
    ],
    sources: [{ label: "Foundry audio model catalog", url: modelCatalogUrl }],
  },
  "gpt-realtime-whisper": {
    summary: "Realtime transcription path for streaming live speech to text.",
    stats: [
      ["Job", "Live transcript"],
      ["Interaction", "Realtime transcription session"],
      ["Output", "Transcript deltas"],
      ["Positioning", "Demo focus"],
      ["Region", "France Central, Sweden Central"],
    ],
    sources: [
      { label: "Azure OpenAI realtime audio", url: realtimeAudioUrl },
      { label: "Foundry audio model catalog", url: modelCatalogUrl },
    ],
  },
  "gpt-realtime-translate": {
    summary:
      "Realtime translation path for streaming source transcript and translated output.",
    stats: [
      ["Job", "Live translation"],
      ["Interaction", "Realtime translation session"],
      ["Output", "Source transcript + translation"],
      ["Positioning", "Demo focus"],
      ["Region", "France Central, Sweden Central"],
    ],
    sources: [
      { label: "Azure OpenAI realtime audio", url: realtimeAudioUrl },
      { label: "Foundry audio model catalog", url: modelCatalogUrl },
    ],
  },
} satisfies Record<ModelName, ModelStats>;

function FocusPulse({ inverted = false }: { inverted?: boolean }) {
  return (
    <span
      className={cn(
        "relative mr-1.5 inline-flex h-1.5 w-1.5 shrink-0 translate-y-px items-center justify-center",
        inverted ? "text-primary-foreground" : "text-primary",
      )}
      aria-hidden="true"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-35" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

export function AudioModelLandscape({ cycleIndex, onSelectCycle }: SlideProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedModelName, setSelectedModelName] = useState<ModelName | null>(
    null,
  );
  const activeRow = decisionRows[cycleIndex] ?? decisionRows[0];
  const selectedModel = selectedModelName
    ? modelDots.find((model) => model.name === selectedModelName)
    : null;
  const selectedStats = selectedModel ? modelStats[selectedModel.name] : null;

  return (
    <SlideFrame
      eyebrow="Model landscape"
      title="Speech model options."
      titleClassName="lg:whitespace-normal"
    >
      <div className="grid min-h-full grid-cols-1 gap-4 sm:gap-6 xl:h-full xl:min-h-0 xl:grid-cols-[1.2fr_0.8fr] xl:items-stretch">
        <Card className="flex flex-col p-4 sm:min-h-[20rem] xl:h-full xl:min-h-0">
          <div className="mb-3 flex shrink-0 flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
            <div>
              <p className="text-sm font-semibold">Choose by job to be done</p>
              <p className="text-xs text-muted-foreground">
                The focus models sit in the realtime paths.
              </p>
            </div>
            <Badge variant="default">Focus: 2 models</Badge>
          </div>

          <div className="flex flex-1 flex-col gap-2 sm:min-h-[15rem] xl:min-h-0">
            {decisionRows.map((row, rowIndex) => {
              const isActive = row === activeRow;

              return (
                <div
                  key={row.title}
                  className={cn(
                    "flex min-h-0 flex-1 cursor-pointer flex-col items-start justify-between gap-2 rounded-lg border bg-card p-3 shadow-line transition-colors sm:flex-row sm:items-center sm:gap-3",
                    isActive ? "border-primary" : "border-border",
                  )}
                  onClick={() => onSelectCycle(rowIndex)}
                >
                  <div className="min-w-0">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {row.kicker}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold leading-tight tracking-[-0.02em]">
                      {row.title}
                    </p>
                  </div>

                  <div className="flex max-w-full flex-wrap justify-start gap-1.5 sm:max-w-[70%] sm:justify-end">
                    {row.modelIndexes.map((index) => {
                      const model = modelDots[index];

                      return (
                        <span
                          key={model.name}
                          className={cn(
                            "inline-flex items-center rounded-sm border px-1.5 py-1 font-mono text-[0.56rem] font-semibold leading-none tracking-[-0.03em] sm:text-[0.58rem]",
                            isActive || model.focus
                              ? "border-border bg-background text-foreground shadow-line"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {model.focus ? <FocusPulse /> : null}
                          {model.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-3 xl:h-full xl:min-h-0">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:auto-rows-fr">
            {modelDots.map((model, index) => {
              const isFamilyActive =
                activeRow?.modelIndexes.includes(index) ?? false;

              return (
                <Card
                  key={model.name}
                  className={cn(
                    "flex cursor-pointer flex-col justify-between border-2 p-3 transition-colors duration-300 sm:p-2.5",
                    isFamilyActive ? "border-primary" : "border-border",
                  )}
                  onClick={() => {
                    setSelectedModelName(model.name);
                    setDetailsOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }

                    event.preventDefault();
                    setSelectedModelName(model.name);
                    setDetailsOpen(true);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="flex items-center text-sm font-semibold leading-tight">
                      {model.focus ? <FocusPulse /> : null}
                      {model.name}
                    </p>
                    <Badge variant={isFamilyActive ? "default" : "muted"}>
                      {model.category}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-4 text-muted-foreground">
                    {model.label}
                  </p>
                </Card>
              );
            })}
          </div>

          <p className="shrink-0 text-xs leading-5 text-muted-foreground">
            Source:{" "}
            <a
              className="underline underline-offset-4"
              href={modelCatalogUrl}
              rel="noreferrer"
              target="_blank"
            >
              learn.microsoft.com/.../models-sold-directly-by-azure#audio-models
            </a>
          </p>
        </div>
      </div>

      <Dialog.Root open={detailsOpen} onOpenChange={setDetailsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            data-capture-shortcuts
            className="export-dialog-content fixed left-1/2 top-1/2 z-50 max-h-[min(620px,calc(100dvh-2rem))] w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-deck focus-visible:outline-none sm:p-6"
          >
            {selectedModel && selectedStats ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Badge variant={selectedModel.focus ? "default" : "muted"}>
                      {selectedModel.category}
                    </Badge>
                    <Dialog.Title className="mt-3 font-mono text-2xl font-semibold tracking-[-0.04em]">
                      {selectedModel.name}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                      {selectedStats.summary}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close className="rounded-sm border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-muted">
                    Close
                  </Dialog.Close>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectedStats.stats.map(([label, value]) => (
                    <div
                      key={label}
                      className={cn(
                        "rounded-lg border border-border bg-card p-3",
                        label === "Region" ? "sm:col-span-2" : null,
                      )}
                    >
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {label}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-5">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-border" />

                <div className="mt-4 rounded-lg border border-border bg-card p-3 shadow-line">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Sources
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {selectedStats.sources.map((source) => (
                      <a
                        key={source.url}
                        className="font-semibold underline underline-offset-4"
                        href={source.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {source.label}
                      </a>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </SlideFrame>
  );
}
