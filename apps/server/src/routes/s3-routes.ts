import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { supportStagedUploadsDb } from "@/db/support-staged-uploads";
import { isAuthorizedInternalRequest } from "@/lib/internal-webhook-auth";
import { HttpStatus } from "@/packages/shared";
import {
  decodeS3ObjectKey,
  isObjectCreatedEvent,
  parseS3NotificationEvent,
} from "@/s3/s3-notification-utils";
import { publishSupportAttachmentStatus } from "@/services/publish-support-attachment-status";

export const s3Routes = async (server: FastifyInstance): Promise<void> => {
  server.post("/s3-notification", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAuthorizedInternalRequest(request)) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
    }

    const event = parseS3NotificationEvent(request.body);
    if (event == null) {
      request.log.warn({ body: request.body }, "Ignored invalid S3 notification payload");
      return reply.status(HttpStatus.OK).send({ ok: true });
    }

    for (const record of event.Records) {
      if (!isObjectCreatedEvent(record.eventName)) continue;

      const key = decodeS3ObjectKey(record.s3.object.key);
      if (!key.startsWith("support/")) continue;

      const sizeBytes = record.s3.object.size;
      const result = await supportStagedUploadsDb.confirmByKey(
        key,
        Number.isFinite(sizeBytes) ? sizeBytes : undefined
      );

      if (result.confirmed && result.userId != null) {
        publishSupportAttachmentStatus({
          log: request.log,
          status: "confirmed",
          storageKey: key,
          userId: result.userId,
        });
      } else if (!result.confirmed) {
        request.log.warn({ key }, "S3 notification for unknown or consumed support upload");
      }
    }

    return reply.status(HttpStatus.OK).send({ ok: true });
  });
};
