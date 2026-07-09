import { memo } from "react";

import { Separator } from "@/components/ui/separator";

export const AuthProviderDivider = memo(() => (
  <div className="flex items-center gap-3">
    <Separator className="flex-1" />
    <span className="text-muted-foreground text-xs uppercase tracking-wide">or</span>
    <Separator className="flex-1" />
  </div>
));
AuthProviderDivider.displayName = "AuthProviderDivider";
