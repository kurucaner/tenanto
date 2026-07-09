import { createBrowserRouter, Navigate } from "react-router-dom";

import { RootLayout } from "@/app/root-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import { PropertyShellLayout } from "@/components/properties/property-page-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { RequireRole } from "@/components/require-role";
import { UserType } from "@/packages/shared";
import { ActivityPage } from "@/pages/activity-page";
import { ConfigPage } from "@/pages/config-page";
import { ErrorPage } from "@/pages/error-page";
import { ForgotPasswordPage } from "@/pages/forgot-password-page";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { PropertiesListPage } from "@/pages/properties-list-page";
import { PropertyDetailPage } from "@/pages/property-detail-page";
import { PropertyExpensesPage } from "@/pages/property-expenses-page";
import { PropertyIncomePage } from "@/pages/property-income-page";
import { PropertyLeaseDetailPage } from "@/pages/property-lease-detail-page";
import { PropertyLeasesPage } from "@/pages/property-leases-page";
import { PropertyReportsPage } from "@/pages/property-reports-page";
import { PropertySettingsPage } from "@/pages/property-settings-page";
import { PropertyUnitsPage } from "@/pages/property-units-page";
import { ReportsPage } from "@/pages/reports-page";
import { ResetPasswordPage } from "@/pages/reset-password-page";
import { SignUpPage } from "@/pages/sign-up-page";
import { SignUpVerifyPage } from "@/pages/sign-up-verify-page";
import { SupportRequestDetailPage } from "@/pages/support-request-detail-page";
import { SupportRequestsPage } from "@/pages/support-requests-page";
import { UserDetailPage } from "@/pages/user-detail-page";
import { UsersListPage } from "@/pages/users-list-page";

const ADMIN_ONLY = [UserType.ADMIN];

export const router = createBrowserRouter([
  {
    children: [
      { element: <LoginPage />, path: "login" },
      { element: <SignUpPage />, path: "signup" },
      { element: <SignUpVerifyPage />, path: "signup/verify" },
      { element: <ForgotPasswordPage />, path: "forgot-password" },
      { element: <ResetPasswordPage />, path: "reset-password" },
      {
        children: [
          {
            children: [
              { element: <Navigate replace to="/home" />, index: true },
              // Available to all authenticated users
              { element: <HomePage />, path: "home" },
              { element: <PropertiesListPage />, path: "properties" },
              { element: <ReportsPage />, path: "reports" },
              { element: <SupportRequestsPage />, path: "support-requests" },
              { element: <SupportRequestDetailPage />, path: "support-requests/:supportRequestId" },
              {
                children: [
                  { element: <PropertyDetailPage />, index: true },
                  { element: <PropertyUnitsPage />, path: "units" },
                  { element: <PropertyLeasesPage />, path: "leases" },
                  { element: <PropertyLeaseDetailPage />, path: "leases/:leaseId" },
                  { element: <PropertyIncomePage />, path: "income" },
                  { element: <PropertyExpensesPage />, path: "expenses" },
                  { element: <PropertyReportsPage />, path: "reports" },
                  { element: <PropertySettingsPage />, path: "settings" },
                ],
                element: <PropertyShellLayout />,
                path: "properties/:propertyId",
              },
              // Admin-only routes
              {
                children: [
                  { element: <UsersListPage />, path: "users" },
                  { element: <UserDetailPage />, path: "users/:userId" },
                  { element: <ActivityPage />, path: "activity" },
                  { element: <ConfigPage />, path: "config" },
                ],
                element: <RequireRole roles={ADMIN_ONLY} />,
              },
              { element: <NotFoundPage />, path: "*" },
            ],
            element: <AdminLayout />,
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
