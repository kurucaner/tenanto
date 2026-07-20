import "./index.css";

import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import { App } from "@/App";
import { QueryPersistProvider } from "@/components/query-persist-provider";
import { initDatadogRum } from "@/lib/datadog-rum";
import { syncDocumentTitle } from "@/lib/document-title";
import { AppThemeProvider, ThemeSync } from "@/packages/app-ui";

syncDocumentTitle();
initDatadogRum();

createRoot(document.getElementById("root")!).render(
  <AppThemeProvider appKey="admin">
    <QueryPersistProvider>
      <ThemeSync />
      <App />
      <Toaster position="bottom-right" theme="system" duration={6000} />
    </QueryPersistProvider>
  </AppThemeProvider>
);
