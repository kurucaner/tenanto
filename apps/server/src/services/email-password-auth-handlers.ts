import bcrypt from "bcrypt";
import type { FastifyInstance, FastifyReply } from "fastify";

import { hashToken } from "@/auth/jwt";
import { HttpStatus, normalizePersonName } from "@/packages/shared";
import {
  validateEmail,
  validateName,
  validateOtp,
  validatePassword,
} from "@/routes/auth/validators";
import {
  deleteOtpById,
  OtpAlreadySendingError,
  OtpCooldownActiveError,
  sendOtpWithCooldown,
  verifyOtpCode,
} from "@/services/auth-otp-service";

import type { IEmailPasswordAuthRealm } from "./auth-realms/email-password-auth-realm";

interface IRegisterStartBody {
  email: string;
  name?: string;
  password?: string;
}

interface IRegisterVerifyBody {
  email: string;
  name: string;
  otp: string;
  password: string;
}

interface IEmailLoginBody {
  email: string;
  password: string;
}

interface IRefreshBody {
  refreshToken: string;
}

interface ILogoutBody {
  refreshToken: string;
}

export async function handleRegisterStart<TUser, TSession>(
  realm: IEmailPasswordAuthRealm<TUser, TSession>,
  body: IRegisterStartBody,
  reply: FastifyReply,
  options?: { requireNameAndPassword?: boolean }
): Promise<FastifyReply> {
  const { email, name, password } = body;

  const emailErr = validateEmail(email);
  if (emailErr) {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });
  }

  if (options?.requireNameAndPassword) {
    const nameErr = validateName(name);
    if (nameErr) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: nameErr });
    }

    const passwordErr = validatePassword(password);
    if (passwordErr) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: passwordErr });
    }
  }

  const existing = await realm.findByEmail(email);
  if (existing) {
    return reply.status(HttpStatus.CONFLICT).send({ error: "Email already registered" });
  }

  try {
    await sendOtpWithCooldown({
      email,
      purpose: realm.registerOtpPurpose,
    });
    return reply.send({ message: "Check your email" });
  } catch (error) {
    if (error instanceof OtpAlreadySendingError) {
      return reply.status(HttpStatus.TOO_MANY_REQUESTS).send({ error: error.message });
    }
    if (error instanceof OtpCooldownActiveError) {
      return reply.status(HttpStatus.TOO_MANY_REQUESTS).send({ error: error.message });
    }
    throw error;
  }
}

export async function handleRegisterVerify<TUser, TSession>(
  realm: IEmailPasswordAuthRealm<TUser, TSession>,
  server: FastifyInstance,
  body: IRegisterVerifyBody,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { email, name, otp, password } = body;

  const emailErr = validateEmail(email);
  if (emailErr) {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });
  }

  const otpErr = validateOtp(otp);
  if (otpErr) {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: otpErr });
  }

  const verifyResult = await verifyOtpCode({
    email,
    otp,
    purpose: realm.registerOtpPurpose,
  });
  if (!verifyResult.ok) {
    return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid or expired OTP" });
  }

  const existing = await realm.findByEmail(email);
  if (existing) {
    return reply.status(HttpStatus.CONFLICT).send({ error: "Email already registered" });
  }

  const nameErr = validateName(name);
  if (nameErr) {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: nameErr });
  }

  const passwordErr = validatePassword(password);
  if (passwordErr) {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: passwordErr });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await realm.createRegisteredUser({
    email,
    name: normalizePersonName(name),
    passwordHash,
  });

  await deleteOtpById(verifyResult.otpRowId);
  await realm.afterRegisterVerified?.(user, email);

  const session = await realm.issueSession(server, user);
  return reply.send(session);
}

export async function handleEmailLogin<TUser, TSession>(
  realm: IEmailPasswordAuthRealm<TUser, TSession>,
  server: FastifyInstance,
  body: IEmailLoginBody,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { email, password } = body;

  const emailErr = validateEmail(email);
  if (emailErr) {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });
  }

  if (!password || typeof password !== "string") {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Password is required" });
  }

  const userWithPassword = await realm.findByEmailWithPassword(email);
  if (!userWithPassword?.passwordHash) {
    return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, userWithPassword.passwordHash);
  if (!valid) {
    return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid email or password" });
  }

  const user = await realm.findByEmail(email);
  if (!user) {
    return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid email or password" });
  }

  await realm.afterAuthenticated?.(user);

  const session = await realm.issueSession(server, user);
  return reply.send(session);
}

export async function handleRefresh<TUser, TSession>(
  realm: IEmailPasswordAuthRealm<TUser, TSession>,
  server: FastifyInstance,
  body: IRefreshBody,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { refreshToken } = body;

  if (!refreshToken || typeof refreshToken !== "string") {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: "refreshToken is required" });
  }

  const tokenHash = hashToken(refreshToken);
  const user = await realm.resolveUserFromRefreshToken(tokenHash);
  if (!user) {
    return reply
      .status(HttpStatus.UNAUTHORIZED)
      .send({ error: "Invalid or expired refresh token" });
  }

  const response = await realm.issueAccessToken(server, user);
  return reply.send(response);
}

export async function handleLogout<TUser, TSession>(
  realm: IEmailPasswordAuthRealm<TUser, TSession>,
  body: ILogoutBody,
  reply: FastifyReply,
  options?: { pushToken?: string }
): Promise<FastifyReply> {
  const { refreshToken } = body;

  if (!refreshToken || typeof refreshToken !== "string") {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: "refreshToken is required" });
  }

  try {
    if (realm.onLogout) {
      await realm.onLogout({ pushToken: options?.pushToken, refreshToken });
    } else {
      await realm.revokeRefreshToken(hashToken(refreshToken));
    }
  } catch (error) {
    console.error("[auth/logout] Logout failed:", error);
    return reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: "Logout failed" });
  }

  return reply.send({ success: true });
}
