import "dotenv/config";

import { APP_NAME } from "@/packages/shared";

import { sendSms } from "./src/sns/sns";

const toPhone = "+19297328311";

sendSms({
  fromPhoneNumber: process.env.SNS_SMS_ORIGINATION_NUMBER,
  message: `${APP_NAME} - SNS test: If you see this, SNS is working.`,
  phoneNumber: toPhone,
})
  .then(() => console.info("Successfully sent SMS"))
  .catch((err) => console.error("Failed:", err));
