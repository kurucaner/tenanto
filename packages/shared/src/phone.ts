import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type { CountryCode };

export const PHONE_DEFAULT_COUNTRY: CountryCode = "US";

export interface IPhoneParts {
  country: CountryCode;
  e164: string | null;
  nationalNumber: string;
}

export interface IPhoneCountryOption {
  code: CountryCode;
  dialCode: string;
  name: string;
}

const countryDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });

export function getPhoneCountryOptions(): IPhoneCountryOption[] {
  return getCountries()
    .map((code) => ({
      code,
      dialCode: `+${getCountryCallingCode(code)}`,
      name: countryDisplayNames.of(code) ?? code,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parsePhoneToParts(
  value: string | null | undefined,
  defaultCountry: CountryCode = PHONE_DEFAULT_COUNTRY
): IPhoneParts {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") {
    return { country: defaultCountry, e164: null, nationalNumber: "" };
  }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (parsed) {
    return {
      country: parsed.country ?? defaultCountry,
      e164: parsed.number,
      nationalNumber: parsed.nationalNumber,
    };
  }

  return { country: defaultCountry, e164: null, nationalNumber: "" };
}

export function formatNationalAsYouType(country: CountryCode, nationalDigits: string): string {
  const digits = nationalDigits.replace(/\D/g, "");
  if (digits === "") return "";
  return new AsYouType(country).input(digits);
}

export function getMaxNationalDigits(country: CountryCode): number {
  const callingCode = getCountryCallingCode(country);
  return 15 - callingCode.length;
}

export function toE164(country: CountryCode, nationalDigits: string): string | null {
  const digits = nationalDigits.replace(/\D/g, "");
  if (digits === "") return null;

  const parsed = parsePhoneNumberFromString(digits, country);
  return parsed?.number ?? `+${getCountryCallingCode(country)}${digits}`;
}

export function isValidPhone(country: CountryCode, nationalDigits: string): boolean {
  const digits = nationalDigits.replace(/\D/g, "");
  if (digits === "") return true;
  return isValidPhoneNumber(digits, country);
}

export function isValidE164(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  return isValidPhoneNumber(trimmed);
}

export function normalizeToE164(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}

export function formatPhoneDisplay(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return "—";

  const parsed = parsePhoneNumberFromString(trimmed);
  if (parsed) return parsed.formatInternational();
  return trimmed;
}
