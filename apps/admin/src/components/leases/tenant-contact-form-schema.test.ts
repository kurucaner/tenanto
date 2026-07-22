import { describe, expect, test } from "bun:test";

import {
  createTenantContactFormSchema,
  DUPLICATE_SECONDARY_TENANT_EMAIL_MESSAGE,
  getSecondaryTenantMutationErrorMessage,
  getTenantContactFormErrorMessage,
  isLeaseTenantContactUnchanged,
  isPrimaryTenantContactUnchanged,
  PRIMARY_TENANT_EMAIL_MATCH_MESSAGE,
} from "@/components/leases/tenant-contact-form-schema";

describe("getTenantContactFormErrorMessage", () => {
  test("returns the first available field error message", () => {
    expect(
      getTenantContactFormErrorMessage({
        tenantEmail: { message: PRIMARY_TENANT_EMAIL_MATCH_MESSAGE, type: "custom" },
      })
    ).toBe(PRIMARY_TENANT_EMAIL_MATCH_MESSAGE);
  });
});

describe("getSecondaryTenantMutationErrorMessage", () => {
  test("maps PORTAL_INVITE_DUPLICATE to the secondary duplicate message", () => {
    const error = new Error("A pending portal invite already exists for this lease occupant");
    (error as Error & { code?: string }).code = "PORTAL_INVITE_DUPLICATE";

    expect(getSecondaryTenantMutationErrorMessage(error, "Failed")).toBe(
      DUPLICATE_SECONDARY_TENANT_EMAIL_MESSAGE
    );
  });
});

describe("createTenantContactFormSchema", () => {
  test("rejects email that matches the primary tenant email", () => {
    const schema = createTenantContactFormSchema({
      primaryTenantEmail: "primary@example.com",
    });

    const result = schema.safeParse({
      name: "Secondary Tenant",
      tenantEmail: "Primary@Example.com",
      tenantPhone: "+13055550111",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(PRIMARY_TENANT_EMAIL_MATCH_MESSAGE);
    }
  });

  test("rejects email that matches an existing secondary tenant email", () => {
    const schema = createTenantContactFormSchema({
      secondaryTenantEmails: ["john@gmail.com"],
    });

    const result = schema.safeParse({
      name: "Another Secondary",
      tenantEmail: "John@gmail.com",
      tenantPhone: "+13055550111",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DUPLICATE_SECONDARY_TENANT_EMAIL_MESSAGE);
    }
  });

  test("allows a different email when primary and secondary emails are blocked", () => {
    const schema = createTenantContactFormSchema({
      primaryTenantEmail: "primary@example.com",
      secondaryTenantEmails: ["john@gmail.com"],
    });

    const result = schema.safeParse({
      name: "Secondary Tenant",
      tenantEmail: "secondary@example.com",
      tenantPhone: "+13055550111",
    });

    expect(result.success).toBe(true);
  });

  test("allows blank email when primary and secondary emails are blocked", () => {
    const schema = createTenantContactFormSchema({
      primaryTenantEmail: "primary@example.com",
      secondaryTenantEmails: ["john@gmail.com"],
    });

    const result = schema.safeParse({
      name: "Secondary Tenant",
      tenantEmail: "",
      tenantPhone: "+13055550111",
    });

    expect(result.success).toBe(true);
  });

  test("allows keeping the same email when it is excluded during edit", () => {
    const schema = createTenantContactFormSchema({
      excludeEmail: "john@gmail.com",
      secondaryTenantEmails: ["john@gmail.com", "other@example.com"],
    });

    const result = schema.safeParse({
      name: "Secondary Tenant",
      tenantEmail: "john@gmail.com",
      tenantPhone: "+13055550111",
    });

    expect(result.success).toBe(true);
  });

  test("rejects changing to another secondary email during edit", () => {
    const schema = createTenantContactFormSchema({
      excludeEmail: "john@gmail.com",
      secondaryTenantEmails: ["john@gmail.com", "other@example.com"],
    });

    const result = schema.safeParse({
      name: "Secondary Tenant",
      tenantEmail: "other@example.com",
      tenantPhone: "+13055550111",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DUPLICATE_SECONDARY_TENANT_EMAIL_MESSAGE);
    }
  });
});

describe("isLeaseTenantContactUnchanged", () => {
  const contact = {
    effectiveEmail: "tenant@example.com",
    effectiveName: "Secondary Tenant",
    effectivePhone: "+13055550111",
  };

  test("true when values match the current contact", () => {
    expect(
      isLeaseTenantContactUnchanged(
        {
          name: "Secondary Tenant",
          tenantEmail: "tenant@example.com",
          tenantPhone: "+13055550111",
        },
        contact
      )
    ).toBe(true);
  });

  test("false when a field changed", () => {
    expect(
      isLeaseTenantContactUnchanged(
        {
          name: "Secondary Tenant",
          tenantEmail: "other@example.com",
          tenantPhone: "+13055550111",
        },
        contact
      )
    ).toBe(false);
  });
});

describe("isPrimaryTenantContactUnchanged", () => {
  const contact = {
    effectiveEmail: "tenant@example.com",
    effectiveName: "Primary Tenant",
    effectivePhone: "+13055550111",
  };

  test("true when values match the current contact", () => {
    expect(
      isPrimaryTenantContactUnchanged(
        {
          name: "Primary Tenant",
          tenantEmail: "tenant@example.com",
          tenantPhone: "+13055550111",
        },
        contact
      )
    ).toBe(true);
  });

  test("false when name, email, or phone changed", () => {
    expect(
      isPrimaryTenantContactUnchanged(
        { name: "Other", tenantEmail: "tenant@example.com", tenantPhone: "+13055550111" },
        contact
      )
    ).toBe(false);
    expect(
      isPrimaryTenantContactUnchanged(
        {
          name: "Primary Tenant",
          tenantEmail: "other@example.com",
          tenantPhone: "+13055550111",
        },
        contact
      )
    ).toBe(false);
    expect(
      isPrimaryTenantContactUnchanged(
        { name: "Primary Tenant", tenantEmail: "tenant@example.com", tenantPhone: "" },
        contact
      )
    ).toBe(false);
  });

  test("treats empty email/phone as null", () => {
    expect(
      isPrimaryTenantContactUnchanged(
        { name: "Primary Tenant", tenantEmail: "", tenantPhone: "" },
        { effectiveEmail: null, effectiveName: "Primary Tenant", effectivePhone: null }
      )
    ).toBe(true);
  });
});
