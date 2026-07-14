import { describe, expect, test } from "bun:test";

import { isPermanentSesError, isRetryableSesError } from "./ses-error-utils";

describe("ses-error-utils", () => {
  test("treats throttling as retryable", () => {
    expect(
      isRetryableSesError({
        $metadata: { httpStatusCode: 429 },
        name: "TooManyRequestsException",
      })
    ).toBe(true);
  });

  test("treats invalid parameter as permanent", () => {
    expect(
      isPermanentSesError({
        $metadata: { httpStatusCode: 400 },
        name: "InvalidParameterValue",
      })
    ).toBe(true);
  });
});
