import type { SlideProps } from "@/components/slides/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SlideFrame } from "@/components/ui/slide-frame";
import { cn } from "@/lib/utils";

const sourceUrl =
  "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio";
const modelSourceUrl =
  "https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure?pivots=azure-openai#audio-models";

const opportunities = [
  {
    title: "gpt-realtime-whisper",
    metric: "Transcribe",
    detail:
      "Stream live speech-to-text deltas while the speaker is still talking.",
    sourceLabel: "Foundry audio models",
    sourceUrl: modelSourceUrl,
  },
  {
    title: "gpt-realtime-translate",
    metric: "Translate",
    detail:
      "Stream the source transcript and translated output from the same microphone session.",
    sourceLabel: "Foundry audio models",
    sourceUrl: modelSourceUrl,
  },
];

export function RealtimeVoiceOpportunity({
  cycleIndex,
  onSelectCycle,
}: SlideProps) {
  return (
    <SlideFrame
      eyebrow="Realtime speech AI"
      title="Realtime AI transcription and translation."
      titleClassName="lg:whitespace-normal"
    >
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:min-h-full lg:grid-cols-[0.95fr_1.05fr] lg:content-center">
        <div className="flex min-w-0 flex-col justify-center gap-4 sm:gap-5">
          <Badge variant="outline">Microsoft Foundry + Azure OpenAI</Badge>
          <p className="max-w-2xl text-xl font-semibold leading-tight tracking-[-0.03em] sm:text-3xl">
            Transcribing and translating in realtime with AI.
          </p>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">
            Use{" "}
            <span className="inline-flex items-center rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[0.86em] font-semibold leading-none tracking-[-0.04em] text-foreground shadow-line">
              gpt-realtime-whisper
            </span>{" "}
            and{" "}
            <span className="inline-flex items-center rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[0.86em] font-semibold leading-none tracking-[-0.04em] text-foreground shadow-line">
              gpt-realtime-translate
            </span>{" "}
            for multilingual, LLM-based realtime transcription and translation
            on Azure through Microsoft Foundry.
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            Source:{" "}
            <a
              className="underline underline-offset-4"
              href={sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              learn.microsoft.com/.../realtime-audio
            </a>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {opportunities.map((item, index) => {
            const isActive = cycleIndex === index;

            return (
              <Card
                key={item.title}
                className={cn(
                  "cursor-pointer border-2 p-4 transition-colors duration-300 sm:p-5",
                  isActive ? "border-primary" : "border-border",
                )}
                onClick={() => onSelectCycle(index)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xl font-semibold tracking-[-0.02em]">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.detail}
                    </p>
                    <a
                      className="mt-3 inline-flex text-xs font-semibold text-foreground underline underline-offset-4"
                      href={item.sourceUrl}
                      onClick={(event) => event.stopPropagation()}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Source: {item.sourceLabel}
                    </a>
                  </div>
                  <Badge variant={isActive ? "default" : "muted"}>
                    {item.metric}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </SlideFrame>
  );
}
