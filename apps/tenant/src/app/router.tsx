import { createBrowserRouter } from "react-router-dom";

import { RootLayout } from "@/app/root-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { AcceptInvitePage } from "@/pages/accept-invite-page";
import { AccountPage } from "@/pages/account-page";
import { HomePage } from "@/pages/home-page";
import { LeasesPage } from "@/pages/leases-page";
import { LoginPage } from "@/pages/login-page";
import { RegisterPage } from "@/pages/register-page";
import { RegisterVerifyPage } from "@/pages/register-verify-page";

export const router = createBrowserRouter([
  {
    children: [
      { element: <HomePage />, index: true },
      { element: <AcceptInvitePage />, path: "accept-invite" },
      { element: <LoginPage />, path: "login" },
      { element: <RegisterPage />, path: "register" },
      { element: <RegisterVerifyPage />, path: "register/verify" },
      {
        children: [
          { element: <AccountPage />, path: "account" },
          { element: <LeasesPage />, path: "leases" },
        ],
        element: <ProtectedRoute />,
      },
    ],
    element: <RootLayout />,
    path: "/",
  },
]);
