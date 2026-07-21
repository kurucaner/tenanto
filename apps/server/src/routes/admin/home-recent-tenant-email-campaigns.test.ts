import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import {
  HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT,
  HttpStatus,
  type IHomeRecentTenantEmailCampaign,
  type IHomeRecentTenantEmailCampaignsResponse,
  JwtAudience,
  UserType,
} from "@/packages/shared";

const OWNER_USER_ID = "22222222-2222-4222-8222-222222222222";
const MANAGER_USER_ID = "33333333-3333-4333-8333-333333333333";

function makeRecentCampaign(
  overrides: Partial<IHomeRecentTenantEmailCampaign> = {}
): IHomeRecentTenantEmailCampaign {
  return {
    completedAt: null,
    createdAt: "2026-07-20T10:00:00.000Z",
    createdBy: OWNER_USER_ID,
    failedCount: 0,
    id: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "key-1",
    propertyId: "prop-1",
    propertyName: "Alpha Property",
    recipientCount: 5,
    sentCount: 5,
    skippedCount: 0,
    status: "completed",
    subject: "Rent reminder July",
    updatedAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

const mockListRecent = mock(
  (_userId: string, _isAdmin: boolean, _limit: number): Promise<IHomeRecentTenantEmailCampaign[]> =>
    Promise.resolve([])
);

mock.module("@/db/property-tenant-email-campaigns", () => ({
  propertyTenantEmailCampaignsDb: {
    listRecentForAccessibleProperties: mockListRecent,
  },
}));

const { homeRoutes, parseHomeRecentTenantEmailCampaignsLimit } = await import("./home-routes");

function createMockReply(): {
  body: unknown;
  reply: FastifyReply;
  statusCode: number;
} {
  const state = { body: undefined as unknown, statusCode: 0 };
  const reply = {
    send(payload: unknown) {
      state.body = payload;
      return reply;
    },
    status(code: number) {
      state.statusCode = code;
      return reply;
    },
  } as FastifyReply;

  return {
    get body() {
      return state.body;
    },
    reply,
    get statusCode() {
      return state.statusCode;
    },
  };
}

type TTestUser = {
  email: string;
  userId: string;
  userType: UserType;
};

async function buildTestApp(user: TTestUser | null): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate("authenticate", async (request, reply) => {
    if (user == null) {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
    }

    request.user = {
      aud: JwtAudience.PLATFORM,
      email: user.email,
      userId: user.userId,
      userType: user.userType,
    };
  });
  await homeRoutes(app);
  await app.ready();
  return app;
}

describe("parseHomeRecentTenantEmailCampaignsLimit", () => {
  test("defaults invalid values to HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT", () => {
    expect(parseHomeRecentTenantEmailCampaignsLimit(undefined)).toBe(
      HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT
    );
    expect(parseHomeRecentTenantEmailCampaignsLimit("0")).toBe(
      HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT
    );
  });

  test("caps limit at HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT", () => {
    expect(parseHomeRecentTenantEmailCampaignsLimit("100")).toBe(
      HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT
    );
    expect(parseHomeRecentTenantEmailCampaignsLimit("3")).toBe(3);
  });
});

describe("GET /home/recent-tenant-email-campaigns", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockListRecent.mockClear();
    mockListRecent.mockImplementation(() => Promise.resolve([]));
  });

  afterEach(async () => {
    if (app != null) {
      await app.close();
    }
  });

  test("returns 401 when unauthenticated", async () => {
    app = Fastify();
    const authenticate = mock(async (_request, reply: FastifyReply) => {
      return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
    });
    app.decorate("authenticate", authenticate);
    await homeRoutes(app);
    await app.ready();

    expect(app.hasRoute({ method: "GET", url: "/home/recent-tenant-email-campaigns" })).toBe(true);

    const mockReply = createMockReply();
    await authenticate({} as FastifyRequest, mockReply.reply);

    expect(mockReply.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    expect(mockReply.body).toEqual({ error: "Unauthorized" });
    expect(mockListRecent.mock.calls).toHaveLength(0);
  });

  test("returns empty campaigns for manager with no owner-eligible properties", async () => {
    app = await buildTestApp({
      email: "manager@example.com",
      userId: MANAGER_USER_ID,
      userType: UserType.USER,
    });

    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "GET",
      url: "/home/recent-tenant-email-campaigns",
    });

    expect(response.statusCode).toBe(HttpStatus.OK);
    const body = response.json() as IHomeRecentTenantEmailCampaignsResponse;
    expect(body).toEqual({ campaigns: [] });
    expect(mockListRecent.mock.calls[0]).toEqual([
      MANAGER_USER_ID,
      false,
      HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT,
    ]);
  });

  test("returns merged recent campaigns for authenticated owner", async () => {
    const campaigns = [
      makeRecentCampaign({ subject: "Newer notice" }),
      makeRecentCampaign({
        id: "22222222-2222-4222-8222-222222222222",
        subject: "Older notice",
      }),
    ];
    mockListRecent.mockImplementation(() => Promise.resolve(campaigns));

    app = await buildTestApp({
      email: "owner@example.com",
      userId: OWNER_USER_ID,
      userType: UserType.USER,
    });

    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "GET",
      url: "/home/recent-tenant-email-campaigns",
    });

    expect(response.statusCode).toBe(HttpStatus.OK);
    const body = response.json() as IHomeRecentTenantEmailCampaignsResponse;
    expect(body).toEqual({ campaigns });
    expect(mockListRecent.mock.calls[0]).toEqual([
      OWNER_USER_ID,
      false,
      HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT,
    ]);
  });

  test("passes capped limit to DB query", async () => {
    app = await buildTestApp({
      email: "owner@example.com",
      userId: OWNER_USER_ID,
      userType: UserType.USER,
    });

    const response = await app.inject({
      headers: { authorization: "Bearer test-token" },
      method: "GET",
      url: "/home/recent-tenant-email-campaigns?limit=100",
    });

    expect(response.statusCode).toBe(HttpStatus.OK);
    expect(mockListRecent.mock.calls[0]?.[2]).toBe(HOME_RECENT_TENANT_EMAIL_CAMPAIGNS_LIMIT);
  });
});
