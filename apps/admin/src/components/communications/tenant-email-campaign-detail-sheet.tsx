import { useQuery } from "@tanstack/react-query";
import { type VariantProps } from "class-variance-authority";
import { AlertTriangle, Loader2 } from "lucide-react";
import { memo, type ReactNode } from "react";

import { TenantEmailCampaignStatusBadge } from "@/components/communications/tenant-email-campaign-status-badge";
import { Badge, type badgeVariants } from "@/components/ui/badge";
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
import {
  type ITenantEmailCampaignDetailResponse,
  TenantEmailRecipientStatus,
  type TTenantEmailRecipientStatus,
} from "@/packages/shared";

type TRecipientStatusBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function getRecipientStatusBadgeVariant(
  status: TTenantEmailRecipientStatus
): TRecipientStatusBadgeVariant {
  if (status === TenantEmailRecipientStatus.FAILED) {
    return "destructive";
  }
  if (status === TenantEmailRecipientStatus.SENT) {
    return "secondary";
  }
  return "outline";
}

function getCampaignDetailErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Campaign not found";
}

interface ITenantEmailCampaignDetailSheetProps {
  campaignId: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

function compareRecipientRows(
  left: ITenantEmailCampaignDetailResponse["recipients"][number],
  right: ITenantEmailCampaignDetailResponse["recipients"][number]
): number {
  const priority = (status: TTenantEmailRecipientStatus): number => {
    if (status === TenantEmailRecipientStatus.FAILED) {
      return 0;
    }
    if (status === TenantEmailRecipientStatus.SKIPPED) {
      return 1;
    }
    return 2;
  };

  const leftPriority = priority(left.status);
  const rightPriority = priority(right.status);
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.tenantName.localeCompare(right.tenantName);
}

function renderCampaignDetailContent(detail: ITenantEmailCampaignDetailResponse) {
  const failedRecipients = detail.recipients.filter(
    (recipient) => recipient.status === TenantEmailRecipientStatus.FAILED
  );
  const sortedRecipients = [...detail.recipients].sort(compareRecipientRows);

  return (
    <div className="space-y-4 px-4 pb-6">
      {detail.campaign.failedCount > 0 ? (
        <div className="border-destructive/50 bg-destructive/10 text-destructive flex gap-3 rounded-lg border p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Failed deliveries</p>
            <p className="text-destructive/90">
              {detail.campaign.failedCount} recipient
              {detail.campaign.failedCount === 1 ? "" : "s"} could not be delivered. Review the
              error messages below{failedRecipients.length > 0 ? " (shown first)" : ""}.
            </p>
          </div>
        </div>
      ) : null}

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
          {sortedRecipients.map((recipient) => (
            <TableRow key={recipient.id}>
              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium">{recipient.tenantName}</p>
                  <p className="text-muted-foreground text-xs capitalize">{recipient.tenantRole}</p>
                </div>
              </TableCell>
              <TableCell className="text-sm">{recipient.email || "—"}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Badge variant={getRecipientStatusBadgeVariant(recipient.status)}>
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
  );
}

function renderSheetBody(detailQuery: {
  data: ITenantEmailCampaignDetailResponse | undefined;
  error: unknown;
  isError: boolean;
  isPending: boolean;
}): ReactNode {
  if (detailQuery.isPending) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading campaign…
      </div>
    );
  }

  if (detailQuery.isError || detailQuery.data == null) {
    return (
      <p className="text-destructive py-8 text-sm">
        {getCampaignDetailErrorMessage(detailQuery.error)}
      </p>
    );
  }

  return renderCampaignDetailContent(detailQuery.data);
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

    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Campaign details</SheetTitle>
            <SheetDescription>
              Delivery status for each tenant included in this notification.
            </SheetDescription>
          </SheetHeader>

          {renderSheetBody(detailQuery)}
        </SheetContent>
      </Sheet>
    );
  }
);
TenantEmailCampaignDetailSheet.displayName = "TenantEmailCampaignDetailSheet";
