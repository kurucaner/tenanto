import "dotenv/config";

import { APP_NAME } from "@/packages/shared";

import { sendSesEmail } from "./src/ses/ses";

const toEmail = "kurucaner@gmail.com";

sendSesEmail({
  html: "<p>If you see this, SES is working.</p>",
  subject: `${APP_NAME} - SES Test`,
  text: "If you see this, SES is working.",
  to: toEmail,
  unsubUrl: `${process.env.WEB_APP_URL}/unsubscribe`,
})
  .then(() => console.info("Successfully sent email"))
  .catch((err) => console.error("Failed:", err));
