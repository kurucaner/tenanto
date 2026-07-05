export interface ISupportRequestsListQuerystring {
  category?: string;
  cursor?: string;
  limit?: string;
  status?: string;
}

export interface IUsersListQuerystring {
  cursor?: string;
  include_deleted?: string;
  limit?: string;
  q?: string;
  user_type?: string;
}

export interface IAuditEventsListQuerystring {
  actor_user_id?: string;
  cursor?: string;
  limit?: string;
  resource_id?: string;
  resource_type?: string;
}
