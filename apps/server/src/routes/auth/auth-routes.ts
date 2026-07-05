import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";

import { verifyAppleToken } from "@/auth/apple";
import { verifyGoogleToken } from "@/auth/google";
import {
  generateRefreshToken,
  getRefreshTokenExpiresAt,
  hashToken,
  signAccessToken,
} from "@/auth/jwt";
import {
  isAccountPermanentlyDeletedError,
  isIdentityConflictError,
} from "@/constants/account";
import { accountEventsDb } from "@/db/account-events";
import { authOtpsDb } from "@/db/auth-otps";
import { pool } from "@/db/pool";
import { propertyInvitesDb } from "@/db/property-invites";
import { propertyMembersDb } from "@/db/property-members";
import { pushTokenDb } from "@/db/push-tokens";
import { refreshTokenDb } from "@/db/refresh-tokens";
import { userDb } from "@/db/users";
import { HttpStatus, TPlatform } from "@/packages/shared";
import { sendOtpEmail } from "@/ses/transactional-emails";

import { AccountEvent } from "../../server-types";
import { validateEmail, validateName, validateOtp, validatePassword } from "./validators";

const OTP_COOLDOWN_SECONDS = 60;
const OTP_EXPIRY_MINUTES = 10;

const otpSendInProgress = new Set<string>();

interface IGoogleAuthBody {
  idToken: string;
}

interface IAppleAuthBody {
  identityToken: string;
}

interface IRefreshBody {
  refreshToken: string;
}

interface ILogoutBody {
  refreshToken: string;
}

interface IRegisterBody {
  email: string;
  name: string;
  password: string;
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

interface IForgotPasswordBody {
  email: string;
}

interface IResetPasswordBody {
  email: string;
  newPassword: string;
  otp: string;
}

interface IUpdatePasswordBody {
  currentPassword: string;
  newPassword: string;
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSocialProvider(user: {
  appleId?: string | null;
  googleId?: string | null;
}): "Google" | "Apple" | null {
  if (user.googleId) return "Google";
  if (user.appleId) return "Apple";
  return null;
}

export const authRoutes = async (server: FastifyInstance) => {
  server.post<{ Body: IGoogleAuthBody }>("/auth/google", async (request, reply) => {
    const { idToken } = request.body;
    const platform = request.headers["x-platform"] as TPlatform;

    if (!idToken) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "idToken is required" });
    }

    const googleUser = await verifyGoogleToken({ idToken, platform });

    let user;
    try {
      const result = await userDb.findOrCreateByGoogle({
        email: googleUser.email,
        googleId: googleUser.googleId,
        name: googleUser.name,
      });
      user = result.user;
    } catch (error) {
      if (isAccountPermanentlyDeletedError(error)) {
        return reply.status(HttpStatus.FORBIDDEN).send({
          code: error.code,
          error: error.message,
        });
      }
      if (isIdentityConflictError(error)) {
        return reply.status(HttpStatus.CONFLICT).send({
          code: error.code,
          error: error.message,
        });
      }
      throw error;
    }

    const accessToken = signAccessToken(server, {
      email: user.email,
      userId: user.id,
      userType: user.userType,
    });
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = getRefreshTokenExpiresAt();

    await refreshTokenDb.create({ expiresAt, tokenHash, userId: user.id });

    return reply.send({
      accessToken,
      refreshToken: rawRefreshToken,
      user,
    });
  });

  server.post<{ Body: IAppleAuthBody }>("/auth/apple", async (request, reply) => {
    const { identityToken } = request.body;

    if (!identityToken) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "identityToken is required" });
    }

    try {
      const appleUser = await verifyAppleToken(identityToken);

      let user;
      try {
        const result = await userDb.findOrCreateByApple({
          appleId: appleUser.appleId,
          email: appleUser.email,
          name: appleUser.name,
        });
        user = result.user;
      } catch (error) {
        if (isAccountPermanentlyDeletedError(error)) {
          return reply.status(HttpStatus.FORBIDDEN).send({
            code: error.code,
            error: error.message,
          });
        }
        if (isIdentityConflictError(error)) {
          return reply.status(HttpStatus.CONFLICT).send({
            code: error.code,
            error: error.message,
          });
        }
        throw error;
      }

      const accessToken = signAccessToken(server, {
        email: user.email,
        userId: user.id,
        userType: user.userType,
      });
      const rawRefreshToken = generateRefreshToken();
      const tokenHash = hashToken(rawRefreshToken);
      const expiresAt = getRefreshTokenExpiresAt();

      await refreshTokenDb.create({ expiresAt, tokenHash, userId: user.id });

      return reply.send({
        accessToken,
        refreshToken: rawRefreshToken,
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Apple sign-in failed";
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: message });
    }
  });

  server.post<{ Body: IRegisterBody }>("/auth/register", async (request, reply) => {
    const { email, name, password } = request.body;

    const emailErr = validateEmail(email);
    if (emailErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });

    const nameErr = validateName(name);
    if (nameErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: nameErr });

    const passwordErr = validatePassword(password);
    if (passwordErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: passwordErr });

    const normalizedEmail = email.trim().toLowerCase();
    if (otpSendInProgress.has(normalizedEmail)) {
      return reply.status(HttpStatus.TOO_MANY_REQUESTS).send({
        error: "A verification code is already being sent. Please wait.",
      });
    }

    otpSendInProgress.add(normalizedEmail);
    try {
      const existing = await userDb.findByEmail(email);
      if (existing) {
        return reply.status(HttpStatus.CONFLICT).send({ error: "Email already registered" });
      }

      const lastSent = await authOtpsDb.findMostRecentCreatedAt(email, "register");
      const lastSentTime = lastSent ? new Date(lastSent).getTime() : 0;
      if (lastSentTime > 0 && Date.now() - lastSentTime < OTP_COOLDOWN_SECONDS * 1000) {
        return reply.status(HttpStatus.TOO_MANY_REQUESTS).send({
          error: "Please wait 1 minute before requesting another code",
        });
      }

      const otp = generateOtp();
      const codeHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

      await authOtpsDb.deleteByEmailAndPurpose(email, "register");
      await authOtpsDb.create({
        codeHash,
        email,
        expiresAt,
        purpose: "register",
      });

      await sendOtpEmail(normalizedEmail, otp, "register");

      return reply.send({ message: "Check your email" });
    } finally {
      otpSendInProgress.delete(normalizedEmail);
    }
  });

  server.post<{ Body: IRegisterVerifyBody }>("/auth/register/verify", async (request, reply) => {
    const { email, name, otp, password } = request.body;

    const emailErr = validateEmail(email);
    if (emailErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });

    const otpErr = validateOtp(otp);
    if (otpErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: otpErr });

    const otpRow = await authOtpsDb.findValidByEmailAndPurpose(email, "register");
    if (!otpRow) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid or expired OTP" });
    }

    const valid = await bcrypt.compare(otp, otpRow.codeHash);
    if (!valid) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid or expired OTP" });
    }

    const existing = await userDb.findByEmail(email);
    if (existing) {
      return reply.status(HttpStatus.CONFLICT).send({ error: "Email already registered" });
    }

    const nameErr = validateName(name);
    if (nameErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: nameErr });

    const passwordErr = validatePassword(password);
    if (passwordErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: passwordErr });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userDb.createWithEmail({
      email,
      name: name.trim(),
      passwordHash,
    });

    await authOtpsDb.deleteById(otpRow.id);

    // Auto-claim any pending property invites for this email
    const pendingInvites = await propertyInvitesDb.findPendingByEmail(email);
    await Promise.all(
      pendingInvites.map(async (invite) => {
        await propertyMembersDb.add(invite.propertyId, user.id, invite.role, invite.invitedBy);
        await propertyInvitesDb.updateStatus(invite.id, "accepted");
      })
    );

    const accessToken = signAccessToken(server, {
      email: user.email,
      userId: user.id,
      userType: user.userType,
    });
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = getRefreshTokenExpiresAt();

    await refreshTokenDb.create({ expiresAt, tokenHash, userId: user.id });

    return reply.send({
      accessToken,
      refreshToken: rawRefreshToken,
      user,
    });
  });

  server.post<{ Body: IEmailLoginBody }>("/auth/email", async (request, reply) => {
    const { email, password } = request.body;

    const emailErr = validateEmail(email);
    if (emailErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });

    if (!password || typeof password !== "string") {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Password is required" });
    }

    const userWithPassword = await userDb.findByEmailWithPassword(email);
    if (!userWithPassword || !userWithPassword.passwordHash) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, userWithPassword.passwordHash);
    if (!valid) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid email or password" });
    }

    const user = await userDb.findById(userWithPassword.id);
    if (!user) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid email or password" });
    }

    const accessToken = signAccessToken(server, {
      email: user.email,
      userId: user.id,
      userType: user.userType,
    });
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = getRefreshTokenExpiresAt();

    await refreshTokenDb.create({ expiresAt, tokenHash, userId: user.id });

    return reply.send({
      accessToken,
      refreshToken: rawRefreshToken,
      user,
    });
  });

  server.post<{ Body: IForgotPasswordBody }>("/auth/forgot-password", async (request, reply) => {
    const { email } = request.body;

    const emailErr = validateEmail(email);
    if (emailErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });

    const normalizedEmail = email.trim().toLowerCase();
    if (otpSendInProgress.has(normalizedEmail)) {
      return reply.status(HttpStatus.TOO_MANY_REQUESTS).send({
        error: "A reset code is already being sent. Please wait.",
      });
    }

    otpSendInProgress.add(normalizedEmail);
    try {
      const user = await userDb.findByEmailWithPassword(email);
      if (user && !user.passwordHash) {
        const provider = getSocialProvider(user);
        if (provider) {
          return reply.status(HttpStatus.BAD_REQUEST).send({
            code: "SOCIAL_ACCOUNT",
            error: `This account was created with Sign in with ${provider}. Please use that option to sign in.`,
          });
        }
      }
      if (user && user.passwordHash) {
        const lastSent = await authOtpsDb.findMostRecentCreatedAt(email, "reset_password");
        const lastSentTime = lastSent ? new Date(lastSent).getTime() : 0;
        if (lastSentTime > 0 && Date.now() - lastSentTime < OTP_COOLDOWN_SECONDS * 1000) {
          return reply.status(HttpStatus.TOO_MANY_REQUESTS).send({
            error: "Please wait 1 minute before requesting another code",
          });
        }

        const otp = generateOtp();
        const codeHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

        await authOtpsDb.deleteByEmailAndPurpose(email, "reset_password");
        await authOtpsDb.create({
          codeHash,
          email,
          expiresAt,
          purpose: "reset_password",
        });

        await sendOtpEmail(normalizedEmail, otp, "reset_password");
      }

      return reply.send({
        message: "If an account exists, you will receive an email",
      });
    } finally {
      otpSendInProgress.delete(normalizedEmail);
    }
  });

  server.post<{ Body: IResetPasswordBody }>("/auth/reset-password", async (request, reply) => {
    const { email, newPassword, otp } = request.body;

    const emailErr = validateEmail(email);
    if (emailErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });

    const otpErr = validateOtp(otp);
    if (otpErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: otpErr });

    const passwordErr = validatePassword(newPassword);
    if (passwordErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: passwordErr });

    const otpRow = await authOtpsDb.findValidByEmailAndPurpose(email, "reset_password");
    if (!otpRow) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid or expired OTP" });
    }

    const otpStr = String(otp).trim();
    const valid = await bcrypt.compare(otpStr, otpRow.codeHash);
    if (!valid) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid or expired OTP" });
    }

    const user = await userDb.findByEmail(email);
    if (!user) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid or expired OTP" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userDb.updatePassword(user.id, passwordHash);
    await authOtpsDb.deleteById(otpRow.id);

    const accessToken = signAccessToken(server, {
      email: user.email,
      userId: user.id,
      userType: user.userType,
    });
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = getRefreshTokenExpiresAt();

    await refreshTokenDb.create({ expiresAt, tokenHash, userId: user.id });

    return reply.send({
      accessToken,
      refreshToken: rawRefreshToken,
      user,
    });
  });

  server.patch<{ Body: IUpdatePasswordBody }>(
    "/auth/me/password",
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body;
      const userId = request.user.userId;

      const passwordErr = validatePassword(newPassword);
      if (passwordErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: passwordErr });

      if (!currentPassword || typeof currentPassword !== "string") {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Current password is required" });
      }

      const userWithPassword = await userDb.findByIdWithPassword(userId);
      if (!userWithPassword?.passwordHash) {
        return reply.status(HttpStatus.BAD_REQUEST).send({
          error: "Account does not have a password. Use forgot password instead.",
        });
      }

      const valid = await bcrypt.compare(currentPassword, userWithPassword.passwordHash);
      if (!valid) {
        return reply
          .status(HttpStatus.UNAUTHORIZED)
          .send({ error: "Current password is incorrect" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await userDb.updatePassword(userId, passwordHash);

      return reply.send({ message: "Password updated" });
    }
  );

  server.post<{ Body: IRefreshBody }>("/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "refreshToken is required" });
    }

    const tokenHash = hashToken(refreshToken);
    const storedToken = await refreshTokenDb.findByHash(tokenHash);

    if (!storedToken) {
      return reply
        .status(HttpStatus.UNAUTHORIZED)
        .send({ error: "Invalid or expired refresh token" });
    }

    const user = await userDb.findById(storedToken.user_id);
    if (!user) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "User not found" });
    }

    const accessToken = signAccessToken(server, {
      email: user.email,
      userId: user.id,
      userType: user.userType,
    });

    return reply.send({
      accessToken,
      user,
    });
  });

  server.get("/auth/me", { preHandler: [server.authenticate] }, async (request, reply) => {
    const result = await userDb.findByIdWithHasPassword(request.user.userId);
    if (!result) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "User not found" });
    }

    return reply.send({
      user: { ...result.user, hasPassword: result.hasPassword },
    });
  });

  server.post(
    "/auth/me/onboarding-complete",
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const existing = await userDb.findByIdWithHasPassword(request.user.userId);
      if (!existing) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "User not found" });
      }
      const user = await userDb.completeOnboarding(request.user.userId);
      if (!user) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "User not found" });
      }
      return reply.send({
        user: { ...user, hasPassword: existing.hasPassword },
      });
    }
  );

  server.post<{ Body: ILogoutBody }>("/auth/logout", async (request, reply) => {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "refreshToken is required" });
    }

    const tokenHash = hashToken(refreshToken);
    const pushTokenHeader = request.headers["x-push-token"];
    const pushToken = typeof pushTokenHeader === "string" ? pushTokenHeader.trim() : "";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const row = await refreshTokenDb.findByHash(tokenHash, client);
      if (row && pushToken) {
        await pushTokenDb.deactivateForUserAndToken(row.user_id, pushToken, client);
      }
      await refreshTokenDb.revokeByHash(tokenHash, client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[auth/logout] Transaction failed:", err);
      return reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: "Logout failed" });
    } finally {
      client.release();
    }

    return reply.send({ success: true });
  });

  server.delete("/account", { preHandler: [server.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;

    await refreshTokenDb.revokeAllForUser(userId);
    await userDb.softDelete(userId);
    await accountEventsDb.logEvent({
      eventType: AccountEvent.ACCOUNT_DELETED,
      userId,
    });

    return reply.send({ success: true });
  });
};
