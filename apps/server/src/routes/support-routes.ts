import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { supportRequestsDb } from "@/db/support-requests";
import { HttpStatus } from "@/packages/shared";
import { postDiscordWebhook } from "@/services/discord-webhook";

const SUPPORT_CATEGORIES = ["bug", "feature", "general"] as const;
type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

interface ISupportBody {
  category: SupportCategory;
  message: string;
}

function isValidCategory(value: unknown): value is SupportCategory {
  return typeof value === "string" && SUPPORT_CATEGORIES.includes(value as SupportCategory);
}

async function sendToDiscord(payload: {
  category: string;
  message: string;
  userEmail: string;
}): Promise<void> {
  const categoryLabels: Record<string, string> = {
    bug: "Bug Report",
    feature: "Feature Request",
    general: "General",
  };
  const categoryLabel = categoryLabels[payload.category] ?? "General";

  const body = {
    embeds: [
      {
        color: 0xb8860b,
        fields: [
          { inline: true, name: "Category", value: categoryLabel },
          { inline: true, name: "User", value: payload.userEmail },
          { inline: false, name: "Message", value: payload.message || "No message provided" },
        ],
        timestamp: new Date().toISOString(),
        title: "Support Request",
      },
    ],
  };

  await postDiscordWebhook(process.env["DISCORD_SUPPORT_WEBHOOK_URL"], body);
}

export const supportRoutes = async (server: FastifyInstance): Promise<void> => {
  server.post<{ Body: ISupportBody }>(
    "/support",
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Body: ISupportBody }>, reply: FastifyReply) => {
      const { category, message } = request.body;
      const userId = request.user.userId;
      const userEmail = request.user.email;

      if (!isValidCategory(category)) {
        return reply.status(HttpStatus.BAD_REQUEST).send({
          error: `category must be one of: ${SUPPORT_CATEGORIES.join(", ")}`,
        });
      }

      const trimmedMessage = typeof message === "string" ? message.trim() : "";
      if (trimmedMessage.length === 0) {
        return reply.status(HttpStatus.BAD_REQUEST).send({
          error: "message is required",
        });
      }

      if (trimmedMessage.length > 2000) {
        return reply.status(HttpStatus.BAD_REQUEST).send({
          error: "message must be at most 2000 characters",
        });
      }

      let supportRequest;
      try {
        supportRequest = await supportRequestsDb.create({
          category,
          message: trimmedMessage,
          userId,
        });
      } catch (err) {
        server.log.error(err);
        return reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          error: "Failed to submit support request",
        });
      }

      const webhookUrl = process.env["DISCORD_SUPPORT_WEBHOOK_URL"];
      if (webhookUrl) {
        sendToDiscord({
          category,
          message: trimmedMessage,
          userEmail,
        }).catch((err) => server.log.error(err));
      }

      return reply.status(HttpStatus.OK).send({ id: supportRequest.id, success: true });
    }
  );
};
