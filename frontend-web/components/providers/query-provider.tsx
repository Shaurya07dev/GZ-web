"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mounted once in the root layout (app/layout.tsx) so every useQuery/
// useMutation hook across every track (Auth, Marketplace, Aggregator) shares
// one cache — this is infrastructure the SAD §5.3/§5.4 data-fetching pattern
// assumes exists but no earlier task actually wired up. The QueryClient is
// created lazily inside useState so it is instantiated exactly once per
// browser session rather than on every render, per TanStack Query's official
// Next.js App Router guidance (a fresh client per render would drop the
// cache and refetch everything on every re-render).
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
