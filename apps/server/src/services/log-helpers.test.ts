import { describe, expect, test } from "bun:test";

import { redactAccessTokenFromUrl } from "./log-helpers";

describe("redactAccessTokenFromUrl", () => {
  test("redacts access_token query value", () => {
    expect(redactAccessTokenFromUrl("/vault/v1/items/a.mp4/hls/manifest?rel=x&access_token=secret")).toBe(
      "/vault/v1/items/a.mp4/hls/manifest?rel=x&access_token=%5BREDACTED%5D"
    );
  });

  test("leaves URLs without access_token unchanged", () => {
    expect(redactAccessTokenFromUrl("/vault/v1/items/a.mp4/hls/manifest?rel=x")).toBe(
      "/vault/v1/items/a.mp4/hls/manifest?rel=x"
    );
  });
});
