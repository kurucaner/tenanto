import { OTP_EXPIRY_MINUTES } from "./auth-constants";
import { APP_NAME, SUPPORT_EMAIL } from "./constants";
import { type ITenantUser } from "./tenant-portal-types";

export type ITenantSmsEligibilityInput = Pick<
  ITenantUser,
  "phoneVerifiedAt" | "smsConsentedAt" | "smsOptedOutAt"
>;

export function canReceiveSms(user: ITenantSmsEligibilityInput): boolean {
  return user.phoneVerifiedAt != null && user.smsConsentedAt != null && user.smsOptedOutAt == null;
}

export const TenantSmsSubscriptionStatus = {
  NOT_SUBSCRIBED: "not_subscribed",
  OPTED_OUT: "opted_out",
  SUBSCRIBED: "subscribed",
} as const;

export type TTenantSmsSubscriptionStatus =
  (typeof TenantSmsSubscriptionStatus)[keyof typeof TenantSmsSubscriptionStatus];

export function getTenantSmsSubscriptionStatus(user: ITenantUser): TTenantSmsSubscriptionStatus {
  if (user.smsOptedOutAt != null) {
    return TenantSmsSubscriptionStatus.OPTED_OUT;
  }
  if (canReceiveSms(user)) {
    return TenantSmsSubscriptionStatus.SUBSCRIBED;
  }
  return TenantSmsSubscriptionStatus.NOT_SUBSCRIBED;
}

/** Campaign sample 1 — OTP verification SMS. */
export function buildTenantPhoneOtpSmsMessage(code: string): string {
  return `${APP_NAME}: Your verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;
}

/** Campaign sample 2 — opt-in confirmation SMS. */
export function buildTenantSmsOptInConfirmationMessage(): string {
  return `${APP_NAME}: You're subscribed to account SMS alerts (OTP and transactional notices). Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.`;
}

/** Campaign stop reply — sent after in-app opt-out or STOP keyword. */
export function buildTenantSmsOptOutConfirmationMessage(): string {
  return `${APP_NAME}: You're unsubscribed from SMS alerts. No further messages will be sent. Add your number again in PropertyOS settings to re-subscribe.`;
}

/** Campaign help reply — sent after HELP keyword. */
export function buildTenantSmsHelpMessage(): string {
  return `${APP_NAME}: Help at ${SUPPORT_EMAIL} or https://propertyos.app. Msg & data rates may apply. Reply STOP to unsubscribe.`;
}
