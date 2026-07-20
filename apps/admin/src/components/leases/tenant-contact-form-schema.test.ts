import { describe, expect, test } from "bun:test";

import { createTenantContactFormSchema, getTenantContactFormErrorMessage } from "@/components/leases/tenant-contact-form-schema";

describe("getTenantContactFormErrorMessage", () => {
  test("returns the first available field error message", () => {
    expect(
      getTenantContactFormErrorMessage({
        tenantEmail: { message: "Email cannot match the primary tenant's email", type: "custom" },
      })
    ).toBe("Email cannot match the primary tenant's email");
  });
});

describe("createTenantContactFormSchema", () => {
  test("rejects email that matches a blocked primary tenant email", () => {
    const schema = createTenantContactFormSchema({
      blockedEmails: ["primary@example.com"],
    });

    const result = schema.safeParse({
      name: "Secondary Tenant",
      tenantEmail: "Primary@Example.com",
      tenantPhone: "+13055550111",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Email cannot match the primary tenant's email"
      );
    }
  });

  test("allows a different email when primary is blocked", () => {
    const schema = createTenantContactFormSchema({
      blockedEmails: ["primary@example.com"],
    });

    const result = schema.safeParse({
      name: "Secondary Tenant",
      tenantEmail: "secondary@example.com",
      tenantPhone: "+13055550111",
    });

    expect(result.success).toBe(true);
  });

  test("allows blank email when primary is blocked", () => {
    const schema = createTenantContactFormSchema({
      blockedEmails: ["primary@example.com"],
    });

    const result = schema.safeParse({
      name: "Secondary Tenant",
      tenantEmail: "",
      tenantPhone: "+13055550111",
    });

    expect(result.success).toBe(true);
  });
});
