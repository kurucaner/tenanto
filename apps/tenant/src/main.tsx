import "./index.css";

import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { AppThemeProvider, ThemeSync } from "@/packages/app-ui";

createRoot(document.getElementById("root")!).render(
  <AppThemeProvider appKey="tenant">
    <ThemeSync />
    <App />
  </AppThemeProvider>
);
