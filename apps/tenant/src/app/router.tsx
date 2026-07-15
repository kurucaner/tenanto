import { createBrowserRouter } from "react-router-dom";

import { RootLayout } from "@/app/root-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { AccountPage } from "@/pages/account-page";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { RegisterPage } from "@/pages/register-page";
import { RegisterVerifyPage } from "@/pages/register-verify-page";

export const router = createBrowserRouter([
  {
    children: [
      { element: <HomePage />, index: true },
      { element: <LoginPage />, path: "login" },
      { element: <RegisterPage />, path: "register" },
      { element: <RegisterVerifyPage />, path: "register/verify" },
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
