import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/components/support/support-constants";
import { type SupportRequestStatus } from "@/packages/shared";

function supportStatusBadgeVariant(
  status: SupportRequestStatus
): "default" | "outline" | "secondary" {
  if (status === "pending") return "outline";
  if (status === "in_progress") return "secondary";
  return "default";
}

export const SupportStatusBadge = memo(({ status }: Readonly<{ status: SupportRequestStatus }>) => (
  <Badge
    className={status === "resolved" ? "bg-muted text-muted-foreground" : undefined}
    variant={supportStatusBadgeVariant(status)}
  >
    {STATUS_LABEL[status]}
  </Badge>
));
SupportStatusBadge.displayName = "SupportStatusBadge";
