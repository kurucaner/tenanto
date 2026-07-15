import { memo } from "react";

import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import {
  AuthCardBody,
  AuthCardFooter,
  AuthPageShell as SharedAuthPageShell,
  type IAuthPageShellProps,
} from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

type TAdminAuthPageShellProps = Omit<
  IAuthPageShellProps,
  "brandLabel" | "isAuthenticated" | "isAuthHydrated" | "redirectWhenAuthed" | "surfaceClassName"
>;

export const AuthPageShell = memo((props: TAdminAuthPageShellProps) => {
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  return (
    <SharedAuthPageShell
      {...props}
      brandLabel="Workspace"
      isAuthenticated={Boolean(accessToken && user)}
      isAuthHydrated={hydrated}
      redirectWhenAuthed="/home"
      surfaceClassName="admin-app-surface"
    />
  );
});
AuthPageShell.displayName = "AuthPageShell";

export { AuthCardBody, AuthCardFooter };
