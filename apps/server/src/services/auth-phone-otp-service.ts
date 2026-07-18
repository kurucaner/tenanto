import bcrypt from "bcrypt";

import { authPhoneOtpsDb, type PhoneOtpPurpose } from "@/db/auth-phone-otps";
import {
  otpAlreadySendingError,
  otpCooldownActiveError,
} from "@/errors/auth-otp-errors";
import { OTP_COOLDOWN_SECONDS, OTP_EXPIRY_MINUTES } from "@/lib/auth-otp-config";
import { APP_NAME } from "@/packages/shared";
import { buildOtpExpiresAt, generateOtp } from "@/services/auth-otp-service";
import { resolveSmsPhoneNumber, sendSms } from "@/sns/sns";

const phoneOtpSendInProgress = new Set<string>();

export function buildPhoneOtpInProgressKey(purpose: PhoneOtpPurpose, phone: string): string {
  return `${purpose}:${phone}`;
}

export function buildTenantPhoneOtpSmsMessage(code: string): string {
  return `${APP_NAME} verification code: ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;
}

export async function sendPhoneOtpWithCooldown(input: {
  inProgressMessage?: string;
  phone: string;
  purpose: PhoneOtpPurpose;
}): Promise<string> {
  const e164 = resolveSmsPhoneNumber(input.phone, "phone");
  const inProgressKey = buildPhoneOtpInProgressKey(input.purpose, e164);

  if (phoneOtpSendInProgress.has(inProgressKey)) {
    throw otpAlreadySendingError(input.inProgressMessage);
  }

  phoneOtpSendInProgress.add(inProgressKey);
  try {
    const lastSent = await authPhoneOtpsDb.findMostRecentCreatedAt(e164, input.purpose);
    const lastSentTime = lastSent ? lastSent.getTime() : 0;
    if (lastSentTime > 0 && Date.now() - lastSentTime < OTP_COOLDOWN_SECONDS * 1000) {
      throw otpCooldownActiveError();
    }

    const otp = generateOtp();
    const codeHash = await bcrypt.hash(otp, 10);

    await authPhoneOtpsDb.deleteByPhoneAndPurpose(e164, input.purpose);
    await authPhoneOtpsDb.create({
      codeHash,
      expiresAt: buildOtpExpiresAt(),
      phone: e164,
      purpose: input.purpose,
    });

    await sendSms({
      message: buildTenantPhoneOtpSmsMessage(otp),
      phoneNumber: e164,
    });

    return e164;
  } finally {
    phoneOtpSendInProgress.delete(inProgressKey);
  }
}

export type TPhoneOtpVerifyResult = { ok: true; otpRowId: string } | { ok: false };

export async function verifyPhoneOtpCode(input: {
  otp: string;
  phone: string;
  purpose: PhoneOtpPurpose;
}): Promise<TPhoneOtpVerifyResult> {
  const e164 = resolveSmsPhoneNumber(input.phone, "phone");
  const otpRow = await authPhoneOtpsDb.findValidByPhoneAndPurpose(e164, input.purpose);
  if (!otpRow) {
    return { ok: false };
  }

  const otpStr = String(input.otp).trim();
  const valid = await bcrypt.compare(otpStr, otpRow.codeHash);
  if (!valid) {
    return { ok: false };
  }

  return { ok: true, otpRowId: otpRow.id };
}

export async function deletePhoneOtpById(otpRowId: string): Promise<void> {
  await authPhoneOtpsDb.deleteById(otpRowId);
}
