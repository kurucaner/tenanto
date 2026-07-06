export async function handler(event) {
  const apiUrl = process.env.API_PUBLIC_URL?.replace(/\/$/, "");
  const secret = process.env.AWS_INTERNAL_SECRET;

  if (!apiUrl || !secret) {
    throw new Error("Missing API_PUBLIC_URL or AWS_INTERNAL_SECRET");
  }

  const response = await fetch(`${apiUrl}/s3-notification`, {
    body: JSON.stringify(event),
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
