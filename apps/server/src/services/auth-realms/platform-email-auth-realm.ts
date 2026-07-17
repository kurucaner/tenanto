import { hashToken } from "@/auth/jwt";
import { pool } from "@/db/pool";
import { pushTokenDb } from "@/db/push-tokens";
import { refreshTokenDb } from "@/db/refresh-tokens";
import { userDb } from "@/db/users";
import type { IPlatformAuthSessionResponse, IUser } from "@/packages/shared";
import { issuePlatformAccessToken, issuePlatformSession } from "@/services/platform-auth-service";

import type { IEmailPasswordAuthRealm } from "./email-password-auth-realm";

export const platformEmailPasswordAuthRealm: IEmailPasswordAuthRealm<
  IUser,
  IPlatformAuthSessionResponse
> = {
  async afterAuthenticated(_user) {},

  async afterRegisterVerified(_user, _email) {},

  async createRegisteredUser(input) {
    return userDb.createWithEmail({
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
    });
  },

  async findByEmail(email: string) {
    return userDb.findByEmail(email);
  },

  async findByEmailWithPassword(email: string) {
    return userDb.findByEmailWithPassword(email);
  },

  async issueAccessToken(server, user) {
    return issuePlatformAccessToken(server, user);
  },

  async issueSession(server, user) {
    return issuePlatformSession(server, user);
  },

  async onLogout({ pushToken, refreshToken }) {
    const tokenHash = hashToken(refreshToken);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const row = await refreshTokenDb.findByHash(tokenHash, client);
      if (row && pushToken) {
        await pushTokenDb.deactivateForUserAndToken(row.user_id, pushToken, client);
      }
      await refreshTokenDb.revokeByHash(tokenHash, client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  registerOtpPurpose: "register",

  async resolveUserFromRefreshToken(tokenHash) {
    const storedToken = await refreshTokenDb.findByHash(tokenHash);
    if (!storedToken) {
      return null;
    }
    return userDb.findById(storedToken.user_id);
  },

  async revokeRefreshToken(tokenHash) {
    await refreshTokenDb.revokeByHash(tokenHash);
  },
};
