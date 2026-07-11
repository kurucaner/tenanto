import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

import {
  APP_NAME,
  isValidE164,
  normalizeToE164,
  parsePhoneToParts,
  PHONE_DEFAULT_COUNTRY,
} from "@/packages/shared";

const sns = new SNSClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION ?? "us-east-1",
});

export interface ISendSmsOptions {
  message: string;
  phoneNumber: string;
}

export function resolveSmsPhoneNumber(phoneNumber: string): string {
  const trimmed = phoneNumber.trim();
  const normalized =
    normalizeToE164(trimmed) ?? parsePhoneToParts(trimmed, PHONE_DEFAULT_COUNTRY).e164;
  if (!normalized || !isValidE164(normalized)) {
    throw new Error("phoneNumber must be a valid E.164 phone number");
  }
  return normalized;
}

export async function sendSms(opts: ISendSmsOptions) {
  const phoneNumber = resolveSmsPhoneNumber(opts.phoneNumber);
  const message = opts.message.trim();
  if (message === "") {
    throw new Error("message is required");
  }

  const messageAttributes: Record<string, { DataType: string; StringValue: string }> = {
    "AWS.SNS.SMS.SMSType": {
      DataType: "String",
      StringValue: "Transactional",
    },
  };

  if (APP_NAME) {
    messageAttributes["AWS.SNS.SMS.SenderID"] = {
      DataType: "String",
      StringValue: APP_NAME,
    };
  }

  return sns.send(
    new PublishCommand({
      Message: message,
      MessageAttributes: messageAttributes,
      PhoneNumber: phoneNumber,
    })
  );
}
