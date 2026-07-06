import { memo, useId, useState } from "react";

import { cn } from "@/lib/utils";

import { Input } from "./input";
import { Label } from "./label";

/** Digits, spaces, hyphens, parentheses and a leading + are the only accepted characters. */
const ALLOWED_RE = /^[+\d\s\-()]*$/;

function isValidPhone(value: string): boolean {
  if (value.trim() === "") return true;
  return ALLOWED_RE.test(value) && value.replace(/\D/g, "").length >= 7;
}

function sanitize(raw: string): string {
  return raw.replace(/[^\d\s\-()+]/g, "");
}

interface PhoneInputProps {
  className?: string;
  disabled?: boolean;
  id?: string;
  label?: string;
  onChange: (value: string) => void;
  optional?: boolean;
  value: string;
}

export const PhoneInput = memo(
  ({ className, disabled, id: externalId, label = "Phone Number", onChange, optional = false, value }: PhoneInputProps) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    const [touched, setTouched] = useState(false);

    const invalid = touched && value.trim() !== "" && !isValidPhone(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(sanitize(e.target.value));
    };

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <div className="flex items-center justify-between">
          <Label htmlFor={id}>{label}</Label>
          {optional ? (
            <span className="text-xs text-muted-foreground">Optional</span>
          ) : null}
        </div>
        <Input
          aria-invalid={invalid || undefined}
          disabled={disabled}
          id={id}
          inputMode="tel"
          onBlur={() => setTouched(true)}
          onChange={handleChange}
          placeholder="+1 (305) 555-0106"
          type="tel"
          value={value}
        />
        {invalid ? (
          <p className="text-xs text-destructive">
            Enter a valid phone number (digits, +, spaces, hyphens).
          </p>
        ) : null}
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";
