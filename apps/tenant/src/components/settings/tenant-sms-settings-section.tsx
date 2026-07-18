import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { getWebAppUrl } from "@/lib/web-app-url";
import {
  Button,
  getAuthApiErrorMessage,
  Input,
  Label,
  PhoneInput,
  SmsConsentField,
} from "@/packages/app-ui";
import {
  formatPhoneDisplay,
  getTenantSmsSubscriptionStatus,
  isValidE164,
  OTP_EXPIRY_MINUTES,
  TenantSmsSubscriptionStatus,
  type ITenantUser,
} from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

function syncTenantUserCaches(queryClient: ReturnType<typeof useQueryClient>, user: ITenantUser) {
  queryClient.setQueryData(queryKeys.me(), { user });
  useAuthStore.getState().setUser(user);
}

function getSmsStatusLabel(status: ReturnType<typeof getTenantSmsSubscriptionStatus>): string {
  switch (status) {
    case TenantSmsSubscriptionStatus.SUBSCRIBED:
      return "Subscribed";
    case TenantSmsSubscriptionStatus.OPTED_OUT:
      return "Opted out";
    default:
      return "Not subscribed";
  }
}

export interface ITenantSmsSettingsSectionProps {
  user: ITenantUser;
}

export const TenantSmsSettingsSection = memo(function TenantSmsSettingsSection({
  user,
}: ITenantSmsSettingsSectionProps) {
  const queryClient = useQueryClient();
  const consentId = useId();
  const otpId = useId();
  const subscriptionStatus = getTenantSmsSubscriptionStatus(user);
  const isSubscribed = subscriptionStatus === TenantSmsSubscriptionStatus.SUBSCRIBED;

  const [phone, setPhone] = useState(user.phone ?? "");
  const [smsConsent, setSmsConsent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);

  useEffect(() => {
    setPhone(user.phone ?? "");
    setSmsConsent(false);
    setOtpCode("");
    setAwaitingOtp(false);
  }, [user.id, user.phone, user.phoneVerifiedAt, user.smsConsentedAt, user.smsOptedOutAt]);

  const bindStartMutation = useMutation({
    mutationFn: () =>
      tenantPortalApi.phoneBindStart({
        phone,
        smsConsent: true,
      }),
    onError: (error) => {
      toast.error(getAuthApiErrorMessage(error, "Failed to send verification code"));
    },
    onSuccess: () => {
      setAwaitingOtp(true);
      setOtpCode("");
      toast.success("Verification code sent");
    },
  });

  const bindVerifyMutation = useMutation({
    mutationFn: () =>
      tenantPortalApi.phoneBindVerify({
        code: otpCode.trim(),
        phone,
      }),
    onError: (error) => {
      toast.error(getAuthApiErrorMessage(error, "Failed to verify phone number"));
    },
    onSuccess: (response) => {
      syncTenantUserCaches(queryClient, response.user);
      setAwaitingOtp(false);
      setSmsConsent(false);
      setOtpCode("");
      toast.success("SMS alerts enabled");
    },
  });

  const optOutMutation = useMutation({
    mutationFn: () => tenantPortalApi.smsOptOut(),
    onError: (error) => {
      toast.error(getAuthApiErrorMessage(error, "Failed to disable SMS alerts"));
    },
    onSuccess: (response) => {
      syncTenantUserCaches(queryClient, response.user);
      setPhone("");
      setAwaitingOtp(false);
      setSmsConsent(false);
      setOtpCode("");
      toast.success("SMS alerts disabled");
    },
  });

  const phoneValid = isValidE164(phone);
  const canStartBind = phoneValid && smsConsent && !bindStartMutation.isPending && !awaitingOtp;
  const canVerifyOtp =
    awaitingOtp && otpCode.trim().length >= 4 && !bindVerifyMutation.isPending && phoneValid;

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Status</p>
        <p className="text-foreground">{getSmsStatusLabel(subscriptionStatus)}</p>
        {isSubscribed && user.phone ? (
          <p className="text-xs text-muted-foreground">{formatPhoneDisplay(user.phone)}</p>
        ) : null}
      </div>

      {isSubscribed ? (
        <Button
          disabled={optOutMutation.isPending}
          onClick={() => optOutMutation.mutate()}
          type="button"
          variant="outline"
        >
          {optOutMutation.isPending ? "Disabling…" : "Disable SMS alerts"}
        </Button>
      ) : (
        <>
          <PhoneInput
            disabled={awaitingOtp || bindStartMutation.isPending || bindVerifyMutation.isPending}
            id="tenant-sms-phone"
            label="Mobile phone"
            onChange={setPhone}
            value={phone}
          />

          <SmsConsentField
            checked={smsConsent}
            consentId={consentId}
            disabled={awaitingOtp || bindStartMutation.isPending || bindVerifyMutation.isPending}
            onCheckedChange={setSmsConsent}
            webAppUrl={getWebAppUrl()}
          />

          {!awaitingOtp ? (
            <Button disabled={!canStartBind} onClick={() => bindStartMutation.mutate()} type="button">
              {bindStartMutation.isPending ? "Sending code…" : "Enable SMS alerts"}
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Enter the verification code sent to {formatPhoneDisplay(phone)}. It expires in{" "}
                {OTP_EXPIRY_MINUTES} minutes.
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor={otpId}>Verification code</Label>
                <Input
                  autoComplete="one-time-code"
                  id={otpId}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setOtpCode(event.target.value)}
                  value={otpCode}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!canVerifyOtp} onClick={() => bindVerifyMutation.mutate()} type="button">
                  {bindVerifyMutation.isPending ? "Verifying…" : "Verify and enable"}
                </Button>
                <Button
                  disabled={bindVerifyMutation.isPending}
                  onClick={() => {
                    setAwaitingOtp(false);
                    setOtpCode("");
                  }}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});
