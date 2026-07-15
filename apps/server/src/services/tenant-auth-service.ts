import type { FastifyInstance } from "fastify";

import {
  generateRefreshToken,
  getRefreshTokenExpiresAt,
  hashToken,
} from "@/auth/jwt";
import { signTenantAccessToken } from "@/auth/tenant-jwt";
import { tenantRefreshTokenDb } from "@/db/tenant-refresh-tokens";
import type { ITenantAuthSessionResponse, ITenantUser } from "@/packages/shared";

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

export async function rotateTenantSession(
  server: FastifyInstance,
  user: ITenantUser,
  previousRefreshTokenHash: string
): Promise<ITenantAuthSessionResponse> {
  await tenantRefreshTokenDb.revokeByHash(previousRefreshTokenHash);
  return issueTenantSession(server, user);
}
