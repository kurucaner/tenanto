import { type IExportJob } from "@/packages/shared";
import { notifyUser } from "@/services/user-notifications";

import { getExportFormatLabel, getExportResourceTypeLabel } from "./property-export-labels";

export async function notifyExportReady(job: IExportJob): Promise<void> {
  const resourceLabel = getExportResourceTypeLabel(job.resourceType);
  const formatLabel = getExportFormatLabel(job.format);

  await notifyUser({
    body: `Your ${resourceLabel} ${formatLabel} export is ready to download.`,
    resourceId: job.propertyId,
    resourceType: "property",
    title: "Export ready",
    type: "export_ready",
    userId: job.createdBy,
  });
}
