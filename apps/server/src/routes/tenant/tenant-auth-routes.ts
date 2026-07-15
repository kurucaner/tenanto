import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";

import { hashToken } from "@/auth/jwt";
import { authOtpsDb } from "@/db/auth-otps";
import { tenantRefreshTokenDb } from "@/db/tenant-refresh-tokens";
import { tenantUsersDb } from "@/db/tenant-users";
import {
  HttpStatus,
  type ITenantAuthLoginBody,
  type ITenantAuthLogoutBody,
  type ITenantAuthRefreshBody,
  type ITenantAuthRegisterStartBody,
  type ITenantAuthRegisterVerifyBody,
  type ITenantAuthSessionResponse,
} from "@/packages/shared";
import { issueTenantSession, rotateTenantSession } from "@/services/tenant-auth-service";
import { sendOtpEmail } from "@/ses/transactional-emails";

import {
  validateEmail,
  validateName,
  validateOtp,
  validatePassword,
} from "../auth/validators";

const OTP_COOLDOWN_SECONDS = 60;
const OTP_EXPIRY_MINUTES = 10;
const TENANT_REGISTER_OTP_PURPOSE = "tenant_register" as const;

const otpSendInProgress = new Set<string>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const tenantAuthRoutes = async (server: FastifyInstance): Promise<void> => {
  server.post<{ Body: ITenantAuthRegisterStartBody }>(
    "/tenant/auth/register/start",
    async (request, reply) => {
      const { email } = request.body;

      const emailErr = validateEmail(email);
      if (emailErr) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (otpSendInProgress.has(normalizedEmail)) {
        return reply.status(HttpStatus.TOO_MANY_REQUESTS).send({
          error: "A verification code is already being sent. Please wait.",
        });
      }

      otpSendInProgress.add(normalizedEmail);
      try {
        const existing = await tenantUsersDb.findByEmail(email);
        if (existing) {
          return reply.status(HttpStatus.CONFLICT).send({ error: "Email already registered" });
        }

        const lastSent = await authOtpsDb.findMostRecentCreatedAt(
          email,
          TENANT_REGISTER_OTP_PURPOSE
        );
        const lastSentTime = lastSent ? lastSent.getTime() : 0;
        if (lastSentTime > 0 && Date.now() - lastSentTime < OTP_COOLDOWN_SECONDS * 1000) {
          return reply.status(HttpStatus.TOO_MANY_REQUESTS).send({
            error: "Please wait 1 minute before requesting another code",
          });
        }

        const otp = generateOtp();
        const codeHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

        await authOtpsDb.deleteByEmailAndPurpose(email, TENANT_REGISTER_OTP_PURPOSE);
        await authOtpsDb.create({
          codeHash,
          email,
          expiresAt,
          purpose: TENANT_REGISTER_OTP_PURPOSE,
        });

        await sendOtpEmail(normalizedEmail, otp, TENANT_REGISTER_OTP_PURPOSE);

        return reply.send({ message: "Check your email" });
      } finally {
        otpSendInProgress.delete(normalizedEmail);
      }
    }
  );

  server.post<{ Body: ITenantAuthRegisterVerifyBody }>(
    "/tenant/auth/register/verify",
    async (request, reply) => {
      const { email, name, otp, password } = request.body;

      const emailErr = validateEmail(email);
      if (emailErr) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });
      }

      const otpErr = validateOtp(otp);
      if (otpErr) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: otpErr });
      }

      const otpRow = await authOtpsDb.findValidByEmailAndPurpose(
        email,
        TENANT_REGISTER_OTP_PURPOSE
      );
      if (!otpRow) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid or expired OTP" });
      }

      const valid = await bcrypt.compare(otp, otpRow.codeHash);
      if (!valid) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid or expired OTP" });
      }

      const existing = await tenantUsersDb.findByEmail(email);
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
      const user = await tenantUsersDb.create({
        email,
        emailVerifiedAt: new Date(),
        name: name.trim(),
        passwordHash,
      });

      await authOtpsDb.deleteById(otpRow.id);

      const session: ITenantAuthSessionResponse = await issueTenantSession(server, user);
      return reply.send(session);
    }
  );

  server.post<{ Body: ITenantAuthLoginBody }>("/tenant/auth/login", async (request, reply) => {
    const { email, password } = request.body;

    const emailErr = validateEmail(email);
    if (emailErr) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });
    }

    if (!password || typeof password !== "string") {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Password is required" });
    }

    const tenantWithPassword = await tenantUsersDb.findByEmailWithPassword(email);
    if (!tenantWithPassword?.passwordHash) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, tenantWithPassword.passwordHash);
    if (!valid) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid email or password" });
    }

    const { passwordHash: _passwordHash, ...user } = tenantWithPassword;
    const session: ITenantAuthSessionResponse = await issueTenantSession(server, user);
    return reply.send(session);
  });

  server.post<{ Body: ITenantAuthRefreshBody }>("/tenant/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body;

    if (!refreshToken || typeof refreshToken !== "string") {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "refreshToken is required" });
    }

    const tokenHash = hashToken(refreshToken);
    const storedToken = await tenantRefreshTokenDb.findByHash(tokenHash);
    if (!storedToken) {
      return reply
        .status(HttpStatus.UNAUTHORIZED)
        .send({ error: "Invalid or expired refresh token" });
    }

    const user = await tenantUsersDb.findById(storedToken.tenant_user_id);
    if (!user) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "User not found" });
    }

    const session: ITenantAuthSessionResponse = await rotateTenantSession(
      server,
      user,
      tokenHash
    );
    return reply.send(session);
  });

  server.post<{ Body: ITenantAuthLogoutBody }>("/tenant/auth/logout", async (request, reply) => {
    const { refreshToken } = request.body;

    if (!refreshToken || typeof refreshToken !== "string") {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "refreshToken is required" });
    }

    const tokenHash = hashToken(refreshToken);
    await tenantRefreshTokenDb.revokeByHash(tokenHash);

    return reply.send({ success: true });
  });
};
