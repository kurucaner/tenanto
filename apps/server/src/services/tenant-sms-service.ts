import {
  buildTenantSmsOptInConfirmationMessage,
  canReceiveSms,
  type ITenantUser,
} from "@/packages/shared";
import { sendSms } from "@/sns/sns";

export async function sendTenantSms(input: {
  message: string;
  phoneNumber: string;
  tenantUser: ITenantUser;
}): Promise<void> {
  if (!canReceiveSms(input.tenantUser)) {
    return;
  }

  await sendSms({
    message: input.message,
    phoneNumber: input.phoneNumber,
  });
}

export async function sendTenantOptInConfirmationSms(input: {
  phoneNumber: string;
  tenantUser: ITenantUser;
}): Promise<void> {
  await sendTenantSms({
    message: buildTenantSmsOptInConfirmationMessage(),
    phoneNumber: input.phoneNumber,
    tenantUser: input.tenantUser,
  });
}
