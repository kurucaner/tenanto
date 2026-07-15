import "./index.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { queryClient } from "@/lib/query-client";
import { AppThemeProvider, ThemeSync } from "@/packages/app-ui";

createRoot(document.getElementById("root")!).render(
  <AppThemeProvider appKey="tenant">
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <App />
    </QueryClientProvider>
  </AppThemeProvider>
);
