import type { FastifyRequest } from "fastify";

import type { IInsertAdminAuditEventParams } from "@/db/admin-audit-events";

const METADATA_MAX_BYTES = 32_768;

function getClientIp(request: FastifyRequest): string | null {
  const raw = request.ip;
  if (raw == null || raw === "") return null;
  return raw;
}

function getUserAgent(request: FastifyRequest): string | null {
  const ua = request.headers["user-agent"];
  if (typeof ua !== "string" || ua === "") return null;
  return ua;
}

/** Truncate metadata JSON if it exceeds a safe size for the audit row */
export function normalizeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const str = JSON.stringify(metadata);
  if (Buffer.byteLength(str, "utf8") <= METADATA_MAX_BYTES) {
    return metadata;
  }
  return {
    _originalApproxBytes: Buffer.byteLength(str, "utf8"),
    _truncated: true,
    summary: "Metadata exceeded size limit and was not stored in full",
  };
}

export function buildInsertAdminAuditParams(
  request: FastifyRequest,
  rest: Omit<IInsertAdminAuditEventParams, "actorEmail" | "actorUserId" | "ipAddress" | "userAgent">
): IInsertAdminAuditEventParams {
  return {
    ...rest,
    actorEmail: request.user.email,
    actorUserId: request.user.userId,
    ipAddress: getClientIp(request),
    metadata: normalizeAuditMetadata(rest.metadata),
    userAgent: getUserAgent(request),
  };
}
