import { tenantUsersDb } from "@/db/tenant-users";
import { isTenantPhoneAuthEnabled } from "@/lib/tenant-auth-expansion-config";
import { HttpStatus, type ITenantUser } from "@/packages/shared";

export type TTenantSmsOptOutSuccess = { status: "ok"; user: ITenantUser };
export type TTenantSmsOptOutFailure = {
  body: { error: string };
  status: "error";
  statusCode: number;
};
export type TTenantSmsOptOutResult = TTenantSmsOptOutFailure | TTenantSmsOptOutSuccess;

export async function optOutTenantSms(tenantUserId: string): Promise<TTenantSmsOptOutResult> {
  if (!isTenantPhoneAuthEnabled()) {
    return {
      body: { error: "Not found" },
      status: "error",
      statusCode: HttpStatus.NOT_FOUND,
    };
  }

  const user = await tenantUsersDb.optOutOfSms(tenantUserId);
  if (!user) {
    return {
      body: { error: "Tenant account not found" },
      status: "error",
      statusCode: HttpStatus.NOT_FOUND,
    };
  }

  return { status: "ok", user };
}
