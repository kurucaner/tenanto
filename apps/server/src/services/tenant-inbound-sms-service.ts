import { tenantSmsKeywordEventsDb, truncatePayloadSnippet } from "@/db/tenant-sms-keyword-events";
import { tenantUsersDb } from "@/db/tenant-users";
import { isTenantPhoneAuthEnabled } from "@/lib/tenant-auth-expansion-config";
import {
  buildTenantSmsHelpMessage,
  buildTenantSmsOptOutConfirmationMessage,
  parseTenantSmsInboundKeyword,
  TenantSmsInboundKeyword,
  type TTenantSmsInboundKeyword,
} from "@/packages/shared";
import { type ISmsInboundMessage } from "@/sns/sms-inbound-utils";
import { sendSms } from "@/sns/sns";

export const TenantInboundSmsAction = {
  HELP_REPLIED: "help_replied",
  LOGGED: "logged",
  STOP_PROCESSED: "stop_processed",
} as const;

export type TTenantInboundSmsAction =
  (typeof TenantInboundSmsAction)[keyof typeof TenantInboundSmsAction];

export interface ITenantInboundSmsResult {
  action: TTenantInboundSmsAction;
  keyword: TTenantSmsInboundKeyword;
}

function resolveKeywordSource(message: ISmsInboundMessage): string {
  return message.messageKeyword ?? message.messageBody;
}

async function recordKeywordEvent(input: {
  keyword: TTenantSmsInboundKeyword;
  payload: unknown;
  phone: string;
  tenantUserId: string | null;
}): Promise<void> {
  await tenantSmsKeywordEventsDb.insert({
    keyword: input.keyword,
    payloadSnippet: truncatePayloadSnippet(input.payload),
    phone: input.phone,
    tenantUserId: input.tenantUserId,
  });
}

export async function handleTenantInboundSms(input: {
  message: ISmsInboundMessage;
  payload: unknown;
}): Promise<ITenantInboundSmsResult | null> {
  if (!isTenantPhoneAuthEnabled()) {
    return null;
  }

  const keyword = parseTenantSmsInboundKeyword(resolveKeywordSource(input.message));
  const tenantUser = await tenantUsersDb.findByPhone(input.message.originationNumber);

  await recordKeywordEvent({
    keyword,
    payload: input.payload,
    phone: input.message.originationNumber,
    tenantUserId: tenantUser?.id ?? null,
  });

  if (keyword === TenantSmsInboundKeyword.HELP) {
    await sendSms({
      message: buildTenantSmsHelpMessage(),
      phoneNumber: input.message.originationNumber,
    });
    return { action: TenantInboundSmsAction.HELP_REPLIED, keyword };
  }

  if (keyword === TenantSmsInboundKeyword.STOP) {
    if (tenantUser != null) {
      await tenantUsersDb.optOutOfSms(tenantUser.id);
      await sendSms({
        message: buildTenantSmsOptOutConfirmationMessage(),
        phoneNumber: input.message.originationNumber,
      });
      return { action: TenantInboundSmsAction.STOP_PROCESSED, keyword };
    }

    return { action: TenantInboundSmsAction.LOGGED, keyword };
  }

  return { action: TenantInboundSmsAction.LOGGED, keyword };
}
