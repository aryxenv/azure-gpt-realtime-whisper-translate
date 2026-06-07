import { QueryClientProvider } from "@tanstack/react-query";
import { Presentation } from "@/Presentation";
import { queryClient } from "@/lib/query-client";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Presentation />
    </QueryClientProvider>
  );
}
