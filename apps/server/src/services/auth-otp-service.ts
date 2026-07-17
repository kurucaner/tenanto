import { randomInt } from "node:crypto";

import bcrypt from "bcrypt";

import { authOtpsDb, type OtpPurpose } from "@/db/auth-otps";
import { OTP_COOLDOWN_SECONDS, OTP_EXPIRY_MINUTES } from "@/lib/auth-otp-config";
import { sendOtpEmail } from "@/ses/transactional-emails";

const otpSendInProgress = new Set<string>();

export class OtpAlreadySendingError extends Error {
  constructor(message = "A verification code is already being sent. Please wait.") {
    super(message);
    this.name = "OtpAlreadySendingError";
  }
}

export class OtpCooldownActiveError extends Error {
  constructor(message = "Please wait 1 minute before requesting another code") {
    super(message);
    this.name = "OtpCooldownActiveError";
  }
}

export function buildOtpInProgressKey(purpose: OtpPurpose, email: string): string {
  return `${purpose}:${email.trim().toLowerCase()}`;
}

export function generateOtp(): string {
  return randomInt(100_000, 1_000_000).toString();
}

export function buildOtpExpiresAt(now: Date = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
  return expiresAt;
}

export async function sendOtpWithCooldown(input: {
  email: string;
  inProgressMessage?: string;
  purpose: OtpPurpose;
}): Promise<void> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const inProgressKey = buildOtpInProgressKey(input.purpose, input.email);

  if (otpSendInProgress.has(inProgressKey)) {
    throw new OtpAlreadySendingError(input.inProgressMessage);
  }

  otpSendInProgress.add(inProgressKey);
  try {
    const lastSent = await authOtpsDb.findMostRecentCreatedAt(input.email, input.purpose);
    const lastSentTime = lastSent ? lastSent.getTime() : 0;
    if (lastSentTime > 0 && Date.now() - lastSentTime < OTP_COOLDOWN_SECONDS * 1000) {
      throw new OtpCooldownActiveError();
    }

    const otp = generateOtp();
    const codeHash = await bcrypt.hash(otp, 10);

    await authOtpsDb.deleteByEmailAndPurpose(input.email, input.purpose);
    await authOtpsDb.create({
      codeHash,
      email: input.email,
      expiresAt: buildOtpExpiresAt(),
      purpose: input.purpose,
    });

    await sendOtpEmail(normalizedEmail, otp, input.purpose);
  } finally {
    otpSendInProgress.delete(inProgressKey);
  }
}

export type TOtpVerifyResult = { ok: true; otpRowId: string } | { ok: false };

export async function verifyOtpCode(input: {
  email: string;
  otp: string;
  purpose: OtpPurpose;
}): Promise<TOtpVerifyResult> {
  const otpRow = await authOtpsDb.findValidByEmailAndPurpose(input.email, input.purpose);
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

export async function deleteOtpById(otpRowId: string): Promise<void> {
  await authOtpsDb.deleteById(otpRowId);
}
