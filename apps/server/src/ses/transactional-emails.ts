import type { OtpPurpose } from "@/db/auth-otps";
import { APP_NAME } from "@/packages/shared";

import { renderTemplate } from "./email-templates";
import { sendTransactionalEmail } from "./ses";

export interface PropertyInviteEmailOptions {
  inviterEmail: string;
  propertyName: string;
  role: string;
}

const OTP_EXPIRY_MINUTES = 10;
const WEB_APP_URL = process.env.WEB_APP_URL;

function getSubject(purpose: OtpPurpose): string {
  switch (purpose) {
    case "register":
      return `Your ${APP_NAME} verification code`;
    case "reset_password":
      return `Reset your ${APP_NAME} password`;
    default:
      return `Your ${APP_NAME} verification code`;
  }
}

function getHeadline(purpose: OtpPurpose): string {
  switch (purpose) {
    case "register":
      return "Your verification code";
    case "reset_password":
      return "Your password reset code";
    default:
      return "Your verification code";
  }
}

function getBodyText(purpose: OtpPurpose, code: string): string {
  const expiry = `${OTP_EXPIRY_MINUTES} minutes`;
  switch (purpose) {
    case "register":
      return `Your verification code is: ${code}. It expires in ${expiry}.`;
    case "reset_password":
      return `Your password reset code is: ${code}. It expires in ${expiry}.`;
    default:
      return `Your verification code is: ${code}. It expires in ${expiry}.`;
  }
}

export async function sendOtpEmail(to: string, code: string, purpose: OtpPurpose): Promise<void> {
  const subject = getSubject(purpose);
  const text = getBodyText(purpose, code);
  const headline = getHeadline(purpose);
  const expiryText = `It expires in ${OTP_EXPIRY_MINUTES} minutes.`;

  const html = renderTemplate("otp.html", {
    baseUrl: WEB_APP_URL,
    expiryText,
    headline,
    otpCode: code,
  });

  await sendTransactionalEmail({
    html,
    subject,
    text,
    to,
  });
}

export async function sendPropertyInviteEmail(
  to: string,
  opts: PropertyInviteEmailOptions
): Promise<void> {
  const subject = `You've been invited to join ${opts.propertyName} on ${APP_NAME}`;
  const text = `${opts.inviterEmail} has invited you to join the property management for ${opts.propertyName} as a ${opts.role}. Sign up at ${WEB_APP_URL} using this email address to accept.`;

  const html = renderTemplate("property-invite.html", {
    appName: APP_NAME,
    baseUrl: WEB_APP_URL ?? "",
    inviterEmail: opts.inviterEmail,
    propertyName: opts.propertyName,
    role: opts.role,
  });

  await sendTransactionalEmail({ html, subject, text, to });
}
