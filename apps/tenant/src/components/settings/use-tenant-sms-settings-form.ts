import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { getAuthApiErrorMessage } from "@/packages/app-ui";
import { type ITenantUser, normalizeToE164 } from "@/packages/shared";
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

async function resolveNormalizedPhone(
  trigger: ReturnType<typeof useForm<TTenantSmsSettingsFormValues>>["trigger"],
  getValues: ReturnType<typeof useForm<TTenantSmsSettingsFormValues>>["getValues"]
): Promise<string | null> {
  const normalizedPhone = normalizeToE164(getValues("phone"));
  if (normalizedPhone == null) {
    await trigger("phone");
    return null;
  }

  return normalizedPhone;
}

export function getTenantSmsSettingsSectionKey(user: ITenantUser): string {
  return [
    user.id,
    user.phone ?? "",
    user.phoneVerifiedAt ?? "",
    user.smsConsentedAt ?? "",
    user.smsOptedOutAt ?? "",
  ].join(":");
}

export function useTenantSmsSettingsForm(user: ITenantUser) {
  const queryClient = useQueryClient();
  const [awaitingOtp, setAwaitingOtp] = useState(false);

  const form = useForm<TTenantSmsSettingsFormValues>({
    defaultValues: tenantSmsSettingsFormDefaults(user.phone),
    resolver: zodResolver(tenantSmsSettingsFormSchema),
  });

  const { getValues, reset, trigger } = form;

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

    const normalizedPhone = await resolveNormalizedPhone(trigger, getValues);
    if (normalizedPhone == null) {
      return;
    }

    bindStartMutation.mutate(normalizedPhone);
  };

  const handleVerifyOtp = async () => {
    const isValid = await trigger("otp");
    if (!isValid) {
      return;
    }

    const normalizedPhone = await resolveNormalizedPhone(trigger, getValues);
    if (normalizedPhone == null) {
      return;
    }

    bindVerifyMutation.mutate({
      code: getValues("otp").trim(),
      phone: normalizedPhone,
    });
  };

  const cancelOtp = () => {
    setAwaitingOtp(false);
    reset({ ...getValues(), otp: "" });
  };

  const formDisabled = awaitingOtp || bindStartMutation.isPending || bindVerifyMutation.isPending;

  return {
    awaitingOtp,
    bindStartMutation,
    bindVerifyMutation,
    cancelOtp,
    form,
    formDisabled,
    handleEnableSms,
    handleVerifyOtp,
    optOutMutation,
  };
}
