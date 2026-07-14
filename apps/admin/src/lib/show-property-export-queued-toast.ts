import { toast } from "sonner";

import { router } from "@/app/router";

export function showPropertyExportQueuedToast(propertyId: string, jobId: string): void {
  toast.success("Export queued", {
    action: {
      label: "View export",
      onClick: () => {
        router.navigate(`/properties/${propertyId}/exports?highlightJobId=${jobId}`);
      },
    },
    description: "We'll prepare your file in the background.",
    id: `export-queued-${jobId}`,
  });
}

export function showPropertyExportCompletedToast(propertyId: string, jobId: string): void {
  toast.success("Export ready", {
    action: {
      label: "View export",
      onClick: () => {
        router.navigate(`/properties/${propertyId}/exports?highlightJobId=${jobId}`);
      },
    },
    description: "Your file is ready to download.",
    id: `export-completed-${jobId}`,
  });
}
