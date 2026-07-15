export const queryKeys = {
  invitePreview: (token: string) => ["tenant", "invite-preview", token] as const,
  lease: (leaseId: string) => ["tenant", "lease", leaseId] as const,
  leases: (status: "active" | "ended" = "active") => ["tenant", "leases", status] as const,
  me: () => ["tenant", "me"] as const,
  pendingInvites: () => ["tenant", "invites", "pending"] as const,
};
