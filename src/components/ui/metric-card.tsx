import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  className?: string;
  tone?: "default" | "primary";
}

export function MetricCard({
  label,
  value,
  detail,
  className,
  tone = "default",
}: MetricCardProps) {
  const isPrimary = tone === "primary";
  return (
    <Card className={cn("p-5", isPrimary && "border-primary", className)}>
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.18em]",
          isPrimary ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {detail ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
      ) : null}
    </Card>
  );
}
