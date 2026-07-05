import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { emailUnsubscribesDb } from "@/db/email-unsubscribes";
import { APP_NAME } from "@/packages/shared";
import { verifyUnsubscribeToken } from "@/ses/unsubscribe-token";

const WEB_APP_URL = process.env.WEB_APP_URL;

const SUCCESS_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed - ${APP_NAME}</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #0c0c0c; color: #ededed; margin: 0; padding: 2rem; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
  <div style="text-align: center; max-width: 400px;">
    <h1 style="color: #d4b034; font-size: 1.5rem; margin-bottom: 1rem;">You've been unsubscribed</h1>
    <p style="color: rgba(237,237,237,0.8); line-height: 1.6;">You will no longer receive vault release emails from ${APP_NAME}.</p>
  </div>
</body>
</html>
`.trim();

const ERROR_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invalid link - ${APP_NAME}</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #0c0c0c; color: #ededed; margin: 0; padding: 2rem; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
  <div style="text-align: center; max-width: 400px;">
    <h1 style="color: #d4b034; font-size: 1.5rem; margin-bottom: 1rem;">Invalid or expired link</h1>
    <p style="color: rgba(237,237,237,0.8); line-height: 1.6;">This unsubscribe link is invalid or has expired.</p>
  </div>
</body>
</html>
`.trim();

async function unsubscribeHandler(
  request: FastifyRequest<{ Querystring: { token?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const token = request.query.token;

  if (!token) {
    if (WEB_APP_URL) {
      await reply.redirect(`${WEB_APP_URL.replace(/\/$/, "")}/unsubscribe?error=missing`, 302);
      return;
    }
    await reply.type("text/html").send(ERROR_HTML);
    return;
  }

  const email = verifyUnsubscribeToken(token);
  if (!email) {
    if (WEB_APP_URL) {
      await reply.redirect(`${WEB_APP_URL.replace(/\/$/, "")}/unsubscribe?error=invalid`, 302);
      return;
    }
    await reply.type("text/html").send(ERROR_HTML);
    return;
  }

  await emailUnsubscribesDb.add(email);

  if (WEB_APP_URL) {
    await reply.redirect(`${WEB_APP_URL.replace(/\/$/, "")}/unsubscribe?success=1`, 302);
    return;
  }

  await reply.type("text/html").send(SUCCESS_HTML);
}

export async function unsubscribeRoutes(server: FastifyInstance): Promise<void> {
  server.get<{ Querystring: { token?: string } }>("/unsubscribe", unsubscribeHandler);
}
