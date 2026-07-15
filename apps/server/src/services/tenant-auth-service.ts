import type { FastifyInstance } from "fastify";

import { generateRefreshToken, getRefreshTokenExpiresAt, hashToken } from "@/auth/jwt";
import { signTenantAccessToken } from "@/auth/tenant-jwt";
import { tenantRefreshTokenDb } from "@/db/tenant-refresh-tokens";
import type {
  ITenantAuthRefreshResponse,
  ITenantAuthSessionResponse,
  ITenantUser,
} from "@/packages/shared";

export async function issueTenantSession(
  server: FastifyInstance,
  user: ITenantUser
): Promise<ITenantAuthSessionResponse> {
  const accessToken = signTenantAccessToken(server, {
    email: user.email,
    tenantUserId: user.id,
  });
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = getRefreshTokenExpiresAt();

  await tenantRefreshTokenDb.create({
    expiresAt,
    tenantUserId: user.id,
    tokenHash,
  });

  return {
    accessToken,
    refreshToken,
    user,
  };
}

export function issueTenantAccessToken(
  server: FastifyInstance,
  user: ITenantUser
): ITenantAuthRefreshResponse {
  const accessToken = signTenantAccessToken(server, {
    email: user.email,
    tenantUserId: user.id,
  });

  return {
    accessToken,
    user,
  };
}
