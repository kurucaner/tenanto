import {
  type ITenantLeaseListItem,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "@/packages/shared";

export function makeLeaseListItem(
  overrides: Pick<ITenantLeaseListItem, "leaseId" | "propertyName" | "unitLabel"> &
    Partial<ITenantLeaseListItem>
): ITenantLeaseListItem {
  return {
    leaseEndDate: "2026-12-31",
    leaseStartDate: "2026-01-01",
    role: TenantMembershipRole.PRIMARY,
    status: TenantMembershipStatus.ACTIVE,
    ...overrides,
  };
}

export function makeRentScheduleRow(overrides: {
  expectedRent: number;
  isPaid: boolean;
  month: string;
  paidRent?: number;
  remainingRent?: number;
}) {
  const paidRent = overrides.paidRent ?? (overrides.isPaid ? overrides.expectedRent : 0);
  const remainingRent =
    overrides.remainingRent ?? (overrides.isPaid ? 0 : overrides.expectedRent - paidRent);

  return {
    expectedRent: overrides.expectedRent,
    isPaid: overrides.isPaid,
    month: overrides.month,
    paidRent,
    remainingRent,
  };
}
