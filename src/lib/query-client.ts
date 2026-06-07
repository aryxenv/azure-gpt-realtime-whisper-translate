import { QueryClient } from "@tanstack/react-query";

/** Shared TanStack Query client for all server calls made from slides. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});
