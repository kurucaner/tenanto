import type { FastifyInstance } from "fastify";

import {
  generateRefreshToken,
  getRefreshTokenExpiresAt,
  hashToken,
  signAccessToken,
} from "@/auth/jwt";
import { refreshTokenDb } from "@/db/refresh-tokens";
import type {
  IPlatformAuthRefreshResponse,
  IPlatformAuthSessionResponse,
  IUser,
} from "@/packages/shared";

export async function issuePlatformSession(
  server: FastifyInstance,
  user: IUser
): Promise<IPlatformAuthSessionResponse> {
  const accessToken = signAccessToken(server, {
    email: user.email,
    userId: user.id,
    userType: user.userType,
  });
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = getRefreshTokenExpiresAt();

  await refreshTokenDb.create({ expiresAt, tokenHash, userId: user.id });

  return {
    accessToken,
    refreshToken,
    user,
  };
}

export function issuePlatformAccessToken(
  server: FastifyInstance,
  user: IUser
): IPlatformAuthRefreshResponse {
  const accessToken = signAccessToken(server, {
    email: user.email,
    userId: user.id,
    userType: user.userType,
  });

  return {
    accessToken,
    user,
  };
}
