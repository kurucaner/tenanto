import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { memo } from "react";

import { TenantEmailCampaignStatusBadge } from "@/components/communications/tenant-email-campaign-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tenantEmailCampaignsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatTenantEmailCampaignDate } from "@/lib/tenant-email-campaign-utils";
import { TenantEmailRecipientStatus } from "@/packages/shared";

interface ITenantEmailCampaignDetailSheetProps {
  campaignId: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const TenantEmailCampaignDetailSheet = memo(
  ({ campaignId, onOpenChange, open, propertyId }: ITenantEmailCampaignDetailSheetProps) => {
    const detailQuery = useQuery({
      enabled: open && campaignId != null,
      queryFn: () => tenantEmailCampaignsApi.get(propertyId, campaignId!),
      queryKey:
        campaignId == null
          ? queryKeys.propertyTenantEmailCampaign(propertyId, "missing")
          : queryKeys.propertyTenantEmailCampaign(propertyId, campaignId),
    });

    const detail = detailQuery.data;

    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Campaign details</SheetTitle>
            <SheetDescription>
              Delivery status for each tenant included in this notification.
            </SheetDescription>
          </SheetHeader>

          {detailQuery.isPending ? (
            <div className="flex items-center gap-2 py-8 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading campaign…
            </div>
          ) : detailQuery.isError || detail == null ? (
            <p className="text-destructive py-8 text-sm">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Campaign not found"}
            </p>
          ) : (
            <div className="space-y-4 px-4 pb-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TenantEmailCampaignStatusBadge status={detail.campaign.status} />
                  <span className="text-muted-foreground text-xs">
                    {formatTenantEmailCampaignDate(detail.campaign.createdAt)}
                  </span>
                </div>
                <p className="font-medium">{detail.campaign.subject}</p>
                <p className="text-muted-foreground text-sm">
                  {detail.campaign.sentCount} sent · {detail.campaign.failedCount} failed ·{" "}
                  {detail.campaign.skippedCount} skipped
                </p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{recipient.tenantName}</p>
                          <p className="text-muted-foreground text-xs capitalize">
                            {recipient.tenantRole}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{recipient.email || "—"}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant={
                              recipient.status === TenantEmailRecipientStatus.FAILED
                                ? "destructive"
                                : recipient.status === TenantEmailRecipientStatus.SENT
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {recipient.status}
                          </Badge>
                          {recipient.lastError ? (
                            <p className="text-destructive text-xs">{recipient.lastError}</p>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }
);
TenantEmailCampaignDetailSheet.displayName = "TenantEmailCampaignDetailSheet";
