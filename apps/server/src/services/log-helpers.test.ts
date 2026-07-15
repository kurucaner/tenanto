import { describe, expect, test } from "bun:test";

import { redactAccessTokenFromUrl, redactSensitiveQueryParamsFromUrl } from "./log-helpers";

describe("redactSensitiveQueryParamsFromUrl", () => {
  test("redacts access_token query value", () => {
    expect(redactSensitiveQueryParamsFromUrl("/api/resource?rel=x&access_token=secret")).toBe(
      "/api/resource?rel=x&access_token=%5BREDACTED%5D"
    );
  });

  test("redacts invite token query value", () => {
    expect(
      redactSensitiveQueryParamsFromUrl("/tenant/invites/preview?token=super-secret-invite")
    ).toBe("/tenant/invites/preview?token=%5BREDACTED%5D");
  });

  test("leaves URLs without sensitive params unchanged", () => {
    expect(redactSensitiveQueryParamsFromUrl("/api/resource?rel=x")).toBe("/api/resource?rel=x");
  });

  test("redactAccessTokenFromUrl remains an alias", () => {
    expect(redactAccessTokenFromUrl("/x?token=abc")).toBe("/x?token=%5BREDACTED%5D");
  });
});
