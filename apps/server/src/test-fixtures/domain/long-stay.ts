import { type IPropertyLongStay, PropertyLongStayStatus } from "@/packages/shared";

export function makeLongStay(overrides: Partial<IPropertyLongStay> = {}): IPropertyLongStay {
  return {
    actualEndDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    guestName: "Jane Tenant",
    id: "lease-1",
    leaseEndDate: "2026-12-31",
    leaseStartDate: "2026-01-01",
    monthlyRent: 1500,
    propertyId: "property-1",
    secondaryTenants: [],
    status: PropertyLongStayStatus.ACTIVE,
    tenantEmail: "jane@example.com",
    tenantPhone: null,
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Alias used in portal and lease service tests. */
export const makeLease = makeLongStay;
