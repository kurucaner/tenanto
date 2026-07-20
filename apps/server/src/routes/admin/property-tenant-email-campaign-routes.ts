import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyTenantEmailCampaignsDb } from "@/db/property-tenant-email-campaigns";
import {
  TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_MAX,
  TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/tenant-email-campaign-config";
import { getTenantEmailCampaignCreateRateLimitErrorMessage } from "@/lib/tenant-email-campaign-limits";
import {
  HttpStatus,
  type ICreateTenantEmailCampaignBody,
  type ITenantEmailCampaignCreateResponse,
  type ITenantEmailCampaignDetailResponse,
  type ITenantEmailCampaignListResponse,
  type ITenantEmailCampaignPreviewResponse,
  type ITenantEmailCampaignReenqueueResponse,
  TENANT_EMAIL_CAMPAIGNS_LIST_LIMIT,
  TENANT_EMAIL_CAMPAIGNS_LIST_MAX_LIMIT,
  type TTenantEmailCampaignsListFilters,
} from "@/packages/shared";
import { decodeKeysetCursor } from "@/pagination/keyset-cursor";
import { replyFromDomainError } from "@/routes/reply-from-domain-error";
import { assertTenantEmailCampaignCreateAllowed } from "@/services/tenant-email-campaign-create-rate-limit";
import { reenqueueQueuedRecipientsForCampaign } from "@/services/tenant-email-campaign-reenqueue";
import {
  buildTenantEmailCampaignPreview,
  createTenantEmailCampaign,
} from "@/services/tenant-email-campaign-service";

import { parseUuidParam } from "./admin-query-utils";
import { parseJsonObject } from "./parse-body-utils";
import { applyOptionalQuerySearchFilter } from "./parse-list-query-filters";
import { assertPropertyTenantNotificationAccess } from "./property-route-access";

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

function parseTenantEmailCampaignsListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return TENANT_EMAIL_CAMPAIGNS_LIST_LIMIT;
  return Math.min(TENANT_EMAIL_CAMPAIGNS_LIST_MAX_LIMIT, Math.floor(n));
}

function parseTenantEmailCampaignsListQuery(query: Record<string, unknown>):
  | {
      cursor?: string;
      filters: TTenantEmailCampaignsListFilters;
      limit: number;
      ok: true;
    }
  | { error: string; ok: false } {
  const filters: TTenantEmailCampaignsListFilters = {};

  const searchResult = applyOptionalQuerySearchFilter(query, filters);
  if (!searchResult.ok) {
    return searchResult;
  }

  const limit = parseTenantEmailCampaignsListLimit(query["limit"]);
  const cursor =
    typeof query["cursor"] === "string" && query["cursor"] !== "" ? query["cursor"] : undefined;

  return { cursor, filters, limit, ok: true };
}

function parseIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return null;
  }
  return trimmed;
}

function parseCreateCampaignBody(
  raw: unknown
): { body: ICreateTenantEmailCampaignBody; ok: true } | { error: string; ok: false } {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return { error: "Invalid JSON body", ok: false };
  }

  const subject = parsed.subject;
  const htmlBody = parsed.htmlBody;

  if (typeof subject !== "string" || typeof htmlBody !== "string") {
    return { error: "subject and htmlBody are required", ok: false };
  }

  return {
    body: { htmlBody, subject },
    ok: true,
  };
}

export const propertyTenantEmailCampaignRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: { propertyId: string } }>(
    "/properties/:propertyId/tenant-email-campaigns/preview",
    { preHandler: authPre },
    async (request, reply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (!propertyId) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid property id" });
      }

      const userId = request.user!.userId;
      const userType = request.user!.userType;
      const allowed = await assertPropertyTenantNotificationAccess(
        propertyId,
        userId,
        userType,
        reply
      );
      if (!allowed) {
        return;
      }

      const preview: ITenantEmailCampaignPreviewResponse =
        await buildTenantEmailCampaignPreview(propertyId);
      return reply.send(preview);
    }
  );

  server.get<{ Params: { propertyId: string }; Querystring: Record<string, unknown> }>(
    "/properties/:propertyId/tenant-email-campaigns",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{
        Params: { propertyId: string };
        Querystring: Record<string, unknown>;
      }>,
      reply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (!propertyId) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid property id" });
      }

      const userId = request.user!.userId;
      const userType = request.user!.userType;
      const allowed = await assertPropertyTenantNotificationAccess(
        propertyId,
        userId,
        userType,
        reply
      );
      if (!allowed) {
        return;
      }

      const parsed = parseTenantEmailCampaignsListQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      if (parsed.cursor != null) {
        try {
          decodeKeysetCursor(parsed.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const { campaigns, meta, nextCursor } =
        await propertyTenantEmailCampaignsDb.listPaginatedByProperty(propertyId, parsed.filters, {
          cursor: parsed.cursor,
          limit: parsed.limit,
        });
      const response: ITenantEmailCampaignListResponse = meta
        ? { campaigns, meta, nextCursor }
        : { campaigns, nextCursor };
      return reply.send(response);
    }
  );

  server.get<{ Params: { campaignId: string; propertyId: string } }>(
    "/properties/:propertyId/tenant-email-campaigns/:campaignId",
    { preHandler: authPre },
    async (request, reply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      const campaignId = parseUuidParam(request.params.campaignId);
      if (!propertyId || !campaignId) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid id" });
      }

      const userId = request.user!.userId;
      const userType = request.user!.userType;
      const allowed = await assertPropertyTenantNotificationAccess(
        propertyId,
        userId,
        userType,
        reply
      );
      if (!allowed) {
        return;
      }

      const campaign = await propertyTenantEmailCampaignsDb.findById(campaignId);
      if (!campaign || campaign.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Campaign not found" });
      }

      const recipients = await propertyTenantEmailCampaignsDb.listRecipients(campaignId);
      const response: ITenantEmailCampaignDetailResponse = { campaign, recipients };
      return reply.send(response);
    }
  );

  server.post<{ Params: { propertyId: string } }>(
    "/properties/:propertyId/tenant-email-campaigns",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: { propertyId: string } }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (!propertyId) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid property id" });
      }

      const idempotencyKey = parseIdempotencyKey(request.headers["idempotency-key"]);
      if (!idempotencyKey) {
        return reply
          .status(HttpStatus.BAD_REQUEST)
          .send({ error: "Invalid Idempotency-Key header" });
      }

      const userId = request.user!.userId;
      const userType = request.user!.userType;
      const allowed = await assertPropertyTenantNotificationAccess(
        propertyId,
        userId,
        userType,
        reply
      );
      if (!allowed) {
        return;
      }

      const rateLimit = await assertTenantEmailCampaignCreateAllowed(userId, propertyId);
      if (!rateLimit.allowed) {
        return reply
          .status(HttpStatus.TOO_MANY_REQUESTS)
          .header("Retry-After", String(rateLimit.retryAfterSec))
          .send({
            error: getTenantEmailCampaignCreateRateLimitErrorMessage({
              limit: TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_MAX,
              retryAfterSec: rateLimit.retryAfterSec,
              windowMs: TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_WINDOW_MS,
            }),
          });
      }

      const parsedBody = parseCreateCampaignBody(request.body);
      if (!parsedBody.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsedBody.error });
      }

      try {
        const response: ITenantEmailCampaignCreateResponse = await createTenantEmailCampaign({
          body: parsedBody.body,
          createdBy: userId,
          idempotencyKey,
          propertyId,
        });

        return reply.status(HttpStatus.ACCEPTED).send(response);
      } catch (error) {
        if (replyFromDomainError(reply, error)) {
          return reply;
        }
        throw error;
      }
    }
  );

  server.post<{ Params: { campaignId: string; propertyId: string } }>(
    "/properties/:propertyId/tenant-email-campaigns/:campaignId/reenqueue",
    { preHandler: authPre },
    async (request, reply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      const campaignId = parseUuidParam(request.params.campaignId);
      if (!propertyId || !campaignId) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid id" });
      }

      const userId = request.user!.userId;
      const userType = request.user!.userType;
      const allowed = await assertPropertyTenantNotificationAccess(
        propertyId,
        userId,
        userType,
        reply
      );
      if (!allowed) {
        return;
      }

      try {
        const response: ITenantEmailCampaignReenqueueResponse =
          await reenqueueQueuedRecipientsForCampaign(campaignId, propertyId);
        return reply.status(HttpStatus.ACCEPTED).send(response);
      } catch (error) {
        if (replyFromDomainError(reply, error)) {
          return reply;
        }
        throw error;
      }
    }
  );
};
