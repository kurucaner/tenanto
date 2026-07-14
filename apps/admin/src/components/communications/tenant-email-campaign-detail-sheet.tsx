import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { memo, type ReactNode, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { TenantEmailCampaignRecipientRow } from "@/components/communications/tenant-email-campaign-recipient-row";
import { TenantEmailCampaignStatusBadge } from "@/components/communications/tenant-email-campaign-status-badge";
import { DataTable } from "@/components/data-table/data-table";
import { type DataTableColumn } from "@/components/data-table/data-table-types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { tenantEmailCampaignsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  compareTenantEmailCampaignRecipients,
  formatTenantEmailCampaignDate,
} from "@/lib/tenant-email-campaign-utils";
import {
  type ITenantEmailCampaignDetailResponse,
  type ITenantEmailCampaignRecipient,
  TenantEmailRecipientStatus,
} from "@/packages/shared";

const RECIPIENT_COLUMNS: DataTableColumn[] = [
  { id: "tenant", label: "Tenant" },
  { id: "email", label: "Email" },
  { id: "status", label: "Status" },
];

const RECIPIENT_ROW_ESTIMATED_HEIGHT = 72;

function getRecipientKey(recipient: ITenantEmailCampaignRecipient): string {
  return recipient.id;
}

function getCampaignDetailErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Campaign not found";
}

function hasQueuedRecipients(detail: ITenantEmailCampaignDetailResponse): boolean {
  return detail.recipients.some(
    (recipient) => recipient.status === TenantEmailRecipientStatus.QUEUED
  );
}

interface ITenantEmailCampaignDetailSheetProps {
  campaignId: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

function renderCampaignDetailContent(
  detail: ITenantEmailCampaignDetailResponse,
  options: {
    isReenqueuePending: boolean;
    onReenqueue: () => void;
    recipientsScrollElement: HTMLDivElement | null;
  }
) {
  const failedRecipients = detail.recipients.filter(
    (recipient) => recipient.status === TenantEmailRecipientStatus.FAILED
  );
  const sortedRecipients = [...detail.recipients].sort(compareTenantEmailCampaignRecipients);
  const showReenqueue = hasQueuedRecipients(detail);

  return (
    <div className="space-y-4 pb-4">
      {showReenqueue ? (
        <div className="mx-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div className="space-y-1">
            <p className="font-medium text-sm">Delivery pending</p>
            <p className="text-muted-foreground text-sm">
              Some recipients are still queued. Retry if the worker was offline when this campaign
              was created.
            </p>
          </div>
          <Button
            disabled={options.isReenqueuePending}
            onClick={options.onReenqueue}
            type="button"
            variant="outline"
          >
            {options.isReenqueuePending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            Retry delivery
          </Button>
        </div>
      ) : null}

      {detail.campaign.failedCount > 0 ? (
        <div className="border-destructive/50 bg-destructive/10 text-destructive mx-4 flex gap-3 rounded-lg border p-4 text-sm">
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

      <div className="space-y-2 px-4">
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

      <DataTable
        columns={RECIPIENT_COLUMNS}
        emptyMessage="No recipients."
        getItemKey={getRecipientKey}
        items={sortedRecipients}
        renderRow={(recipient) => <TenantEmailCampaignRecipientRow recipient={recipient} />}
        virtualization={{
          estimateRowHeight: RECIPIENT_ROW_ESTIMATED_HEIGHT,
          scrollElement: options.recipientsScrollElement,
        }}
      />
    </div>
  );
}

function renderSheetBody(
  detailQuery: {
    data: ITenantEmailCampaignDetailResponse | undefined;
    error: unknown;
    isError: boolean;
    isPending: boolean;
  },
  options: {
    isReenqueuePending: boolean;
    onReenqueue: () => void;
    recipientsScrollElement: HTMLDivElement | null;
  }
): ReactNode {
  if (detailQuery.isPending) {
    return (
      <div className="flex items-center gap-2 px-4 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading campaign…
      </div>
    );
  }

  if (detailQuery.isError || detailQuery.data == null) {
    return (
      <p className="text-destructive px-4 py-8 text-sm">
        {getCampaignDetailErrorMessage(detailQuery.error)}
      </p>
    );
  }

  return renderCampaignDetailContent(detailQuery.data, options);
}

export const TenantEmailCampaignDetailSheet = memo(
  ({ campaignId, onOpenChange, open, propertyId }: ITenantEmailCampaignDetailSheetProps) => {
    const queryClient = useQueryClient();
    const [recipientsScrollElement, setRecipientsScrollElement] = useState<HTMLDivElement | null>(
      null
    );

    const handleRecipientsScrollElement = useCallback((element: HTMLDivElement | null) => {
      setRecipientsScrollElement(element);
    }, []);

    const detailQuery = useQuery({
      enabled: open && campaignId != null,
      queryFn: () => tenantEmailCampaignsApi.get(propertyId, campaignId!),
      queryKey:
        campaignId == null
          ? queryKeys.propertyTenantEmailCampaign(propertyId, "missing")
          : queryKeys.propertyTenantEmailCampaign(propertyId, campaignId),
    });

    const reenqueueMutation = useMutation({
      mutationFn: () => tenantEmailCampaignsApi.reenqueue(propertyId, campaignId!),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to retry delivery");
      },
      onSuccess: (response) => {
        if (response.enqueuedCount === 0) {
          toast.message("No queued recipients to retry");
        } else {
          toast.success(`Re-queued ${response.enqueuedCount} recipient(s)`);
        }
        queryClient.invalidateQueries({
          queryKey: queryKeys.propertyTenantEmailCampaigns(propertyId),
        });
        if (campaignId != null) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.propertyTenantEmailCampaign(propertyId, campaignId),
          });
        }
      },
    });

    const handleReenqueue = useCallback(() => {
      reenqueueMutation.mutate();
    }, [reenqueueMutation]);

    const sheetBodyOptions = useMemo(
      () => ({
        isReenqueuePending: reenqueueMutation.isPending,
        onReenqueue: handleReenqueue,
        recipientsScrollElement,
      }),
      [handleReenqueue, recipientsScrollElement, reenqueueMutation.isPending]
    );

    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-xl md:max-w-2xl lg:max-w-4xl">
          <SheetHeader className="shrink-0">
            <SheetTitle>Campaign details</SheetTitle>
            <SheetDescription>
              Delivery status for each tenant included in this notification.
            </SheetDescription>
          </SheetHeader>

          <div
            className="min-h-0 flex-1 overflow-y-auto"
            ref={handleRecipientsScrollElement}
          >
            {renderSheetBody(detailQuery, sheetBodyOptions)}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
);
TenantEmailCampaignDetailSheet.displayName = "TenantEmailCampaignDetailSheet";
