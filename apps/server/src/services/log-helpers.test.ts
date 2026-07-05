import { describe, expect, test } from "bun:test";

import { redactAccessTokenFromUrl } from "./log-helpers";

describe("redactAccessTokenFromUrl", () => {
  test("redacts access_token query value", () => {
    expect(redactAccessTokenFromUrl("/api/resource?rel=x&access_token=secret")).toBe(
      "/api/resource?rel=x&access_token=%5BREDACTED%5D"
    );
  });

  test("leaves URLs without access_token unchanged", () => {
    expect(redactAccessTokenFromUrl("/api/resource?rel=x")).toBe("/api/resource?rel=x");
  });
});
