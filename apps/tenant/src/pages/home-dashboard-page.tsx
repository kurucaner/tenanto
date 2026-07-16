import { FileText, KeyRound, Users, Wallet, Wrench } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";

import { QuickActionCard } from "@/components/portal/quick-action-card";

const COMING_SOON_ACTIONS = [
  { icon: Wallet, label: "Pay rent" },
  { icon: Wrench, label: "Request maintenance" },
  { icon: Users, label: "Community" },
  { icon: FileText, label: "Documents" },
] as const;

export const HomeDashboardPage = memo(function HomeDashboardPage() {
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
