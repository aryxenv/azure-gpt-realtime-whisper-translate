import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

type Resolved = "ok" | "error";

/** A small live status dot for the slide eyebrow. Shares the ["health"] query
 * with ServerHealthCard (one cached result, no duplicate requests).
 *
 * The dot color reflects only the last *settled* result. It checks the server
 * once on load (refresh to re-check); the ServerHealthCard's "Call again"
 * button can also trigger a fresh check via the shared ["health"] query. */
export function ServerHealthDot() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => fetchHealth(signal),
  });

  const state: "loading" | Resolved = health.isSuccess
    ? "ok"
    : health.isError
      ? "error"
      : "loading";

  const dot = {
    loading: "bg-muted-foreground animate-pulse",
    error: "bg-red-500",
    ok: "bg-green-500",
  }[state];

  const label = {
    loading: "Checking server…",
    error: "Server unavailable",
    ok: "Server healthy",
  }[state];

  return (
    <span
      title={label}
      aria-label={label}
      className={cn("h-2 w-2 shrink-0 rounded-full", dot)}
    />
  );
}
