import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

import { awsStaticCredentials } from "@/lib/aws-static-credentials";
import { APP_NAME } from "@/packages/shared";

const ses = new SESv2Client({
  credentials: awsStaticCredentials(),
  region: "us-east-1",
});

export const FROM_EMAIL = "noreply@propertyos.app";

function buildRawEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubUrl: string;
}) {
  const boundary = "ALT-" + Math.random().toString(36).slice(2);
  const from = `${APP_NAME} <${FROM_EMAIL}>`;
  const listUnsub = `<${opts.unsubUrl}>, <mailto:unsubscribe@propertyos.app?subject=unsubscribe&body=${encodeURIComponent(
    opts.to
  )}>`;

  const headers = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `List-Unsubscribe: ${listUnsub}`,
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join("\r\n");

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    opts.text || "",
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    opts.html || "",
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  return `${headers}\r\n\r\n${body}`;
}

export async function sendSesEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubUrl: string;
}) {
  const raw = buildRawEmail(opts);

  const bytes = Buffer.from(raw, "utf-8");

  return await ses.send(
    new SendEmailCommand({
      Content: {
        Raw: {
          Data: bytes,
        },
      },
    })
  );
}

function buildTransactionalRawEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const boundary = "ALT-" + Math.random().toString(36).slice(2);
  const from = `${APP_NAME} <${FROM_EMAIL}>`;

  const headers = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join("\r\n");

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    opts.text || "",
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    opts.html || "",
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  return `${headers}\r\n\r\n${body}`;
}

export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const raw = buildTransactionalRawEmail(opts);
  const bytes = Buffer.from(raw, "utf-8");

  return await ses.send(
    new SendEmailCommand({
      Content: {
        Raw: {
          Data: bytes,
        },
      },
    })
  );
}
