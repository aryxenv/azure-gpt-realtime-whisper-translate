import type { SlideProps } from "@/components/slides/types";
import { Card } from "@/components/ui/card";
import { SlideFrame } from "@/components/ui/slide-frame";
import { cn } from "@/lib/utils";

const workflow = [
  {
    title: "Start the client",
    detail: "Run the dev server so the deck is live locally.",
    command: "npm run dev",
  },
  {
    title: "Open it in GitHub Copilot App",
    detail: "Point Copilot at the running deck.",
    command: "localhost:5173",
  },
  {
    title: "Ask for the change",
    detail: "Describe the slide, demo, or layout you want.",
    command: '"Add a pricing demo slide"',
  },
  {
    title: "Review and iterate",
    detail: "Refine in the browser until it feels right.",
    command: '"Polish this for mobile"',
  },
];

const terminalLines = [
  { text: "$ npm run dev", muted: true },
  { text: "VITE ready  ·  localhost:5173", muted: false },
  { text: "› open the deck in GitHub Copilot App", muted: true },
  { text: '› "Create a new product demo slide"', muted: false },
  { text: "› iterate with Pick & Polish", muted: true },
];

export function AgentDrivenAuthoring({
  cycleIndex,
  onSelectCycle,
}: SlideProps) {
  return (
    <SlideFrame
      eyebrow="Agent-driven authoring"
      title="Customize the deck by asking for it."
    >
      <div className="grid grid-cols-1 gap-6 lg:h-full lg:min-h-0 lg:content-center lg:grid-cols-[0.85fr_1.15fr] lg:gap-8">
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="ml-2 text-xs font-medium text-muted-foreground">
              localhost
            </span>
          </div>
          <div className="space-y-3 p-5 font-mono text-sm leading-6">
            {terminalLines.map((line) => (
              <p
                key={line.text}
                className={line.muted ? "text-muted-foreground" : ""}
              >
                {line.text}
              </p>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          {workflow.map((item, index) => {
            const isActive = index === cycleIndex;

            return (
              <Card
                key={item.title}
                onClick={() => onSelectCycle(index)}
                className={cn(
                  "flex cursor-pointer items-start gap-4 border-2 p-4 transition-colors duration-300",
                  isActive ? "border-primary" : "border-border",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-semibold">{item.title}</p>
                    <code className="font-mono text-xs text-muted-foreground">
                      {item.command}
                    </code>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.detail}
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
