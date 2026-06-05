/**
 * Uygulama genel provider'ları: react-query, tooltip ve toast.
 */

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/presentation/components/ui/tooltip";
import { Toaster } from "@/presentation/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
