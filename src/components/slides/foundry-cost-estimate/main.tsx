import type { SlideProps } from "@/components/slides/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SlideFrame } from "@/components/ui/slide-frame";
import { cn } from "@/lib/utils";

const pricingUrl =
  "https://azure.microsoft.com/en-us/pricing/details/azure-openai/";

const durationPriced = [
  {
    model: "gpt-realtime-whisper",
    unit: "$1.02 / hour",
    basis: "Output listed per hour",
    example: "$102 for 100 live audio hours",
    use: "Streaming transcription",
  },
  {
    model: "gpt-realtime-translate",
    unit: "$2.04 / hour",
    basis: "Output listed per hour",
    example: "$204 for 100 live audio hours",
    use: "Streaming translation",
  },
];

export function FoundryCostEstimate({ cycleIndex, onSelectCycle }: SlideProps) {
  return (
    <SlideFrame
      eyebrow="Cost estimate"
      title="Realtime audio priced by hour."
      titleClassName="lg:whitespace-normal"
    >
      <div className="grid grid-cols-1 gap-4 xl:min-h-full xl:grid-cols-[0.95fr_1.35fr] xl:content-center">
        <div className="flex min-w-0 flex-col justify-center gap-4 rounded-lg border border-border bg-card p-4 shadow-line sm:p-5">
          <Badge variant="outline">Pricing basis</Badge>
          <p className="text-xl font-semibold leading-tight tracking-[-0.04em] sm:text-2xl">
            These focused realtime models are duration-priced, not token-priced.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Included here
              </p>
              <p className="mt-1 text-sm font-semibold leading-5">
                gpt-realtime-whisper and gpt-realtime-translate
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Different meter
              </p>
              <p className="mt-1 text-sm font-semibold leading-5">
                GPT-realtime voice models use audio token pricing.
              </p>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Azure pricing lists these two models as{" "}
            <strong>Output $/hour</strong>. Validate region, deployment type,
            agreement, and date for any customer estimate.
          </p>
          <p className="text-xs leading-4 text-muted-foreground">
            Source:{" "}
            <a
              className="break-all underline underline-offset-4 sm:break-normal"
              href={pricingUrl}
              rel="noreferrer"
              target="_blank"
            >
              azure.microsoft.com/.../pricing/details/azure-openai
            </a>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:h-full">
          {durationPriced.map((item, index) => {
            const isActive = cycleIndex === index;

            return (
              <Card
                key={item.model}
                className={cn(
                  "flex cursor-pointer flex-col border-2 p-4 transition-colors duration-300 sm:p-5",
                  isActive ? "border-primary" : "border-border",
                )}
                onClick={() => onSelectCycle(index)}
              >
                <Badge variant={isActive ? "default" : "outline"}>
                  {item.use}
                </Badge>
                <p className="mt-4 font-semibold sm:mt-5">{item.model}</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">
                  {item.unit}
                </p>
                <div className="mt-auto pt-6 sm:pt-8">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Pricing meter
                    </p>
                    <p className="mt-1 text-sm font-semibold">{item.basis}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {item.example}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </SlideFrame>
  );
}
