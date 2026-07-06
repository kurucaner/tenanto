import "./index.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import { App } from "@/App";
import { AdminThemeSync } from "@/components/admin-theme-sync";
import { initDatadogRum } from "@/lib/datadog-rum";
import { queryClient } from "@/lib/query-client";
import {
  LEGACY_RELEASE_NOTES_SEEN_STORAGE_KEY,
  RELEASE_NOTES_SEEN_STORAGE_KEY,
} from "@/lib/release-notes-preference";
import { migrateLocalStorageKey } from "@/packages/shared";

migrateLocalStorageKey(LEGACY_RELEASE_NOTES_SEEN_STORAGE_KEY, RELEASE_NOTES_SEEN_STORAGE_KEY);

initDatadogRum();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AdminThemeSync />
    <App />
    <Toaster position="top-center" richColors theme="system" />
  </QueryClientProvider>
);
