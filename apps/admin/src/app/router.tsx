import { createBrowserRouter, Navigate } from "react-router-dom";

import { RootLayout } from "@/app/root-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { RequireRole } from "@/components/require-role";
import { UserType } from "@/packages/shared";
import { ActivityPage } from "@/pages/activity-page";
import { ConfigPage } from "@/pages/config-page";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { PropertiesListPage } from "@/pages/properties-list-page";
import { PropertyDetailPage } from "@/pages/property-detail-page";
import { SupportRequestsPage } from "@/pages/support-requests-page";
import { UserDetailPage } from "@/pages/user-detail-page";
import { UsersListPage } from "@/pages/users-list-page";

const ADMIN_ONLY = [UserType.ADMIN];

export const router = createBrowserRouter([
  {
    children: [
      { element: <LoginPage />, path: "login" },
      {
        children: [
          {
            children: [
              { element: <Navigate replace to="/home" />, index: true },
              // Available to all authenticated users
              { element: <HomePage />, path: "home" },
              { element: <PropertiesListPage />, path: "properties" },
              { element: <PropertyDetailPage />, path: "properties/:propertyId" },
              // Admin-only routes
              {
                children: [
                  { element: <UsersListPage />, path: "users" },
                  { element: <UserDetailPage />, path: "users/:userId" },
                  { element: <SupportRequestsPage />, path: "support-requests" },
                  { element: <ActivityPage />, path: "activity" },
                  { element: <ConfigPage />, path: "config" },
                ],
                element: <RequireRole roles={ADMIN_ONLY} />,
              },
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
