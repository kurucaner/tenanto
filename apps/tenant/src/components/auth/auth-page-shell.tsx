import { memo } from "react";

import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import {
  AuthCardBody,
  AuthCardFooter,
  AuthPageShell as SharedAuthPageShell,
  type IAuthPageShellProps,
} from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

type TTenantAuthPageShellProps = Omit<
  IAuthPageShellProps,
  "brandLabel" | "isAuthenticated" | "isAuthHydrated" | "redirectWhenAuthed" | "surfaceClassName"
>;

export const AuthPageShell = memo((props: TTenantAuthPageShellProps) => {
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  return (
    <SharedAuthPageShell
      {...props}
      brandLabel="Resident portal"
      isAuthenticated={Boolean(accessToken && user)}
      isAuthHydrated={hydrated}
      redirectWhenAuthed="/account"
      surfaceClassName="app-surface"
    />
  );
});
AuthPageShell.displayName = "AuthPageShell";

export { AuthCardBody, AuthCardFooter };
