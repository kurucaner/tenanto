import { memo } from "react";

import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import { AuthPageShell as SharedAuthPageShell, type IAuthPageShellProps } from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

type TTenantAuthPageShellProps = Omit<
  IAuthPageShellProps,
  "brandLabel" | "isAuthenticated" | "isAuthHydrated" | "redirectWhenAuthed" | "surfaceClassName"
> & {
  redirectWhenAuthed?: string;
};

export const AuthPageShell = memo((props: TTenantAuthPageShellProps) => {
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const { redirectWhenAuthed = "/home", ...shellProps } = props;

  return (
    <SharedAuthPageShell
      {...shellProps}
      brandLabel="Resident portal"
      isAuthenticated={Boolean(accessToken && user)}
      isAuthHydrated={hydrated}
      redirectWhenAuthed={redirectWhenAuthed}
      surfaceClassName="app-surface"
    />
  );
});
AuthPageShell.displayName = "AuthPageShell";

export { AuthCardBody, AuthCardFooter } from "@/packages/app-ui";
