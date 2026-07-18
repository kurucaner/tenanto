import { describe, expect, test } from "bun:test";

import { defineDomainError } from "./define-domain-error";

describe("defineDomainError", () => {
  test("creates subclasses with default message and custom overrides", () => {
    class PortalInviteNotFoundError extends defineDomainError("Portal invite not found") {}

    const error = new PortalInviteNotFoundError();

    expect(error).toBeInstanceOf(PortalInviteNotFoundError);
    expect(error.message).toBe("Portal invite not found");
    expect(error.name).toBe("PortalInviteNotFoundError");
    expect(new PortalInviteNotFoundError("Custom message").message).toBe("Custom message");
  });
});
