import { memo } from "react";

import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/components/support/support-constants";
import { Badge } from "@/components/ui/badge";
import { type SupportRequestStatus } from "@/packages/shared";

export const SupportStatusBadge = memo(({ status }: Readonly<{ status: SupportRequestStatus }>) => (
  <Badge className={STATUS_BADGE_CLASS[status]} variant="outline">
    {STATUS_LABEL[status]}
  </Badge>
));
SupportStatusBadge.displayName = "SupportStatusBadge";
