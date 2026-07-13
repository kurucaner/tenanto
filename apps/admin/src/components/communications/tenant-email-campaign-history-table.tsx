import { memo } from "react";

import { TenantEmailCampaignStatusBadge } from "@/components/communications/tenant-email-campaign-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTenantEmailCampaignDate } from "@/lib/tenant-email-campaign-utils";
import { type ITenantEmailCampaign } from "@/packages/shared";

interface ITenantEmailCampaignHistoryTableProps {
  campaigns: ITenantEmailCampaign[];
  onSelectCampaign: (campaignId: string) => void;
}

export const TenantEmailCampaignHistoryTable = memo(
  ({ campaigns, onSelectCampaign }: ITenantEmailCampaignHistoryTableProps) => {
    if (campaigns.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No notifications sent yet.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Sent at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow
                  className="cursor-pointer"
                  key={campaign.id}
                  onClick={() => onSelectCampaign(campaign.id)}
                >
                  <TableCell className="max-w-xs truncate font-medium">
                    {campaign.subject}
                  </TableCell>
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }
);
TenantEmailCampaignHistoryTable.displayName = "TenantEmailCampaignHistoryTable";
