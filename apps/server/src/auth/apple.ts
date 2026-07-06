import appleSignin from "apple-signin-auth";

export interface AppleUserPayload {
  appleId: string;
  email: string | null;
  name: string;
}

export const verifyAppleToken = async (identityToken: string): Promise<AppleUserPayload> => {
  const bundleId = "com.propertyos.app";
  if (!bundleId) {
    throw new Error("APPLE_BUNDLE_ID is not configured");
  }

  const payload = await appleSignin.verifyIdToken(identityToken, {
    audience: bundleId,
  });

  const sub = payload.sub;
  if (!sub) {
    throw new Error("Invalid Apple token payload: missing sub");
  }

  const email = typeof payload.email === "string" ? payload.email : null;
  const name = email ? (email.split("@")[0] ?? "Apple User") : "Apple User";

  return {
    appleId: sub,
    email,
    name,
  };
};
