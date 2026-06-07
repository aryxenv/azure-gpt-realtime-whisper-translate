import type { SlideProps } from "@/components/slides/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SlideFrame } from "@/components/ui/slide-frame";
import { cn } from "@/lib/utils";

const EXAMPLE_DECK_URL =
  "https://aryxenv.github.io/SOB_Hackathon_Presentation/";

const controls = [
  {
    key: "← / →",
    label: "Move through the deck",
    detail: "Arrow keys step between slides.",
  },
  {
    key: "Space",
    label: "Cycle inside a slide",
    detail: "Moves the accent across local elements.",
  },
  {
    key: "Swipe",
    label: "Navigate on mobile",
    detail: "Swipe left or right to move between slides.",
  },
];

export function WebslidesIntroduction({
  cycleIndex,
  onSelectCycle,
}: SlideProps) {
  return (
    <SlideFrame
      eyebrow="Webslides template"
      title="A slide deck, built like a web app."
    >
      <div className="grid grid-cols-1 gap-8 lg:h-full lg:min-h-0 lg:content-center lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-5">
          <Badge variant="outline" className="w-fit">
            Template concept
          </Badge>
          <p className="text-2xl font-semibold leading-tight tracking-[-0.03em] sm:text-3xl lg:text-4xl">
            Put demos, data, and live components directly in the story you
            present.
          </p>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">
            The deck is React, Tailwind, and your own component system. If it
            runs on the web, it can live inside a slide.
          </p>
          <a
            className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            href={EXAMPLE_DECK_URL}
            rel="noreferrer"
            target="_blank"
          >
            See a deployed example →
          </a>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Controls
          </p>
          {controls.map((control, index) => {
            const isActive = index === cycleIndex;

            return (
              <Card
                key={control.key}
                onClick={() => onSelectCycle(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-4 border-2 p-4 transition-colors duration-300",
                  isActive ? "border-primary" : "border-border",
                )}
              >
                <span
                  className={cn(
                    "flex w-20 shrink-0 justify-center rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em]",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {control.key}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{control.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {control.detail}
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
