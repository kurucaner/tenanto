export const queryKeys = {
  invitePreview: (token: string) => ["tenant", "invite-preview", token] as const,
  leases: () => ["tenant", "leases"] as const,
  me: () => ["tenant", "me"] as const,
  pendingInvites: () => ["tenant", "invites", "pending"] as const,
};
