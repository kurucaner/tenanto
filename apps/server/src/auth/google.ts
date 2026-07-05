import { OAuth2Client } from "google-auth-library";

import { TPlatform } from "@/packages/shared";

const client = new OAuth2Client();

interface GoogleUserPayload {
  email: string;
  googleId: string;
  name: string;
}

interface VerifyGoogleTokenParams {
  idToken: string;
  platform: TPlatform;
}

export const verifyGoogleToken = async ({
  idToken,
}: VerifyGoogleTokenParams): Promise<GoogleUserPayload> => {
  const webClientId = process.env["GOOGLE_WEB_CLIENT_ID"];

  if (!webClientId) {
    throw new Error("GOOGLE_WEB_CLIENT_ID is not configured");
  }

  const ticket = await client.verifyIdToken({
    audience: webClientId,
    idToken,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Invalid Google token payload");
  }

  return {
    email: payload.email,
    googleId: payload.sub,
    name: payload.name ?? payload.email.split("@")[0] ?? "User",
  };
};
