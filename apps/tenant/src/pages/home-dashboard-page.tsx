import { useQuery } from "@tanstack/react-query";
import { FileText, KeyRound, Users, Wallet, Wrench } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";

import { QuickActionCard } from "@/components/portal/quick-action-card";
import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { TenantLeaseListStatus } from "@/packages/shared";

const COMING_SOON_ACTIONS = [
  { icon: Wrench, label: "Request maintenance" },
  { icon: Users, label: "Community" },
  { icon: FileText, label: "Documents" },
] as const;

export const HomeDashboardPage = memo(function HomeDashboardPage() {
  const leasesQuery = useQuery({
    queryFn: () => tenantPortalApi.listLeases(TenantLeaseListStatus.ACTIVE),
    queryKey: queryKeys.leases("active"),
  });

  const firstLeaseId = leasesQuery.data?.leases[0]?.leaseId;
  const payRentHref = firstLeaseId ? `/leases/${firstLeaseId}` : "/leases";

  const showComingSoon = () => {
    toast.message("Coming soon");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Quick actions
        </h1>
        <p className="text-sm text-muted-foreground">Shortcuts for your resident portal.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <QuickActionCard href={payRentHref} icon={Wallet} label="Pay rent" />
        {COMING_SOON_ACTIONS.map((action) => (
          <QuickActionCard
            icon={action.icon}
            key={action.label}
            label={action.label}
            onClick={showComingSoon}
          />
        ))}
        <QuickActionCard href="/leases" icon={KeyRound} label="Leases" />
      </div>
    </div>
  );
});
HomeDashboardPage.displayName = "HomeDashboardPage";
