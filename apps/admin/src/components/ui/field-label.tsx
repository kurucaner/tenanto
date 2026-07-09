import { type ComponentProps,memo } from "react";

import { Label } from "@/components/ui/label";
import { OptionalTag } from "@/components/ui/optional-tag";

interface FieldLabelProps extends ComponentProps<typeof Label> {
  optional?: boolean;
}

export const FieldLabel = memo(({ optional, children, ...props }: FieldLabelProps) => (
  <div className="flex items-center justify-between">
    <Label {...props}>{children}</Label>
    {optional ? <OptionalTag /> : null}
  </div>
));
FieldLabel.displayName = "FieldLabel";
