import "./index.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import { App } from "@/App";
import { syncDocumentTitle } from "@/lib/document-title";
import { queryClient } from "@/lib/query-client";
import { AppThemeProvider, ThemeSync } from "@/packages/app-ui";

syncDocumentTitle();

createRoot(document.getElementById("root")!).render(
  <AppThemeProvider appKey="tenant">
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <App />
      <Toaster position="bottom-right" theme="system" />
    </QueryClientProvider>
  </AppThemeProvider>
);
