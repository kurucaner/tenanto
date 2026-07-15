import { Outlet } from "react-router-dom";

import { SessionSync } from "@/components/session-sync";

export const RootLayout = () => (
  <>
    <SessionSync />
    <Outlet />
  </>
);
