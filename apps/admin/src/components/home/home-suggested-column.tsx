import { ChevronRight } from "lucide-react";
import { memo } from "react";

import { HomeColumnPanel, HomeColumnRow } from "@/components/home/home-column-panel";
import { getHomeSuggestedNavItems } from "@/lib/home-suggested-nav-items";
import { UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export const HomeSuggestedColumn = memo(() => {
  const userType = useAuthStore((state) => state.user?.userType ?? UserType.USER);
  const suggestedItems = getHomeSuggestedNavItems(userType);

  if (suggestedItems.length === 0) {
    return <HomeColumnPanel emptyMessage="No suggestions available." title="Suggested" />;
  }

  return (
    <HomeColumnPanel title="Suggested">
      {suggestedItems.map((item) => {
        const Icon = item.icon;

        return (
          <HomeColumnRow href={item.href} key={item.href}>
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </HomeColumnRow>
        );
      })}
    </HomeColumnPanel>
  );
});
HomeSuggestedColumn.displayName = "HomeSuggestedColumn";
