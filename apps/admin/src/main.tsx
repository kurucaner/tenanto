import "./index.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { UptimeMesh } from 'uptimemesh-web';

import { App } from "@/App";
import { AdminThemeSync } from "@/components/admin-theme-sync";
import { initDatadogRum } from "@/lib/datadog-rum";
import { syncDocumentTitle } from "@/lib/document-title";
import { queryClient } from "@/lib/query-client";
import {
  LEGACY_RELEASE_NOTES_SEEN_STORAGE_KEY,
  RELEASE_NOTES_SEEN_STORAGE_KEY,
} from "@/lib/release-notes-preference";
import { migrateLocalStorageKey } from "@/packages/shared";

migrateLocalStorageKey(LEGACY_RELEASE_NOTES_SEEN_STORAGE_KEY, RELEASE_NOTES_SEEN_STORAGE_KEY);

syncDocumentTitle();
initDatadogRum();

UptimeMesh.init('ef6a1e0e30dede2a8230f30606c7af678d995862408569349c92e1121893eb97');


createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AdminThemeSync />
    <App />
    <Toaster position="top-center" richColors theme="system" />
  </QueryClientProvider>
);
