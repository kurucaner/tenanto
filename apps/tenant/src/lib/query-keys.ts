export const queryKeys = {
  invitePreview: (token: string) => ["tenant", "invite-preview", token] as const,
  lease: (leaseId: string) => ["tenant", "lease", leaseId] as const,
  leaseBalance: (leaseId: string) => ["tenant", "lease-balance", leaseId] as const,
  rentPaymentIntent: (leaseId: string, paymentMethodFamily: string) =>
    ["tenant", "rent-payment-intent", leaseId, paymentMethodFamily] as const,
  leases: (status: "active" | "ended" = "active") => ["tenant", "leases", status] as const,
  me: () => ["tenant", "me"] as const,
  pendingInvites: () => ["tenant", "invites", "pending"] as const,
  rentPayment: (paymentId: string) => ["tenant", "rent-payment", paymentId] as const,
  rentSummary: () => ["tenant", "rent-summary"] as const,
};
