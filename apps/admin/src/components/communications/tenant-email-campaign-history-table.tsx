import { memo, type ReactNode, type RefObject, useCallback, useMemo } from "react";

import { TenantEmailCampaignStatusBadge } from "@/components/communications/tenant-email-campaign-status-badge";
import { DataTable } from "@/components/data-table/data-table";
import { type DataTableColumn } from "@/components/data-table/data-table-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatTenantEmailCampaignDate } from "@/lib/tenant-email-campaign-utils";
import { type ITenantEmailCampaignListItem } from "@/packages/shared";

const CAMPAIGN_COLUMNS: DataTableColumn[] = [
  { id: "subject", label: "Subject" },
  { id: "status", label: "Status" },
  { id: "recipients", label: "Recipients" },
  { id: "sent", label: "Sent" },
  { id: "failed", label: "Failed" },
  { id: "sentAt", label: "Sent at" },
];

const CAMPAIGN_ROW_ESTIMATED_HEIGHT = 52;

function getCampaignKey(campaign: ITenantEmailCampaignListItem): string {
  return campaign.id;
}

const TenantEmailCampaignRow = memo(
  ({
    campaign,
    onSelectCampaign,
  }: {
    campaign: ITenantEmailCampaignListItem;
    onSelectCampaign: (campaignId: string) => void;
  }) => (
    <TableRow className="cursor-pointer" onClick={() => onSelectCampaign(campaign.id)}>
      <TableCell className="max-w-xs truncate font-medium">{campaign.subject}</TableCell>
      <TableCell>
        <TenantEmailCampaignStatusBadge status={campaign.status} />
      </TableCell>
      <TableCell>{campaign.recipientCount}</TableCell>
      <TableCell>{campaign.sentCount}</TableCell>
      <TableCell>{campaign.failedCount}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatTenantEmailCampaignDate(campaign.createdAt)}
      </TableCell>
    </TableRow>
  )
);
TenantEmailCampaignRow.displayName = "TenantEmailCampaignRow";

interface ITenantEmailCampaignHistoryTableProps {
  campaigns: ITenantEmailCampaignListItem[];
  hasNextPage: boolean;
  hasSearchQuery: boolean;
  isFetchingNextPage: boolean;
  isPending: boolean;
  isRefreshing: boolean;
  onSelectCampaign: (campaignId: string) => void;
  scrollSentinelRef: RefObject<HTMLDivElement | null>;
  toolbar: ReactNode;
}

export const TenantEmailCampaignHistoryTable = memo(
  ({
    campaigns,
    hasNextPage,
    hasSearchQuery,
    isFetchingNextPage,
    isPending,
    isRefreshing,
    onSelectCampaign,
    scrollSentinelRef,
    toolbar,
  }: ITenantEmailCampaignHistoryTableProps) => {
    const emptyMessage = hasSearchQuery
      ? "No campaigns match your search."
      : "No notifications sent yet.";

    const renderCampaignRow = useCallback(
      (campaign: ITenantEmailCampaignListItem) => (
        <TenantEmailCampaignRow
          campaign={campaign}
          key={campaign.id}
          onSelectCampaign={onSelectCampaign}
        />
      ),
      [onSelectCampaign]
    );

    const columns = useMemo(() => CAMPAIGN_COLUMNS, []);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            emptyMessage={emptyMessage}
            getItemKey={getCampaignKey}
            infiniteScroll={{ hasNextPage, isFetchingNextPage }}
            infiniteScrollSentinelRef={scrollSentinelRef}
            isPending={isPending}
            isRefreshing={isRefreshing}
            items={campaigns}
            renderRow={renderCampaignRow}
            toolbar={toolbar}
            virtualization={{ estimateRowHeight: CAMPAIGN_ROW_ESTIMATED_HEIGHT }}
          />
        </CardContent>
      </Card>
    );
  }
);
TenantEmailCampaignHistoryTable.displayName = "TenantEmailCampaignHistoryTable";
