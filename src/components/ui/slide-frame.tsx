import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { ServerHealthDot } from "@/components/ui/server-health-dot";

interface SlideFrameProps {
  eyebrow?: string;
  eyebrowAdornment?: ReactNode;
  challenge?: string;
  title: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function SlideFrame({
  eyebrow,
  eyebrowAdornment,
  challenge,
  title,
  children,
  className,
  titleClassName,
}: SlideFrameProps) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden bg-background px-5 pt-6 text-foreground sm:px-8 sm:pt-8 lg:px-14 lg:pt-12",
        className,
      )}
    >
      <header className="shrink-0 border-b border-border pb-6 sm:pb-8">
        {eyebrow ? (
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex flex-row items-center gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:text-sm sm:tracking-[0.22em]">
                {challenge ? (
                  <>
                    <span>{`Challenge ${challenge}`}</span>
                    <span className="mx-2 text-primary/50">&middot;</span>
                  </>
                ) : null}
                {eyebrow}
              </p>
              <ServerHealthDot />
              {eyebrowAdornment}
            </div>
            <BrandLockup />
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 lg:grid-cols-1 lg:items-end">
          <h1
            className={cn(
              "max-w-none text-3xl font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-4xl lg:whitespace-nowrap lg:text-5xl xl:text-6xl",
              titleClassName,
            )}
          >
            {title}
          </h1>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pt-6 sm:pt-8 lg:overflow-hidden">
        <div className="pb-5 sm:pb-8 lg:h-full lg:pb-0">{children}</div>
      </div>
    </section>
  );
}
