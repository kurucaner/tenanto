import { memo, type ReactNode } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type UrlTabDefinition } from "@/lib/url-tab-state";

export type UrlSyncedTabsProps<T extends string> = {
  activeTab: T;
  children: ReactNode;
  listClassName?: string;
  onTabChange: (tab: T) => void;
  tabs: readonly UrlTabDefinition<T>[];
};

function UrlSyncedTabsInner<T extends string>({
  activeTab,
  children,
  listClassName,
  onTabChange,
  tabs,
}: UrlSyncedTabsProps<T>) {
  return (
    <Tabs onValueChange={(value) => onTabChange(value as T)} value={activeTab}>
      <TabsList className={listClassName}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

const MemoizedUrlSyncedTabs = memo(UrlSyncedTabsInner);
MemoizedUrlSyncedTabs.displayName = "UrlSyncedTabs";

export const UrlSyncedTabs = MemoizedUrlSyncedTabs as typeof UrlSyncedTabsInner;

export { TabsContent as UrlSyncedTabsContent } from "@/components/ui/tabs";
