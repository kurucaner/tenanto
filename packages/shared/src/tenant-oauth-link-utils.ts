export type TOauthProviderLinkDecision = "already_linked" | "can_link" | "conflict";

/**
 * Pure link decision for Google/Apple ids on an email-matched tenant (or platform) user.
 * Mirrors the conflict rules used by `users.findOrCreateBy*`.
 */
export function resolveOauthProviderLinkDecision(input: {
  providerId: string;
  storedProviderId: string | null | undefined;
}): TOauthProviderLinkDecision {
  if (input.storedProviderId == null || input.storedProviderId === "") {
    return "can_link";
  }
  if (input.storedProviderId === input.providerId) {
    return "already_linked";
  }
  return "conflict";
}

/** True when a verified phone row belongs to a different tenant user than the binder. */
export function isPhoneOwnedByOtherUser(input: {
  candidateOwnerId: string;
  existingOwnerId: string | null | undefined;
}): boolean {
  return (
    input.existingOwnerId != null &&
    input.existingOwnerId !== "" &&
    input.existingOwnerId !== input.candidateOwnerId
  );
}
