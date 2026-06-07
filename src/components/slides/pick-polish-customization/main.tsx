import type { SlideProps } from "@/components/slides/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SlideFrame } from "@/components/ui/slide-frame";
import { cn } from "@/lib/utils";

const uiLayers = [
  {
    title: "components/ui",
    detail: "Shared frame, cards, badges, and buttons.",
  },
  {
    title: "index.css",
    detail: "Monochrome tokens for color, borders, and accents.",
  },
  {
    title: "components/slides",
    detail: "Self-contained slide folders in deck order.",
  },
];

const polishSteps = [
  "Select an element in GitHub Copilot App.",
  "Describe the change in plain language.",
  "Review locally and keep iterating.",
];

export function PickPolishCustomization({
  cycleIndex,
  onSelectCycle,
}: SlideProps) {
  return (
    <SlideFrame
      eyebrow="Customization system"
      title="Pick, polish, and keep control."
    >
      <div className="grid grid-cols-1 gap-6 lg:h-full lg:min-h-0 lg:content-center lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Shared design system
          </p>
          {uiLayers.map((layer, index) => {
            const isActive = index === cycleIndex;

            return (
              <Card
                key={layer.title}
                onClick={() => onSelectCycle(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-4 border-2 p-4 transition-colors duration-300",
                  isActive ? "border-primary" : "border-border",
                )}
              >
                <Badge variant={isActive ? "default" : "outline"}>
                  {layer.title}
                </Badge>
                <p className="min-w-0 text-sm text-muted-foreground">
                  {layer.detail}
                </p>
              </Card>
            );
          })}
        </div>

        <Card className="flex flex-col overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Pick &amp; Polish
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-4 p-5">
            <div className="rounded-lg border-2 border-dashed border-primary p-4">
              <p className="text-lg font-semibold tracking-[-0.02em]">
                Selected slide element
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Target one card or section instead of rewriting the slide.
              </p>
            </div>
            <div className="grid gap-2">
              {polishSteps.map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    {index + 1}
                  </span>
                  <p className="text-sm text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-auto border-t border-border pt-4 text-sm font-semibold">
              The limit goes beyond the sky.
            </p>
          </div>
        </Card>
      </div>
    </SlideFrame>
  );
}
