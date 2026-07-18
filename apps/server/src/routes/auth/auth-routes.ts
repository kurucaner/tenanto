import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";

import { verifyAppleToken } from "@/auth/apple";
import { verifyGoogleToken } from "@/auth/google";
import { isAccountPermanentlyDeletedError, isIdentityConflictError } from "@/constants/account";
import { accountEventsDb } from "@/db/account-events";
import { refreshTokenDb } from "@/db/refresh-tokens";
import { userDb } from "@/db/users";
import { HttpStatus, TPlatform } from "@/packages/shared";
import { replyFromDomainError } from "@/routes/reply-from-domain-error";
import {
  deleteOtpById,
  sendOtpWithCooldown,
  verifyOtpCode,
} from "@/services/auth-otp-service";
import { platformEmailPasswordAuthRealm } from "@/services/auth-realms/platform-email-auth-realm";
import { issuePlatformSession } from "@/services/platform-auth-service";

import { AccountEvent } from "../../server-types";
import { registerEmailPasswordAuthRoutes } from "./register-email-password-auth-routes";
import { validateEmail, validateOtp, validatePassword } from "./validators";

interface IGoogleAuthBody {
  idToken: string;
}

interface IAppleAuthBody {
  identityToken: string;
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

function getSocialProvider(user: {
  appleId?: string | null;
  googleId?: string | null;
}): "Google" | "Apple" | null {
  if (user.googleId) return "Google";
  if (user.appleId) return "Apple";
  return null;
}

export const authRoutes = async (server: FastifyInstance) => {
  registerEmailPasswordAuthRoutes(
    server,
    {
      loginPath: "/auth/email",
      logoutPath: "/auth/logout",
      refreshPath: "/auth/refresh",
      registerStartPath: "/auth/register",
      registerVerifyPath: "/auth/register/verify",
    },
    platformEmailPasswordAuthRealm,
    { requireNameAndPasswordOnRegisterStart: true }
  );

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

    return reply.send(await issuePlatformSession(server, user));
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

      return reply.send(await issuePlatformSession(server, user));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Apple sign-in failed";
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: message });
    }
  });

  server.post<{ Body: IForgotPasswordBody }>("/auth/forgot-password", async (request, reply) => {
    const { email } = request.body;

    const emailErr = validateEmail(email);
    if (emailErr) return reply.status(HttpStatus.BAD_REQUEST).send({ error: emailErr });

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
        await sendOtpWithCooldown({
          email,
          inProgressMessage: "A reset code is already being sent. Please wait.",
          purpose: "reset_password",
        });
      }

      return reply.send({
        message: "If an account exists, you will receive an email",
      });
    } catch (error) {
      if (replyFromDomainError(reply, error)) {
        return reply;
      }
      throw error;
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

    const verifyResult = await verifyOtpCode({
      email,
      otp,
      purpose: "reset_password",
    });
    if (!verifyResult.ok) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid or expired OTP" });
    }

    const user = await userDb.findByEmail(email);
    if (!user) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Invalid or expired OTP" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userDb.updatePassword(user.id, passwordHash);
    await deleteOtpById(verifyResult.otpRowId);

    return reply.send(await issuePlatformSession(server, user));
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
