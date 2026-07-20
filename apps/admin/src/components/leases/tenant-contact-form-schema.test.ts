import { describe, expect, test } from "bun:test";

import { createTenantContactFormSchema } from "@/components/leases/tenant-contact-form-schema";

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
