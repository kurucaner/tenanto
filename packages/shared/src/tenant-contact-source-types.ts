export type TTenantContactLinkedUserSource = "linked_user";
export type TTenantContactMembershipPendingSource = "membership_pending";

export type TPrimaryTenantContactSource =
  | TTenantContactLinkedUserSource
  | TTenantContactMembershipPendingSource
  | "lease";

export type TSecondaryTenantContactSource =
  | TTenantContactLinkedUserSource
  | TTenantContactMembershipPendingSource
  | "membership_listed";
