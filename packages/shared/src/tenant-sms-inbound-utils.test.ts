import { describe, expect, test } from "bun:test";

import { parseTenantSmsInboundKeyword, TenantSmsInboundKeyword } from "./tenant-sms-inbound-utils";

describe("parseTenantSmsInboundKeyword", () => {
  test("maps STOP variants", () => {
    expect(parseTenantSmsInboundKeyword("STOP")).toBe(TenantSmsInboundKeyword.STOP);
    expect(parseTenantSmsInboundKeyword("stopall")).toBe(TenantSmsInboundKeyword.STOP);
    expect(parseTenantSmsInboundKeyword("UNSUBSCRIBE")).toBe(TenantSmsInboundKeyword.STOP);
    expect(parseTenantSmsInboundKeyword(" cancel ")).toBe(TenantSmsInboundKeyword.STOP);
  });

  test("maps HELP variants", () => {
    expect(parseTenantSmsInboundKeyword("HELP")).toBe(TenantSmsInboundKeyword.HELP);
    expect(parseTenantSmsInboundKeyword("info")).toBe(TenantSmsInboundKeyword.HELP);
  });

  test("returns unknown for other messages", () => {
    expect(parseTenantSmsInboundKeyword("hello")).toBe(TenantSmsInboundKeyword.UNKNOWN);
    expect(parseTenantSmsInboundKeyword("")).toBe(TenantSmsInboundKeyword.UNKNOWN);
  });
});
