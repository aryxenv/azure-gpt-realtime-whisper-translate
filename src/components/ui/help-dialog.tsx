import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const controls = [
  {
    id: "arrows",
    keys: ["←", "→"],
    title: "Move through slides",
    description:
      "Use the arrow keys or the Previous and Next buttons to step through the deck.",
  },
  {
    id: "space",
    keys: ["Space"],
    title: "Cycle inside a slide",
    description:
      "Some slides highlight or reveal local elements. Press Space to advance those in-slide states.",
  },
  {
    id: "scroll",
    keys: ["Scroll"],
    title: "Read overflow content",
    description:
      "If a slide is taller than the viewport, scroll inside the slide. Scrollbars stay hidden for presentation mode.",
  },
  {
    id: "swipe",
    keys: ["Swipe"],
    title: "Navigate on mobile",
    description:
      "On phone-sized screens, swipe left or right to move between slides.",
  },
];

function HelpIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.75 9a2.25 2.25 0 1 1 3.7 1.72c-.82.67-1.45 1.18-1.45 2.28v.25M12 17.25h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function Keycap({ children }: { children: string }) {
  const isWide = children.length > 1;

  return (
    <span
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground shadow-line",
        isWide ? "min-w-16" : "min-w-8",
      )}
    >
      {children}
    </span>
  );
}

export function HelpDialog({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          aria-label="Open presentation help"
          className={cn("h-8 w-8 p-0", className)}
          size="sm"
          type="button"
          variant="outline"
        >
          <HelpIcon />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          data-capture-shortcuts
          className="export-dialog-content fixed left-1/2 top-1/2 z-50 max-h-[min(680px,calc(100dvh-2rem))] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-deck focus-visible:outline-none sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Dialog.Title className="text-xl font-semibold tracking-[-0.02em]">
                Presentation controls
              </Dialog.Title>
              <Dialog.Description className="text-sm leading-6 text-muted-foreground">
                Quick reference for navigating and presenting this deck.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                aria-label="Close presentation help"
                size="sm"
                type="button"
                variant="quiet"
              >
                Close
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-3">
            {controls.map((control) => (
              <article
                className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-line sm:grid-cols-[10rem_1fr] sm:items-start"
                key={control.id}
              >
                <div className="flex flex-wrap gap-2">
                  {control.keys.map((key) => (
                    <Keycap key={key}>{key}</Keycap>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground">
                    {control.title}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {control.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
