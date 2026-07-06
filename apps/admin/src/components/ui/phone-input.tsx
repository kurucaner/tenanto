import { memo, useEffect, useId, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import {
  formatNationalAsYouType,
  getMaxNationalDigits,
  getPhoneCountryOptions,
  isValidPhone,
  parsePhoneToParts,
  PHONE_DEFAULT_COUNTRY,
  toE164,
  type CountryCode,
} from "@/packages/shared";

import { Input } from "./input";
import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const PHONE_COUNTRIES = getPhoneCountryOptions();

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
  ({
    className,
    disabled,
    id: externalId,
    label = "Phone Number",
    onChange,
    optional = false,
    value,
  }: PhoneInputProps) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    const [touched, setTouched] = useState(false);
    const [country, setCountry] = useState<CountryCode>(PHONE_DEFAULT_COUNTRY);
    const [nationalDisplay, setNationalDisplay] = useState("");

    useEffect(() => {
      const parts = parsePhoneToParts(value);
      setCountry(parts.country);
      setNationalDisplay(
        parts.nationalNumber
          ? formatNationalAsYouType(parts.country, parts.nationalNumber)
          : ""
      );
    }, [value]);

    const dialCode = useMemo(
      () => PHONE_COUNTRIES.find((option) => option.code === country)?.dialCode ?? "+1",
      [country]
    );

    const maxNationalDigits = getMaxNationalDigits(country);
    const invalid = touched && !isValidPhone(country, nationalDisplay);

    const emitChange = (nextCountry: CountryCode, digits: string) => {
      onChange(toE164(nextCountry, digits) ?? "");
    };

    const handleCountryChange = (nextCountry: string) => {
      const parsedCountry = nextCountry as CountryCode;
      setCountry(parsedCountry);
      const digits = nationalDisplay.replace(/\D/g, "");
      setNationalDisplay(formatNationalAsYouType(parsedCountry, digits));
      emitChange(parsedCountry, digits);
    };

    const handleNationalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, maxNationalDigits);
      setNationalDisplay(formatNationalAsYouType(country, digits));
      emitChange(country, digits);
    };

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <div className="flex items-center justify-between">
          <Label htmlFor={id}>{label}</Label>
          {optional ? (
            <span className="text-xs text-muted-foreground">Optional</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Select disabled={disabled} onValueChange={handleCountryChange} value={country}>
            <SelectTrigger
              aria-invalid={invalid || undefined}
              aria-label="Country code"
              className="w-[5.5rem] shrink-0"
              size="default"
            >
              <SelectValue>{dialCode}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {PHONE_COUNTRIES.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.dialCode} {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-invalid={invalid || undefined}
            aria-label={label}
            className="min-w-0 flex-1"
            disabled={disabled}
            id={id}
            inputMode="numeric"
            maxLength={maxNationalDigits + 8}
            onBlur={() => setTouched(true)}
            onChange={handleNationalChange}
            placeholder="(305) 555-0106"
            type="tel"
            value={nationalDisplay}
          />
        </div>
        {invalid ? (
          <p className="text-xs text-destructive">
            Enter a valid phone number for the selected country.
          </p>
        ) : null}
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";
