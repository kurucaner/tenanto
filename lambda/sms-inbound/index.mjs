function buildInboundWebhookBody(event) {
  const snsMessage = event?.Records?.[0]?.Sns?.Message;
  if (typeof snsMessage === "string" && snsMessage.length > 0) {
    return { Message: snsMessage };
  }

  if (event?.originationNumber != null || event?.phoneNumber != null) {
    return event;
  }

  return event;
}

export async function handler(event) {
  const apiUrl = process.env.API_PUBLIC_URL?.replace(/\/$/, "");
  const secret = process.env.AWS_INTERNAL_SECRET;

  if (!apiUrl || !secret) {
    throw new Error("Missing API_PUBLIC_URL or AWS_INTERNAL_SECRET");
  }

  const response = await fetch(`${apiUrl}/webhooks/sms/inbound`, {
    body: JSON.stringify(buildInboundWebhookBody(event)),
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": secret,
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API returned ${response.status}${body ?? ""}`);
  }

  return { ok: true };
}
