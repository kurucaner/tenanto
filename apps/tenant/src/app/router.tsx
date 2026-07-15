import { createBrowserRouter } from "react-router-dom";

import { RootLayout } from "@/app/root-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { AccountPage } from "@/pages/account-page";
import { HomePage } from "@/pages/home-page";

export const router = createBrowserRouter([
  {
    children: [
      { element: <HomePage />, index: true },
      {
        children: [{ element: <AccountPage />, index: true }],
        element: <ProtectedRoute />,
        path: "account",
      },
    ],
    element: <RootLayout />,
    path: "/",
  },
]);
