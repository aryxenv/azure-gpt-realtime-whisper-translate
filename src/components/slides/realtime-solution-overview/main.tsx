import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Badge } from "@/components/ui/badge";
import { SlideFrame } from "@/components/ui/slide-frame";
import { cn } from "@/lib/utils";

const realtimeDocsUrl =
  "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio";
const walkthroughUrl = "docs/realtime-technical-walkthrough.md";

const flow = [
  {
    title: "Browser mic",
    detail: "The presenter speaks directly into the deck.",
    summary:
      "Audio starts in the browser so the demo feels native to the deck.",
    stats: [
      ["Input", "Presenter microphone"],
      ["Format", "Small PCM chunks"],
      ["Why it matters", "No separate demo app"],
    ],
  },
  {
    title: "Webslides client",
    detail: "The slide streams small PCM audio chunks over WebSocket.",
    summary:
      "The React slide owns capture controls, transcript panes, and websocket state.",
    stats: [
      ["Role", "Capture and render"],
      ["Transport", "Local WebSocket"],
      ["Why it matters", "Presentation stays interactive"],
    ],
  },
  {
    title: "FastAPI proxy",
    detail:
      "The local server keeps Azure endpoint configuration out of the browser.",
    summary:
      "A thin local proxy keeps secrets server-side and normalizes realtime messages.",
    stats: [
      ["Role", "Secure server boundary"],
      ["Runtime", "Local FastAPI"],
      ["Why it matters", "No browser-exposed keys"],
    ],
  },
  {
    title: "Two model routes",
    detail:
      "Whisper handles transcription; Translate handles transcript plus translation.",
    summary:
      "The server chooses the route that matches the story: transcription or translation.",
    stats: [
      ["Whisper", "Live transcript"],
      ["Translate", "Source + translated text"],
      ["Why it matters", "Clean model positioning"],
    ],
  },
  {
    title: "Foundry realtime",
    detail: "Azure OpenAI in Foundry streams model events back to the server.",
    summary:
      "Foundry hosts the realtime model session and returns deltas as audio arrives.",
    stats: [
      ["Platform", "Azure OpenAI in Foundry"],
      ["Events", "Realtime deltas"],
      ["Why it matters", "Low-latency model feedback"],
    ],
  },
  {
    title: "Slide output",
    detail: "The deck renders exactly what each model streams back.",
    summary:
      "The audience sees the model output directly in the slide: text, translation, and state.",
    stats: [
      ["Transcription", "Transcript pane"],
      ["Translation", "Source + target panes"],
      ["Why it matters", "Proof inside the pitch"],
    ],
  },
];

type FlowStep = (typeof flow)[number];

export function RealtimeSolutionOverview() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<FlowStep | null>(null);

  return (
    <SlideFrame
      eyebrow="Solution overview"
      title="Two focused realtime model routes."
      titleClassName="lg:whitespace-normal"
    >
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:min-h-full lg:grid-cols-[0.85fr_1.15fr] lg:content-center">
        <div className="flex min-w-0 flex-col justify-center gap-4 sm:gap-5">
          <Badge variant="outline">High-level architecture</Badge>
          <p className="text-xl font-semibold leading-tight tracking-[-0.03em] sm:text-3xl">
            Give teams realtime captions and translation without moving audio
            through a complex app stack.
          </p>
          <p className="text-base leading-7 text-muted-foreground">
            The same pattern can power multilingual support, meetings, training,
            and field workflows with Azure OpenAI models in Microsoft Foundry.
          </p>
          <div className="space-y-1 text-xs leading-5 text-muted-foreground">
            <p>
              Source:{" "}
              <a
                className="underline underline-offset-4"
                href={realtimeDocsUrl}
                rel="noreferrer"
                target="_blank"
              >
                learn.microsoft.com/.../realtime-audio
              </a>
            </p>
            <p>
              Implementation:{" "}
              <a
                className="break-all underline underline-offset-4 sm:break-normal"
                href={walkthroughUrl}
                rel="noreferrer"
                target="_blank"
              >
                docs/realtime-technical-walkthrough.md
              </a>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:auto-rows-fr">
          {flow.map((step, index) => (
            <button
              key={step.title}
              className="grid h-full grid-cols-[2rem_1fr] items-start gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-line transition-colors duration-300 hover:border-primary focus-visible:border-primary focus-visible:outline-none sm:grid-cols-[2.25rem_1fr]"
              onClick={() => {
                setSelectedStep(step);
                setDetailsOpen(true);
              }}
              type="button"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground sm:h-9 sm:w-9">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{step.title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {step.detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <Dialog.Root open={detailsOpen} onOpenChange={setDetailsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            data-capture-shortcuts
            className="export-dialog-content fixed left-1/2 top-1/2 z-50 max-h-[min(620px,calc(100dvh-2rem))] w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-deck focus-visible:outline-none sm:p-6"
          >
            {selectedStep ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Dialog.Title className="text-2xl font-semibold tracking-[-0.03em]">
                      {selectedStep.title}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                      {selectedStep.summary}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close className="rounded-sm border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-muted">
                    Close
                  </Dialog.Close>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {selectedStep.stats.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border bg-card p-3"
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

                <div className="mt-5 rounded-lg border border-border bg-card p-4 shadow-line">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Flow position
                    </p>
                    <p className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      Step {flow.indexOf(selectedStep) + 1} of {flow.length}
                    </p>
                  </div>
                  <div className="relative mt-5">
                    <div className="absolute left-5 right-5 top-4 h-px bg-border" />
                    <div className="relative grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-6">
                      {flow.map((step, index) => {
                        const isSelected = step === selectedStep;

                        return (
                          <div
                            key={step.title}
                            className="flex min-w-0 flex-col items-center gap-2 text-center"
                          >
                            <span
                              className={cn(
                                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold shadow-line transition-colors",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-muted-foreground",
                              )}
                            >
                              {index + 1}
                            </span>
                            <span
                              className={cn(
                                "max-w-[5.8rem] text-[0.68rem] font-semibold leading-4",
                                isSelected
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {step.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
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
