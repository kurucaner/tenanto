import { memo } from "react";

import { cn } from "../lib/utils";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export interface ISmsConsentFieldProps {
  checked: boolean;
  className?: string;
  consentId: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  webAppUrl: string;
}

function normalizeWebAppUrl(webAppUrl: string): string {
  return webAppUrl.replace(/\/$/, "");
}

export const SmsConsentField = memo(function SmsConsentField({
  checked,
  className,
  consentId,
  disabled,
  onCheckedChange,
  webAppUrl,
}: ISmsConsentFieldProps) {
  const baseUrl = normalizeWebAppUrl(webAppUrl);
  const linkClassName = "font-medium text-primary hover:underline";

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Checkbox
        checked={checked}
        className="mt-0.5"
        disabled={disabled}
        id={consentId}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label
        className="block min-w-0 flex-1 text-sm leading-relaxed font-normal text-muted-foreground"
        htmlFor={consentId}
      >
        I agree to receive transactional SMS from PropertyOS, including verification codes and
        account notifications. Message frequency varies. Message and data rates may apply. Reply
        STOP to opt out or HELP for help. See our{" "}
        <a
          className={linkClassName}
          href={`${baseUrl}/terms-of-service`}
          rel="noopener noreferrer"
          target="_blank"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          className={linkClassName}
          href={`${baseUrl}/privacy-policy`}
          rel="noopener noreferrer"
          target="_blank"
        >
          Privacy Policy
        </a>
        {"."}
      </Label>
    </div>
  );
});
