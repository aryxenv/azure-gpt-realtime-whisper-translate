import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { describeServerError, fetchHealth, SERVER_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ServerHealthCardProps {
  isActive: boolean;
  onSelect: () => void;
}

/** Live demo: a slide calling the FastAPI server's GET /health route through
 * TanStack Query. This is a self-contained example of server-backed content. */
export function ServerHealthCard({
  isActive,
  onSelect,
}: ServerHealthCardProps) {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => fetchHealth(signal),
  });

  const state: "loading" | "error" | "ok" = health.isPending
    ? "loading"
    : health.isError
      ? "error"
      : "ok";

  const dot = {
    loading: "bg-muted-foreground animate-pulse",
    error: "bg-red-500",
    ok: "bg-foreground",
  }[state];

  const message =
    state === "loading"
      ? "Calling /health…"
      : state === "error"
        ? describeServerError(health.error)
        : (health.data?.status ?? "No status returned");

  return (
    <Card
      onClick={onSelect}
      className={cn(
        "cursor-pointer border-2 p-5 transition-colors duration-300",
        isActive ? "border-primary" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Live server call</p>
        <Badge variant="muted">GET /health</Badge>
      </div>

      <div className="mt-3 flex items-start gap-2 font-mono text-xs">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot)} />
        <span
          className={cn(
            "min-w-0 break-words leading-5",
            state === "error" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {message}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {SERVER_URL}
        </span>
        <Button
          onClick={(event) => {
            event.stopPropagation();
            health.refetch();
          }}
          disabled={health.isFetching}
          size="sm"
          type="button"
          variant="outline"
        >
          {health.isFetching ? "Calling…" : "Call again"}
        </Button>
      </div>
    </Card>
  );
}
