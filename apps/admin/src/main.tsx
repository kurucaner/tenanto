import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import { App } from "@/App";
import { AdminThemeSync } from "@/components/admin-theme-sync";
import { initDatadogRum } from "@/lib/datadog-rum";

initDatadogRum();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AdminThemeSync />
    <App />
    <Toaster position="top-center" richColors theme="system" />
  </QueryClientProvider>
);
