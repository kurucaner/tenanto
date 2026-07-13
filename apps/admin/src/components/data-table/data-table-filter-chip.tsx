import { X } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DataTableFilterChipProps {
  label: string;
  onRemove: () => void;
}

export const DataTableFilterChip = memo(({ label, onRemove }: DataTableFilterChipProps) => (
  <Badge className="gap-1 pr-0.5" variant="outline">
    {label}
    <Button
      aria-label={`Remove ${label} filter`}
      className="size-4 rounded-full"
      onClick={onRemove}
      size="icon-xs"
      type="button"
      variant="ghost"
    >
      <X className="size-2.5" />
    </Button>
  </Badge>
));
DataTableFilterChip.displayName = "DataTableFilterChip";
