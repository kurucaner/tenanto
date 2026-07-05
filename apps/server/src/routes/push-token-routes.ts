import type { FastifyInstance } from "fastify";

import { pushTokenDb } from "@/db/push-tokens";
import { HttpStatus } from "@/packages/shared";

interface IRegisterBody {
  is_active?: boolean;
  token: string;
}

export const pushTokenRoutes = async (server: FastifyInstance) => {
  server.post<{ Body: IRegisterBody }>(
    "/push-tokens/register",
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { is_active, token } = request.body;
      const platform = request.headers["x-platform"];

      if (!token || typeof token !== "string") {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "token is required" });
      }

      if (!platform || (platform !== "ios" && platform !== "android")) {
        return reply
          .status(HttpStatus.BAD_REQUEST)
          .send({ error: "x-platform must be ios or android" });
      }

      const userId = request.user.userId;
      const isActive = is_active !== false;

      await pushTokenDb.upsert({
        isActive,
        platform,
        token,
        userId,
      });

      return reply.send({ success: true });
    }
  );
};
