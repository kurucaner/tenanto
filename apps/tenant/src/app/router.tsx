import { createBrowserRouter } from "react-router-dom";

import { RootLayout } from "@/app/root-layout";
import { PortalLayout } from "@/components/portal/portal-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { AcceptInvitePage } from "@/pages/accept-invite-page";
import { AccountPage } from "@/pages/account-page";
import { ErrorPage } from "@/pages/error-page";
import { HomePage } from "@/pages/home-page";
import { LeasesPage } from "@/pages/leases-page";
import { LoginPage } from "@/pages/login-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { PendingInvitesPage } from "@/pages/pending-invites-page";
import { RegisterPage } from "@/pages/register-page";
import { RegisterVerifyPage } from "@/pages/register-verify-page";

export const router = createBrowserRouter([
  {
    children: [
      { element: <HomePage />, handle: { title: "Welcome" }, index: true },
      { element: <AcceptInvitePage />, handle: { title: "Accept invitation" }, path: "accept-invite" },
      { element: <LoginPage />, handle: { title: "Sign in" }, path: "login" },
      { element: <RegisterPage />, handle: { title: "Create account" }, path: "register" },
      {
        element: <RegisterVerifyPage />,
        handle: { title: "Verify email" },
        path: "register/verify",
      },
      {
        children: [
          {
            children: [
              { element: <LeasesPage />, handle: { title: "Your leases" }, path: "leases" },
              {
                element: <PendingInvitesPage />,
                handle: { title: "Pending invites" },
                path: "invites/pending",
              },
              { element: <AccountPage />, handle: { title: "Account" }, path: "account" },
              { element: <NotFoundPage />, path: "*" },
            ],
            element: <PortalLayout />,
          },
        ],
        element: <ProtectedRoute />,
      },
      { element: <NotFoundPage />, path: "*" },
    ],
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    path: "/",
  },
]);
