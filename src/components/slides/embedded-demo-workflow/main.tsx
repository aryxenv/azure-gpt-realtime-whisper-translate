import { useState } from "react";
import type { SlideProps } from "@/components/slides/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SlideFrame } from "@/components/ui/slide-frame";
import { cn } from "@/lib/utils";
import { ServerHealthCard } from "./components/server-health-card";

const demoFiles = [
  "components/slides/your_demo_slide/main.tsx",
  "components/slides/your_demo_slide/components/panel.tsx",
  "components/slides/your_demo_slide/data/sample.ts",
];

const modes = ["Prototype", "Demo", "Narrative"];

function activeBorder(isActive: boolean) {
  return isActive ? "border-primary" : "border-border";
}

export function EmbeddedDemoWorkflow({
  cycleIndex,
  onSelectCycle,
}: SlideProps) {
  const [mode, setMode] = useState(modes[0]);

  return (
    <SlideFrame
      eyebrow="Embedded demo workflow"
      title="Demos live inside the presentation."
    >
      <div className="grid grid-cols-1 gap-6 lg:h-full lg:min-h-0 lg:content-center lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            onClick={() => onSelectCycle(0)}
            className={cn(
              "cursor-pointer border-2 p-5 transition-colors duration-300",
              activeBorder(cycleIndex === 0),
            )}
          >
            <Badge variant={cycleIndex === 0 ? "default" : "outline"}>
              @your_demo_slide
            </Badge>
            <p className="mt-4 text-xl font-semibold tracking-[-0.02em]">
              Drop a folder in, reference it in Copilot.
            </p>
            <div className="mt-3 space-y-1 font-mono text-xs text-muted-foreground">
              {demoFiles.map((file) => (
                <p key={file} className="truncate">
                  {file}
                </p>
              ))}
            </div>
          </Card>

          <Card
            onClick={() => onSelectCycle(2)}
            className={cn(
              "cursor-pointer border-2 p-5 transition-colors duration-300",
              activeBorder(cycleIndex === 2),
            )}
          >
            <p className="text-sm font-semibold">Server-backed demos</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Need server logic? Copilot moves it into a server folder and
              exposes a route the slide calls from the client.
            </p>
          </Card>

          <ServerHealthCard
            isActive={cycleIndex === 3}
            onSelect={() => onSelectCycle(3)}
          />
        </div>

        <Card
          onClick={() => onSelectCycle(1)}
          className={cn(
            "flex cursor-pointer flex-col overflow-hidden border-2 transition-colors duration-300",
            activeBorder(cycleIndex === 1),
          )}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border p-4">
            <p className="font-semibold tracking-[-0.02em]">
              Embedded app fragment
            </p>
            <Badge variant="muted">{mode}</Badge>
          </div>
          <div className="flex flex-1 flex-col gap-5 p-5">
            <div className="grid grid-cols-3 gap-2">
              {modes.map((item) => (
                <Button
                  key={item}
                  onClick={() => setMode(item)}
                  size="sm"
                  type="button"
                  variant={mode === item ? "default" : "outline"}
                >
                  {item}
                </Button>
              ))}
            </div>
            <div className="grid gap-2 rounded-lg border border-border bg-muted p-4">
              {modes.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-muted-foreground">
                    {item}
                  </span>
                  <span className="h-2 flex-1 rounded-sm bg-background">
                    <span
                      className={cn(
                        "block h-2 rounded-sm bg-foreground transition-all duration-500",
                        mode === item ? "w-full" : "w-1/3",
                      )}
                    />
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Real controls keep working — deck navigation ignores inputs and
              interactive elements.
            </p>
          </div>
        </Card>
      </div>
    </SlideFrame>
  );
}
