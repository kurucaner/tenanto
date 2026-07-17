import { tenantRefreshTokenDb } from "@/db/tenant-refresh-tokens";
import { tenantUsersDb } from "@/db/tenant-users";
import type { ITenantAuthSessionResponse, ITenantUser } from "@/packages/shared";
import { issueTenantAccessToken, issueTenantSession } from "@/services/tenant-auth-service";

import type { IEmailPasswordAuthRealm } from "./email-password-auth-realm";

export const tenantEmailPasswordAuthRealm: IEmailPasswordAuthRealm<
  ITenantUser,
  ITenantAuthSessionResponse
> = {
  async createRegisteredUser(input) {
    return tenantUsersDb.create({
      email: input.email,
      emailVerifiedAt: new Date(),
      name: input.name,
      passwordHash: input.passwordHash,
    });
  },

  async findByEmail(email: string) {
    return tenantUsersDb.findByEmail(email);
  },

  async findByEmailWithPassword(email: string) {
    return tenantUsersDb.findByEmailWithPassword(email);
  },

  async issueAccessToken(server, user) {
    return issueTenantAccessToken(server, user);
  },

  async issueSession(server, user) {
    return issueTenantSession(server, user);
  },

  registerOtpPurpose: "tenant_register",

  async resolveUserFromRefreshToken(tokenHash) {
    const storedToken = await tenantRefreshTokenDb.findByHash(tokenHash);
    if (!storedToken) {
      return null;
    }
    return tenantUsersDb.findById(storedToken.tenant_user_id);
  },

  async revokeRefreshToken(tokenHash) {
    await tenantRefreshTokenDb.revokeByHash(tokenHash);
  },
};
