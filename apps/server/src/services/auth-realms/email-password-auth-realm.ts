import type { FastifyInstance } from "fastify";

import type { OtpPurpose } from "@/db/auth-otps";

export interface IEmailPasswordAuthRealm<TUser, TSession> {
  afterRegisterVerified?(user: TUser, email: string): Promise<void>;
  createRegisteredUser(input: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<TUser>;
  findByEmail(email: string): Promise<TUser | null>;
  findByEmailWithPassword(email: string): Promise<(TUser & { passwordHash: string | null }) | null>;
  issueAccessToken(
    server: FastifyInstance,
    user: TUser
  ): Promise<{ accessToken: string; user: TUser }>;
  issueSession(server: FastifyInstance, user: TUser): Promise<TSession>;
  onLogout?(input: { pushToken?: string; refreshToken: string }): Promise<void>;
  registerOtpPurpose: OtpPurpose;
  resolveUserFromRefreshToken(tokenHash: string): Promise<TUser | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
}
