export const queryKeys = {
  leases: () => ["tenant", "leases"] as const,
  me: () => ["tenant", "me"] as const,
  pendingInvites: () => ["tenant", "invites", "pending"] as const,
};
