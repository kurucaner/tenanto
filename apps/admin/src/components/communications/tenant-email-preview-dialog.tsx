import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tenantEmailCampaignsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

interface ITenantEmailPreviewDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const TenantEmailPreviewDialog = memo(
  ({ onOpenChange, open, propertyId }: ITenantEmailPreviewDialogProps) => {
    const previewQuery = useQuery({
      enabled: open,
      queryFn: () => tenantEmailCampaignsApi.preview(propertyId),
      queryKey: [...queryKeys.propertyTenantEmailCampaigns(propertyId), "preview"],
    });

    const preview = previewQuery.data;

    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recipient preview</DialogTitle>
            <DialogDescription>
              Active lease tenants who will receive this notification.
            </DialogDescription>
          </DialogHeader>

          {previewQuery.isPending ? (
            <div className="flex items-center gap-2 py-6 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading preview…
            </div>
          ) : previewQuery.isError ? (
            <p className="text-destructive text-sm">
              {previewQuery.error instanceof Error
                ? previewQuery.error.message
                : "Failed to load preview"}
            </p>
          ) : preview == null ? null : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Will receive</p>
                  <p className="font-medium text-lg">{preview.recipientCount}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Skipped</p>
                  <p className="font-medium text-lg">{preview.skippedCount}</p>
                </div>
              </div>

              {preview.recipients.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-medium text-sm">Recipients</p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3 text-sm">
                    {preview.recipients.map((recipient) => (
                      <li key={`${recipient.leaseId}-${recipient.tenantRole}-${recipient.email}`}>
                        <span className="font-medium">{recipient.tenantName}</span>
                        <span className="text-muted-foreground"> · {recipient.email}</span>
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          ({recipient.tenantRole})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {preview.skipped.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-medium text-sm">Skipped tenants</p>
                  <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3 text-sm">
                    {preview.skipped.map((skipped) => (
                      <li key={`${skipped.leaseId}-${skipped.tenantRole}-${skipped.tenantName}`}>
                        <span className="font-medium">{skipped.tenantName}</span>
                        <span className="text-muted-foreground"> · {skipped.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
TenantEmailPreviewDialog.displayName = "TenantEmailPreviewDialog";
