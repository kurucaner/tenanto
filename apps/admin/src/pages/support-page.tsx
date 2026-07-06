import { memo } from "react";

import { UserType } from "@/packages/shared";
import { SupportRequestsPage } from "@/pages/support-requests-page";
import { UserSupportPage } from "@/pages/user-support-page";
import { useAuthStore } from "@/stores/auth-store";

const SupportPageInner = memo(() => {
  const userType = useAuthStore((s) => s.user?.userType);

  if (userType === UserType.ADMIN) {
    return <SupportRequestsPage />;
  }

  return <UserSupportPage />;
});
SupportPageInner.displayName = "SupportPageInner";

export const SupportPage = SupportPageInner;
