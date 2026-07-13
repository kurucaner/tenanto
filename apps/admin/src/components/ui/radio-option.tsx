"use client";

import { type ComponentProps, createContext, memo, type ReactNode, useContext, useId } from "react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

const RadioGroupSelectionContext = createContext<string | undefined>(undefined);

type TRadioGroupFieldsetProps = ComponentProps<typeof RadioGroup> & {
  children: ReactNode;
  className?: string;
  legend: string;
};

export const RadioGroupFieldset = memo(
  ({ children, className, legend, value, ...radioGroupProps }: TRadioGroupFieldsetProps) => (
    <fieldset className={cn("space-y-3", className)}>
      <legend className="sr-only">{legend}</legend>
      <RadioGroupSelectionContext.Provider value={value ?? undefined}>
        <RadioGroup value={value} {...radioGroupProps}>
          {children}
        </RadioGroup>
      </RadioGroupSelectionContext.Provider>
    </fieldset>
  )
);
RadioGroupFieldset.displayName = "RadioGroupFieldset";

interface RadioOptionProps {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  value: string;
}

export const RadioOption = memo(
  ({ children, className, disabled, label, value }: RadioOptionProps) => {
    const inputId = useId();
    const selectedValue = useContext(RadioGroupSelectionContext);
    const isSelected = selectedValue === value;

    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <RadioGroupItem disabled={disabled} id={inputId} value={value} />
          <Label className="font-normal" htmlFor={inputId}>
            {label}
          </Label>
        </div>
        {isSelected ? children : null}
      </div>
    );
  }
);
RadioOption.displayName = "RadioOption";
