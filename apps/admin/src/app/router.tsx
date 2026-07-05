import { createBrowserRouter, Navigate } from "react-router-dom";

import { RootLayout } from "@/app/root-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { ActivityPage } from "@/pages/activity-page";
import { ConfigPage } from "@/pages/config-page";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { SupportRequestsPage } from "@/pages/support-requests-page";
import { UserDetailPage } from "@/pages/user-detail-page";
import { UsersListPage } from "@/pages/users-list-page";

export const router = createBrowserRouter([
  {
    children: [
      { element: <LoginPage />, path: "login" },
      {
        children: [
          {
            children: [
              { element: <Navigate replace to="/home" />, index: true },
              { element: <HomePage />, path: "home" },
              { element: <ActivityPage />, path: "activity" },
              { element: <UsersListPage />, path: "users" },
              { element: <SupportRequestsPage />, path: "support-requests" },
              { element: <UserDetailPage />, path: "users/:userId" },
              { element: <ConfigPage />, path: "config" },
            ],
            element: <AdminLayout />,
          },
        ],
        element: <ProtectedRoute />,
      },
    ],
    element: <RootLayout />,
    path: "/",
  },
]);
