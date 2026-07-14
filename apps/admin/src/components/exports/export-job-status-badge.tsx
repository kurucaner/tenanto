import { type VariantProps } from "class-variance-authority";
import { memo } from "react";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import { getExportJobStatusLabel } from "@/lib/property-export-utils";
import { ExportJobStatus, type TExportJobStatus } from "@/packages/shared";

type TBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function getStatusBadgeVariant(status: TExportJobStatus): TBadgeVariant {
  switch (status) {
    case ExportJobStatus.COMPLETED:
      return "secondary";
    case ExportJobStatus.EXPIRED:
      return "outline";
    case ExportJobStatus.FAILED:
      return "destructive";
    case ExportJobStatus.PROCESSING:
      return "default";
    case ExportJobStatus.PENDING:
    default:
      return "outline";
  }
}

export const ExportJobStatusBadge = memo(({ status }: { status: TExportJobStatus }) => (
  <Badge variant={getStatusBadgeVariant(status)}>{getExportJobStatusLabel(status)}</Badge>
));
ExportJobStatusBadge.displayName = "ExportJobStatusBadge";
