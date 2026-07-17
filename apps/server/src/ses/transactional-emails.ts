import type { OtpPurpose } from "@/db/auth-otps";
import { OTP_EXPIRY_MINUTES } from "@/lib/auth-otp-config";
import { isTenantEmailNotificationsEnabled } from "@/lib/tenant-email-notifications-config";
import { APP_NAME } from "@/packages/shared";

import { renderTemplate } from "./email-templates";
import { sendSesEmail, sendTransactionalEmail } from "./ses";
import { escapeHtml } from "./ses-utils";
import { buildListUnsubscribeUrl } from "./unsubscribe-token";

export interface PropertyInviteEmailOptions {
  inviterEmail: string;
  propertyName: string;
  role: string;
}

export interface SupportReplyEmailOptions {
  messagePreview: string;
  supportRequestId: string;
}

export interface RentPaymentRecordedEmailOptions {
  amount: string;
  paymentDate: string;
  propertyName: string;
  rentMonthLabel: string;
  tenantName: string;
  unitLabel: string;
}

export interface LeaseEndedEmailOptions {
  contractEndDate: string;
  finalMonthPlain: string;
  finalMonthSection: string;
  holdoverPlain: string;
  holdoverSection: string;
  leaseStartDate: string;
  moveOutDate: string;
  paymentStatusLine: string;
  propertyName: string;
  tenantName: string;
  unitLabel: string;
}

const WEB_APP_URL = process.env.WEB_APP_URL;
const PLATFORM_APP_URL = process.env.PLATFORM_APP_URL;
const TENANT_APP_URL = process.env.TENANT_APP_URL;

export interface TenantPortalInviteEmailOptions {
  acceptUrl: string;
  displayName: string;
  propertyName: string;
  unitLabel: string;
}

function buildSupportTicketUrl(supportRequestId: string): string {
  const base = (PLATFORM_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/support-requests/${encodeURIComponent(supportRequestId)}`;
}

function buildRegisterUrl(): string {
  const base = (PLATFORM_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/signup`;
}

function getSubject(purpose: OtpPurpose): string {
  switch (purpose) {
    case "register":
      return `Your ${APP_NAME} verification code`;
    case "reset_password":
      return `Reset your ${APP_NAME} password`;
    case "tenant_register":
      return `Your ${APP_NAME} tenant portal verification code`;
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
    case "tenant_register":
      return "Your tenant portal verification code";
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
    case "tenant_register":
      return `Your tenant portal verification code is: ${code}. It expires in ${expiry}.`;
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
  const registerUrl = buildRegisterUrl();
  const roleLabel = opts.role.charAt(0).toUpperCase() + opts.role.slice(1);
  const subject = `You've been invited to join ${opts.propertyName} on ${APP_NAME}`;
  const text = `${opts.inviterEmail} has invited you to join the property management for ${opts.propertyName} as a ${roleLabel}. Register now at ${registerUrl} using this email address to accept.`;

  const html = renderTemplate("property-invite.html", {
    appName: APP_NAME,
    baseUrl: WEB_APP_URL ?? "",
    inviterEmail: opts.inviterEmail,
    propertyName: opts.propertyName,
    registerUrl,
    role: roleLabel,
  });

  await sendTransactionalEmail({ html, subject, text, to });
}

export async function sendSupportReplyEmail(
  to: string,
  opts: SupportReplyEmailOptions
): Promise<void> {
  const ticketUrl = buildSupportTicketUrl(opts.supportRequestId);
  const subject = "New reply on your support request";
  const text = `Support replied to your request:\n\n${opts.messagePreview}\n\nView reply: ${ticketUrl}`;

  const html = renderTemplate("support-reply.html", {
    appName: APP_NAME,
    baseUrl: (PLATFORM_APP_URL ?? "").replace(/\/$/, ""),
    messagePreview: escapeHtml(opts.messagePreview),
    ticketUrl,
  });

  await sendTransactionalEmail({ html, subject, text, to });
}

export async function sendRentPaymentRecordedEmail(
  to: string,
  opts: RentPaymentRecordedEmailOptions
): Promise<boolean> {
  if (!isTenantEmailNotificationsEnabled()) {
    return false;
  }

  const subject = `Rent payment received — ${opts.propertyName}`;
  const text = [
    `Hi ${opts.tenantName},`,
    "",
    `We received your rent payment for ${opts.rentMonthLabel} at ${opts.propertyName}.`,
    "",
    `Property: ${opts.propertyName}`,
    `Unit: ${opts.unitLabel}`,
    `Rent month: ${opts.rentMonthLabel}`,
    `Amount: ${opts.amount}`,
    `Payment date: ${opts.paymentDate}`,
    "",
    "This email confirms that your rent payment was recorded.",
  ].join("\n");

  const html = renderTemplate("rent-payment-recorded.html", {
    amount: escapeHtml(opts.amount),
    appName: APP_NAME,
    paymentDate: escapeHtml(opts.paymentDate),
    propertyName: escapeHtml(opts.propertyName),
    rentMonthLabel: escapeHtml(opts.rentMonthLabel),
    tenantName: escapeHtml(opts.tenantName),
    unitLabel: escapeHtml(opts.unitLabel),
  });

  await sendTransactionalEmail({ html, subject, text, to });
  return true;
}

export async function sendLeaseEndedEmail(
  to: string,
  opts: LeaseEndedEmailOptions
): Promise<boolean> {
  if (!isTenantEmailNotificationsEnabled()) {
    return false;
  }

  const subject = `Your lease at ${opts.propertyName} has ended`;
  const text = [
    `Hi ${opts.tenantName},`,
    "",
    `Thank you for your time at ${opts.propertyName}. We recorded your move-out on ${opts.moveOutDate} and your lease is now closed.`,
    "",
    `Property: ${opts.propertyName}`,
    `Unit: ${opts.unitLabel}`,
    `Lease start: ${opts.leaseStartDate}`,
    `Contract end: ${opts.contractEndDate}`,
    `Move-out: ${opts.moveOutDate}`,
    opts.holdoverPlain ? "" : null,
    opts.holdoverPlain || null,
    opts.finalMonthPlain ? "" : null,
    opts.finalMonthPlain || null,
    "",
    opts.paymentStatusLine,
    "",
    "If you have questions about your final rent or move-out, contact your property manager.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const html = renderTemplate("lease-ended.html", {
    appName: APP_NAME,
    contractEndDate: escapeHtml(opts.contractEndDate),
    finalMonthSection: opts.finalMonthSection,
    holdoverSection: opts.holdoverSection,
    leaseStartDate: escapeHtml(opts.leaseStartDate),
    moveOutDate: escapeHtml(opts.moveOutDate),
    paymentStatusLine: escapeHtml(opts.paymentStatusLine),
    propertyName: escapeHtml(opts.propertyName),
    tenantName: escapeHtml(opts.tenantName),
    unitLabel: escapeHtml(opts.unitLabel),
  });

  await sendTransactionalEmail({ html, subject, text, to });
  return true;
}

export async function sendTenantPortalInviteNewEmail(
  to: string,
  opts: TenantPortalInviteEmailOptions
): Promise<boolean> {
  if (!isTenantEmailNotificationsEnabled()) {
    return false;
  }

  const subject = `View your lease at ${opts.propertyName} on ${APP_NAME}`;
  const text = [
    `Hi ${opts.displayName},`,
    "",
    `You've been invited to access your lease at ${opts.propertyName} (${opts.unitLabel}) on ${APP_NAME}.`,
    "",
    `Create your account and accept the invite: ${opts.acceptUrl}`,
    "",
    "This invitation expires in 30 days.",
  ].join("\n");

  const html = renderTemplate("tenant-portal-invite-new.html", {
    acceptUrl: opts.acceptUrl,
    appName: APP_NAME,
    baseUrl: (TENANT_APP_URL ?? WEB_APP_URL ?? "").replace(/\/$/, ""),
    displayName: escapeHtml(opts.displayName),
    propertyName: escapeHtml(opts.propertyName),
    unitLabel: escapeHtml(opts.unitLabel),
  });

  await sendTransactionalEmail({ html, subject, text, to });
  return true;
}

export async function sendTenantPortalInviteExistingEmail(
  to: string,
  opts: TenantPortalInviteEmailOptions
): Promise<boolean> {
  if (!isTenantEmailNotificationsEnabled()) {
    return false;
  }

  const subject = `Accept your lease invite for ${opts.propertyName}`;
  const text = [
    `Hi ${opts.displayName},`,
    "",
    `You've been invited to access your lease at ${opts.propertyName} (${opts.unitLabel}).`,
    "",
    `Sign in and accept the invite: ${opts.acceptUrl}`,
    "",
    "This invitation expires in 30 days.",
  ].join("\n");

  const html = renderTemplate("tenant-portal-invite-existing.html", {
    acceptUrl: opts.acceptUrl,
    appName: APP_NAME,
    baseUrl: (TENANT_APP_URL ?? WEB_APP_URL ?? "").replace(/\/$/, ""),
    displayName: escapeHtml(opts.displayName),
    propertyName: escapeHtml(opts.propertyName),
    unitLabel: escapeHtml(opts.unitLabel),
  });

  await sendTransactionalEmail({ html, subject, text, to });
  return true;
}

export interface TenantCampaignEmailOptions {
  htmlBody: string;
  propertyName: string;
  subject: string;
  textBody: string;
}

export async function sendTenantCampaignEmail(
  to: string,
  opts: TenantCampaignEmailOptions
): Promise<void> {
  const html = `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">${opts.htmlBody}</div>`;
  const unsubUrl = buildListUnsubscribeUrl(to);

  await sendSesEmail({
    html,
    subject: opts.subject,
    text: opts.textBody,
    to,
    unsubUrl,
  });
}
