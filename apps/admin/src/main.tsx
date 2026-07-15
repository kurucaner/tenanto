import "./index.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import { App } from "@/App";
import { AdminThemeSync } from "@/components/admin-theme-sync";
import { initDatadogRum } from "@/lib/datadog-rum";
import { syncDocumentTitle } from "@/lib/document-title";
import { queryClient } from "@/lib/query-client";

syncDocumentTitle();
initDatadogRum();

// UptimeMesh.init('ef6a1e0e30dede2a8230f30606c7af678d995862408569349c92e1121893eb97');

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AdminThemeSync />
    <App />
    <Toaster position="bottom-right" theme="system" />
  </QueryClientProvider>
);
