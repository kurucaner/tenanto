import { memo, useId } from "react";
import { type Control, Controller, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { getWebAppUrl } from "@/lib/web-app-url";
import {
  Button,
  Input,
  Label,
  PhoneInput,
  SmsConsentField,
} from "@/packages/app-ui";
import {
  formatPhoneDisplay,
  getTenantSmsSubscriptionStatus,
  type ITenantUser,
  OTP_EXPIRY_MINUTES,
  TenantSmsSubscriptionStatus,
} from "@/packages/shared";

import { type TTenantSmsSettingsFormValues } from "./tenant-sms-settings-form-schema";
import { useTenantSmsSettingsForm } from "./use-tenant-sms-settings-form";

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

interface ITenantSmsStatusProps {
  phone: string | null;
  status: ReturnType<typeof getTenantSmsSubscriptionStatus>;
}

const TenantSmsStatus = memo(function TenantSmsStatus({ phone, status }: ITenantSmsStatusProps) {
  const isSubscribed = status === TenantSmsSubscriptionStatus.SUBSCRIBED;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Status</p>
      <p className="text-foreground">{getSmsStatusLabel(status)}</p>
      {isSubscribed && phone ? (
        <p className="text-xs text-muted-foreground">{formatPhoneDisplay(phone)}</p>
      ) : null}
    </div>
  );
});

TenantSmsStatus.displayName = "TenantSmsStatus";

interface ITenantSmsOptOutButtonProps {
  isPending: boolean;
  onOptOut: () => void;
}

const TenantSmsOptOutButton = memo(function TenantSmsOptOutButton({
  isPending,
  onOptOut,
}: ITenantSmsOptOutButtonProps) {
  return (
    <Button disabled={isPending} onClick={onOptOut} type="button" variant="outline">
      {isPending ? "Disabling…" : "Disable SMS alerts"}
    </Button>
  );
});

TenantSmsOptOutButton.displayName = "TenantSmsOptOutButton";

interface ITenantSmsOtpStepProps {
  errors: FieldErrors<TTenantSmsSettingsFormValues>;
  isVerifying: boolean;
  onCancel: () => void;
  onVerify: () => void;
  otpId: string;
  phoneValue: string;
  register: UseFormRegister<TTenantSmsSettingsFormValues>;
}

const TenantSmsOtpStep = memo(function TenantSmsOtpStep({
  errors,
  isVerifying,
  onCancel,
  onVerify,
  otpId,
  phoneValue,
  register,
}: ITenantSmsOtpStepProps) {
  return (
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
        {errors.otp ? <p className="text-xs text-destructive">{errors.otp.message}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={isVerifying} onClick={onVerify} type="button">
          {isVerifying ? "Verifying…" : "Verify and enable"}
        </Button>
        <Button disabled={isVerifying} onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  );
});

TenantSmsOtpStep.displayName = "TenantSmsOtpStep";

interface ITenantSmsSubscribeFormProps {
  awaitingOtp: boolean;
  consentId: string;
  control: Control<TTenantSmsSettingsFormValues>;
  errors: FieldErrors<TTenantSmsSettingsFormValues>;
  formDisabled: boolean;
  isSending: boolean;
  isVerifying: boolean;
  onCancelOtp: () => void;
  onEnable: () => void;
  onVerify: () => void;
  otpId: string;
  phoneValue: string;
  register: UseFormRegister<TTenantSmsSettingsFormValues>;
}

const TenantSmsSubscribeForm = memo(function TenantSmsSubscribeForm({
  awaitingOtp,
  consentId,
  control,
  errors,
  formDisabled,
  isSending,
  isVerifying,
  onCancelOtp,
  onEnable,
  onVerify,
  otpId,
  phoneValue,
  register,
}: ITenantSmsSubscribeFormProps) {
  return (
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
        {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
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
        <Button disabled={isSending} onClick={onEnable} type="button">
          {isSending ? "Sending code…" : "Enable SMS alerts"}
        </Button>
      ) : (
        <TenantSmsOtpStep
          errors={errors}
          isVerifying={isVerifying}
          onCancel={onCancelOtp}
          onVerify={onVerify}
          otpId={otpId}
          phoneValue={phoneValue}
          register={register}
        />
      )}
    </form>
  );
});

TenantSmsSubscribeForm.displayName = "TenantSmsSubscribeForm";

export interface ITenantSmsSettingsSectionProps {
  user: ITenantUser;
}

export const TenantSmsSettingsSection = memo(function TenantSmsSettingsSection({
  user,
}: ITenantSmsSettingsSectionProps) {
  const consentId = useId();
  const otpId = useId();
  const subscriptionStatus = getTenantSmsSubscriptionStatus(user);
  const isSubscribed = subscriptionStatus === TenantSmsSubscriptionStatus.SUBSCRIBED;
  const {
    awaitingOtp,
    bindStartMutation,
    bindVerifyMutation,
    cancelOtp,
    form,
    formDisabled,
    handleEnableSms,
    handleVerifyOtp,
    optOutMutation,
  } = useTenantSmsSettingsForm(user);

  const {
    control,
    formState: { errors },
    register,
    watch,
  } = form;

  return (
    <div className="space-y-4 text-sm">
      <TenantSmsStatus phone={user.phone} status={subscriptionStatus} />

      {isSubscribed ? (
        <TenantSmsOptOutButton
          isPending={optOutMutation.isPending}
          onOptOut={() => optOutMutation.mutate()}
        />
      ) : (
        <TenantSmsSubscribeForm
          awaitingOtp={awaitingOtp}
          consentId={consentId}
          control={control}
          errors={errors}
          formDisabled={formDisabled}
          isSending={bindStartMutation.isPending}
          isVerifying={bindVerifyMutation.isPending}
          onCancelOtp={cancelOtp}
          onEnable={() => void handleEnableSms()}
          onVerify={() => void handleVerifyOtp()}
          otpId={otpId}
          phoneValue={watch("phone")}
          register={register}
        />
      )}
    </div>
  );
});

TenantSmsSettingsSection.displayName = "TenantSmsSettingsSection";
