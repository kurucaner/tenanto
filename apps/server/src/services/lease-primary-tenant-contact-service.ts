import { loadPrimaryMembershipForLease } from "@/db/lease-tenant-memberships";
import { tenantUsersDb } from "@/db/tenant-users";
import {
  type ILeasePrimaryTenantContact,
  type IPropertyLongStay,
  resolvePrimaryTenantContact,
} from "@/packages/shared";

export async function resolvePrimaryTenantContactForLongStay(
  longStay: IPropertyLongStay
): Promise<ILeasePrimaryTenantContact> {
  const membership = await loadPrimaryMembershipForLease(longStay.id);
  const tenantUser =
    membership?.tenantUserId != null ? await tenantUsersDb.findById(membership.tenantUserId) : null;

  return resolvePrimaryTenantContact({
    lease: longStay,
    membership,
    tenantUser,
  });
}
