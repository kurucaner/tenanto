import { memo } from "react";

import { Label } from "@/components/ui/label";
import {
  getUnitRentalTypeHint,
  getUnitRentalTypePickerSelectedClassName,
  UNIT_RENTAL_TYPE_OPTIONS,
} from "@/lib/unit-rental-type-styles";
import { cn } from "@/lib/utils";
import { type TUnitRentalType } from "@/packages/shared";

interface RentalTypePickerProps {
  error?: string;
  id?: string;
  onChange: (value: TUnitRentalType) => void;
  value: TUnitRentalType;
}

export const RentalTypePicker = memo(({ error, id, onChange, value }: RentalTypePickerProps) => (
  <div className="flex flex-col gap-1.5">
    <Label id={id ? `${id}-label` : undefined}>Rental Type</Label>
    <div
      aria-labelledby={id ? `${id}-label` : undefined}
      className="grid grid-cols-2 gap-2"
      id={id}
      role="group"
    >
      {UNIT_RENTAL_TYPE_OPTIONS.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            aria-pressed={isSelected}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              isSelected
                ? getUnitRentalTypePickerSelectedClassName(option.value)
                : "border-input text-muted-foreground hover:border-foreground hover:text-foreground"
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
    <p className="text-muted-foreground text-xs">{getUnitRentalTypeHint(value)}</p>
    {error ? <p className="text-xs text-destructive">{error}</p> : null}
  </div>
));
RentalTypePicker.displayName = "RentalTypePicker";
