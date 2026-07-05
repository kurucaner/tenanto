import { memo } from "react";
import { Navigate, Outlet } from "react-router-dom";

import type { UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

interface RequireRoleProps {
  roles: UserType[];
}

const RequireRoleInner = memo(({ roles }: RequireRoleProps) => {
  const user = useAuthStore((s) => s.user);

  if (!user || !roles.includes(user.userType)) {
    return <Navigate replace to="/home" />;
  }

  return <Outlet />;
});
RequireRoleInner.displayName = "RequireRoleInner";

export const RequireRole = RequireRoleInner;
