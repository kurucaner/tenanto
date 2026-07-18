import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
  type ITenantUser,
  normalizeToE164,
  OTP_EXPIRY_MINUTES,
  TenantSmsSubscriptionStatus,
} from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

import {
  tenantSmsSettingsFormDefaults,
  tenantSmsSettingsFormSchema,
  type TTenantSmsSettingsFormValues,
} from "./tenant-sms-settings-form-schema";

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
  const [awaitingOtp, setAwaitingOtp] = useState(false);

  const form = useForm<TTenantSmsSettingsFormValues>({
    defaultValues: tenantSmsSettingsFormDefaults(user.phone),
    resolver: zodResolver(tenantSmsSettingsFormSchema),
  });

  const {
    control,
    formState: { errors },
    getValues,
    register,
    reset,
    trigger,
  } = form;

  useEffect(() => {
    reset(tenantSmsSettingsFormDefaults(user.phone));
    setAwaitingOtp(false);
  }, [reset, user.id, user.phone, user.phoneVerifiedAt, user.smsConsentedAt, user.smsOptedOutAt]);

  const bindStartMutation = useMutation({
    mutationFn: (normalizedPhone: string) =>
      tenantPortalApi.phoneBindStart({
        phone: normalizedPhone,
        smsConsent: true,
      }),
    onError: (error) => {
      toast.error(getAuthApiErrorMessage(error, "Failed to send verification code"));
    },
    onSuccess: () => {
      setAwaitingOtp(true);
      reset({ ...getValues(), otp: "" });
      toast.success("Verification code sent");
    },
  });

  const bindVerifyMutation = useMutation({
    mutationFn: (input: { code: string; phone: string }) => tenantPortalApi.phoneBindVerify(input),
    onError: (error) => {
      toast.error(getAuthApiErrorMessage(error, "Failed to verify phone number"));
    },
    onSuccess: (response) => {
      syncTenantUserCaches(queryClient, response.user);
      setAwaitingOtp(false);
      reset(tenantSmsSettingsFormDefaults(response.user.phone));
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
      setAwaitingOtp(false);
      reset(tenantSmsSettingsFormDefaults(null));
      toast.success("SMS alerts disabled");
    },
  });

  const handleEnableSms = async () => {
    const isValid = await trigger(["phone", "smsConsent"]);
    if (!isValid) {
      return;
    }

    const normalizedPhone = normalizeToE164(getValues("phone"));
    if (normalizedPhone == null) {
      await trigger("phone");
      return;
    }

    bindStartMutation.mutate(normalizedPhone);
  };

  const handleVerifyOtp = async () => {
    const isValid = await trigger("otp");
    if (!isValid) {
      return;
    }

    const normalizedPhone = normalizeToE164(getValues("phone"));
    if (normalizedPhone == null) {
      await trigger("phone");
      return;
    }

    bindVerifyMutation.mutate({
      code: getValues("otp").trim(),
      phone: normalizedPhone,
    });
  };

  const phoneValue = form.watch("phone");
  const formDisabled = awaitingOtp || bindStartMutation.isPending || bindVerifyMutation.isPending;

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
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className="space-y-1">
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  disabled={formDisabled}
                  id="tenant-sms-phone"
                  label="Mobile phone"
                  onChange={field.onChange}
                  value={field.value}
                />
              )}
            />
            {errors.phone ? (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Controller
              control={control}
              name="smsConsent"
              render={({ field }) => (
                <SmsConsentField
                  checked={field.value}
                  consentId={consentId}
                  disabled={formDisabled}
                  onCheckedChange={field.onChange}
                  webAppUrl={getWebAppUrl()}
                />
              )}
            />
            {errors.smsConsent ? (
              <p className="text-xs text-destructive">{errors.smsConsent.message}</p>
            ) : null}
          </div>

          {!awaitingOtp ? (
            <Button
              disabled={bindStartMutation.isPending}
              onClick={() => void handleEnableSms()}
              type="button"
            >
              {bindStartMutation.isPending ? "Sending code…" : "Enable SMS alerts"}
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Enter the verification code sent to {formatPhoneDisplay(phoneValue)}. It expires in{" "}
                {OTP_EXPIRY_MINUTES} minutes.
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor={otpId}>Verification code</Label>
                <Input
                  autoComplete="one-time-code"
                  id={otpId}
                  inputMode="numeric"
                  maxLength={6}
                  {...register("otp")}
                />
                {errors.otp ? (
                  <p className="text-xs text-destructive">{errors.otp.message}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={bindVerifyMutation.isPending}
                  onClick={() => void handleVerifyOtp()}
                  type="button"
                >
                  {bindVerifyMutation.isPending ? "Verifying…" : "Verify and enable"}
                </Button>
                <Button
                  disabled={bindVerifyMutation.isPending}
                  onClick={() => {
                    setAwaitingOtp(false);
                    reset({ ...getValues(), otp: "" });
                  }}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
});

TenantSmsSettingsSection.displayName = "TenantSmsSettingsSection";
