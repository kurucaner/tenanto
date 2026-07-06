import { memo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PercentFieldProps {
  disabled: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}

export const PercentField = memo(({ disabled, id, label, onChange, value }: PercentFieldProps) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input
        disabled={disabled}
        id={id}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
        type="text"
        value={value}
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
        %
      </span>
    </div>
  </div>
));
PercentField.displayName = "PercentField";
