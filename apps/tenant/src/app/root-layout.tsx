import { Outlet } from "react-router-dom";

import { DocumentTitleSync } from "@/components/document-title-sync";
import { SessionSync } from "@/components/session-sync";

export const RootLayout = () => (
  <>
    <DocumentTitleSync />
    <SessionSync />
    <Outlet />
  </>
);
