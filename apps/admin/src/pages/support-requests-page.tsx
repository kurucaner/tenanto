import { Plus } from "lucide-react";
import { memo, useState } from "react";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { CreateSupportRequestDialog } from "@/components/support/create-support-request-dialog";
import {
  ADMIN_SUPPORT_LIST_CONFIG,
  USER_SUPPORT_LIST_CONFIG,
} from "@/components/support/support-list-config";
import { SupportRequestsList } from "@/components/support/support-requests-list";
import { Button } from "@/components/ui/button";
import { UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export const SupportRequestsPage = memo(() => {
  const userType = useAuthStore((s) => s.user?.userType);
  const isAdmin = userType === UserType.ADMIN;
  const config = isAdmin ? ADMIN_SUPPORT_LIST_CONFIG : USER_SUPPORT_LIST_CONFIG;
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <AdminPageLayout
      intro={{
        ...config.intro,
        actions: isAdmin ? undefined : (
          <Button className="gap-2" onClick={() => setCreateOpen(true)} type="button">
            <Plus className="size-4" />
            New request
          </Button>
        ),
      }}
    >
      {isAdmin ? null : (
        <CreateSupportRequestDialog onOpenChange={setCreateOpen} open={createOpen} />
      )}
      <SupportRequestsList config={config} />
    </AdminPageLayout>
  );
});
SupportRequestsPage.displayName = "SupportRequestsPage";
