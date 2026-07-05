import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { type TPropertyRole } from "@/packages/shared";

const ROLE_LABELS: Record<TPropertyRole, string> = {
  accountant: "Accountant",
  manager: "Manager",
  owner: "Owner",
};

const ROLE_VARIANTS: Record<TPropertyRole, "default" | "secondary" | "outline"> = {
  accountant: "outline",
  manager: "secondary",
  owner: "default",
};

export const PropertyRoleBadge = memo(({ role }: { role: TPropertyRole }) => (
  <Badge variant={ROLE_VARIANTS[role]}>{ROLE_LABELS[role]}</Badge>
));
PropertyRoleBadge.displayName = "PropertyRoleBadge";
