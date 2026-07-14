import { clearAppSession } from "@/lib/clear-app-session";
import {
  type IAdminAddPropertyMemberBody,
  type IAdminAuditEventsListQuery,
  type IAdminAuditEventsListResponse,
  type IAdminCreatePropertyBody,
  type IAdminPatchAppConfigBody,
  type IAdminPlatformStats,
  type IAdminPropertiesListResponse,
  type IAdminSetPropertyFavoriteBody,
  type IAdminSupportRequestPatchBody,
  type IAdminSupportRequestPatchResponse,
  type IAdminUpdatePropertyBody,
  type IAdminUpdatePropertyMemberBody,
  type IAppConfig,
  type ICreatePropertyExpenseBody,
  type ICreatePropertyIncomeLineBody,
  type ICreatePropertyLongStayBody,
  type ICreatePropertyReservationBody,
  type ICreatePropertyUnitBody,
  type ICreateTenantEmailCampaignBody,
  type IEndPropertyLongStayBody,
  type IExpenseImportCommitBody,
  type IExpenseImportCommitResponse,
  type IExpenseImportParseResponse,
  type IExportJobDownloadResponse,
  type IExtendPropertyLongStayBody,
  type IHomeFinancialOverview,
  type IIncomeImportCommitBody,
  type IIncomeImportCommitResponse,
  type IIncomeImportParseResponse,
  type IPortfolioReportSummary,
  type IProperty,
  type IPropertyDetail,
  type IPropertyExpense,
  type IPropertyExpensesListQuery,
  type IPropertyExpensesListResponse,
  type IPropertyExportCreateRequest,
  type IPropertyExportCreateResponse,
  type IPropertyExportDetailResponse,
  type IPropertyExportsListQuery,
  type IPropertyExportsListResponse,
  type IPropertyIncomeEntriesListQuery,
  type IPropertyIncomeEntriesListResponse,
  type IPropertyIncomeLine,
  type IPropertyIncomeLinesListQuery,
  type IPropertyIncomeLinesListResponse,
  type IPropertyLongStay,
  type IPropertyLongStayDetailResponse,
  type IPropertyLongStaysListQuery,
  type IPropertyLongStaysListResponse,
  type IPropertyMember,
  type IPropertyReportsQuery,
  type IPropertyReportSummary,
  type IPropertyReservation,
  type IPropertyReservationsListQuery,
  type IPropertySettings,
  type IPropertyShortStaysListResponse,
  type IPropertyUnit,
  type IPropertyUnitsListQuery,
  type IPropertyUnitsListResponse,
  type IRefundLedgerEntryBody,
  type ISupportAttachmentPresignBody,
  type ISupportAttachmentPresignResponse,
  type ISupportCloseResponse,
  type ISupportCreateBody,
  type ISupportMessageCreateBody,
  type ISupportRequestDetail,
  type ISupportRequestsListQuery,
  type ISupportRequestsListResponse,
  type ITenantEmailCampaignCreateResponse,
  type ITenantEmailCampaignDetailResponse,
  type ITenantEmailCampaignListResponse,
  type ITenantEmailCampaignPreviewResponse,
  type ITenantEmailCampaignReenqueueResponse,
  type ITenantEmailCampaignsListQuery,
  type IUpdatePropertyExpenseBody,
  type IUpdatePropertyIncomeLineBody,
  type IUpdatePropertyLongStayBody,
  type IUpdatePropertyReservationBody,
  type IUpdatePropertySettingsBody,
  type IUpdatePropertyUnitBody,
  type IUser,
  type IUserNotification,
  type IUserNotificationsListQuery,
  type IUserNotificationsListResponse,
  type IUserNotificationsMarkAllReadResponse,
  type IUserNotificationsUnreadCountResponse,
  JwtError,
  type TAddPropertyMemberResponse,
  type UserType,
} from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

function getApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL;
  if (url == null || url === "") {
    throw new Error("VITE_API_URL is not set");
  }
  return url.replace(/\/$/, "");
}

type RequestOptions = RequestInit & { omitDefaultContentType?: boolean };

let onSessionExpired: (() => void) | undefined;

export const setOnSessionExpired = (callback: (() => void) | undefined): void => {
  onSessionExpired = callback;
};

const getDefaultHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
});

const rawRequest = async (path: string, options: RequestOptions = {}): Promise<Response> => {
  const { omitDefaultContentType, ...requestInit } = options;
  const defaultHeaders = { ...getDefaultHeaders() };
  if (omitDefaultContentType) {
    delete defaultHeaders["Content-Type"];
  }
  return fetch(`${getApiBaseUrl()}${path}`, {
    ...requestInit,
    headers: {
      ...defaultHeaders,
      ...requestInit.headers,
    },
  });
};

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await rawRequest(path, options);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
    const err = new Error(body.error ?? `Request failed: ${response.status}`);
    (err as Error & { code?: string }).code = body.code;
    throw err;
  }
  return parseJsonResponse<T>(response);
};

let inFlightRefresh: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    clearAppSession();
    onSessionExpired?.();
    return null;
  }
  try {
    const result = await request<IAuthRefreshResponse>("/auth/refresh", {
      body: JSON.stringify({ refreshToken }),
      method: "POST",
    });
    useAuthStore.getState().setAccessToken(result.accessToken);
    useAuthStore.getState().setUser(result.user);
    return result.accessToken;
  } catch {
    clearAppSession();
    onSessionExpired?.();
    return null;
  }
};

const getDeduplicatedRefresh = (): Promise<string | null> => {
  if (!inFlightRefresh) {
    inFlightRefresh = refreshAccessToken().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
};

export const refreshAccessTokenForStream = (): Promise<string | null> => getDeduplicatedRefresh();

export const getApiBaseUrlForClient = getApiBaseUrl;

const handleSessionInvalid = (): never => {
  clearAppSession();
  onSessionExpired?.();
  throw new Error("Session expired");
};

interface UnauthorizedBody {
  code?: string;
  error?: string;
}

const authenticatedRequest = async <T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false
): Promise<T> => {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await rawRequest(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.ok) {
    return parseJsonResponse<T>(response);
  }

  if (response.status === 403) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Forbidden");
  }

  if (response.status !== 401) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${response.status}`);
  }

  const body = (await response.json().catch(() => ({}))) as UnauthorizedBody;
  const code = body.code;

  if (code !== JwtError.TOKEN_EXPIRED) {
    handleSessionInvalid();
  }

  if (isRetry) {
    handleSessionInvalid();
  }

  const newToken = await getDeduplicatedRefresh();
  if (!newToken) {
    throw new Error("Session expired");
  }

  return authenticatedRequest<T>(path, options, true);
};

const authenticatedMultipartRequest = async <T>(
  path: string,
  formData: FormData,
  isRetry = false
): Promise<T> => {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "POST",
  });

  if (response.ok) {
    return parseJsonResponse<T>(response);
  }

  if (response.status === 403) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Forbidden");
  }

  if (response.status !== 401) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${response.status}`);
  }

  const body = (await response.json().catch(() => ({}))) as UnauthorizedBody;
  const code = body.code;

  if (code !== JwtError.TOKEN_EXPIRED) {
    handleSessionInvalid();
  }

  if (isRetry) {
    handleSessionInvalid();
  }

  const newToken = await getDeduplicatedRefresh();
  if (!newToken) {
    throw new Error("Session expired");
  }

  return authenticatedMultipartRequest<T>(path, formData, true);
};

const authenticatedDownload = async (
  path: string,
  options: RequestOptions = {},
  isRetry = false
): Promise<Blob> => {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await rawRequest(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
    omitDefaultContentType: true,
  });

  if (response.ok) {
    return response.blob();
  }

  if (response.status === 403) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Forbidden");
  }

  if (response.status !== 401) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${response.status}`);
  }

  const body = (await response.json().catch(() => ({}))) as UnauthorizedBody;
  const code = body.code;

  if (code !== JwtError.TOKEN_EXPIRED) {
    handleSessionInvalid();
  }

  if (isRetry) {
    handleSessionInvalid();
  }

  const newToken = await getDeduplicatedRefresh();
  if (!newToken) {
    throw new Error("Session expired");
  }

  return authenticatedDownload(path, options, true);
};

interface IAuthEmailResponse {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

interface IAuthRefreshResponse {
  accessToken: string;
  user: IUser;
}

export interface IAdminUsersListResponse {
  nextCursor: string | null;
  users: IUser[];
}

export interface IAdminUserDetailUser extends IUser {
  deletedAt: string | null;
  hasPassword: boolean;
  isDeleted: boolean;
}

export interface IAdminUserDetailResponse {
  stats: {
    activePushTokens: number;
  };
  user: IAdminUserDetailUser;
}

export interface IAdminUsersListQuery {
  cursor?: string;
  include_deleted?: boolean;
  limit?: number;
  q?: string;
  user_type?: UserType;
}

function buildCursorLimitSearchParams(query: { cursor?: string; limit?: number }): string {
  const params = new URLSearchParams();
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  const s = params.toString();
  return s === "" ? "" : `?${s}`;
}

function buildAuditEventsSearchParams(query: IAdminAuditEventsListQuery): string {
  const params = new URLSearchParams();
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.resource_type != null && query.resource_type !== "")
    params.set("resource_type", query.resource_type);
  if (query.resource_id != null && query.resource_id !== "")
    params.set("resource_id", query.resource_id);
  if (query.actor_user_id != null && query.actor_user_id !== "")
    params.set("actor_user_id", query.actor_user_id);
  const s = params.toString();
  return s === "" ? "" : `?${s}`;
}

function buildUsersListSearchParams(query: IAdminUsersListQuery): string {
  const params = new URLSearchParams();
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.q != null && query.q !== "") params.set("q", query.q);
  if (query.user_type != null) params.set("user_type", query.user_type);
  if (query.include_deleted === true) params.set("include_deleted", "true");
  const s = params.toString();
  return s === "" ? "" : `?${s}`;
}

function buildSupportRequestsListSearchParams(query: ISupportRequestsListQuery): string {
  const params = new URLSearchParams();
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.status != null) params.set("status", query.status);
  if (query.category != null) params.set("category", query.category);
  const s = params.toString();
  return s === "" ? "" : `?${s}`;
}

export const notificationsApi = {
  getUnreadCount: () =>
    authenticatedRequest<IUserNotificationsUnreadCountResponse>("/notifications/unread-count"),

  list: (query: IUserNotificationsListQuery = {}) =>
    authenticatedRequest<IUserNotificationsListResponse>(
      `/notifications${buildCursorLimitSearchParams(query)}`
    ),

  markAllRead: () =>
    authenticatedRequest<IUserNotificationsMarkAllReadResponse>("/notifications/read-all", {
      method: "POST",
      omitDefaultContentType: true,
    }),

  markRead: (id: string) =>
    authenticatedRequest<{ item: IUserNotification }>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: "PATCH", omitDefaultContentType: true }
    ),
};

export interface ISupportCreateResponse {
  id: string;
  item: ISupportRequestDetail;
  success: boolean;
}

export const supportApi = {
  close: (id: string) =>
    authenticatedRequest<ISupportCloseResponse>(`/support/${encodeURIComponent(id)}/close`, {
      method: "POST",
      omitDefaultContentType: true,
    }),

  create: (body: ISupportCreateBody) =>
    authenticatedRequest<ISupportCreateResponse>("/support", {
      body: JSON.stringify(body),
      method: "POST",
    }),

  get: (id: string) =>
    authenticatedRequest<ISupportRequestDetail>(`/support/${encodeURIComponent(id)}`),

  list: (query: ISupportRequestsListQuery = {}) =>
    authenticatedRequest<ISupportRequestsListResponse>(
      `/support${buildSupportRequestsListSearchParams(query)}`
    ),

  postMessage: (id: string, body: ISupportMessageCreateBody) =>
    authenticatedRequest<ISupportRequestDetail>(`/support/${encodeURIComponent(id)}/messages`, {
      body: JSON.stringify(body),
      method: "POST",
    }),

  presignAttachments: (body: ISupportAttachmentPresignBody) =>
    authenticatedRequest<ISupportAttachmentPresignResponse>("/support/attachments/presign", {
      body: JSON.stringify(body),
      method: "POST",
    }),
};

export interface IAdminPropertiesListQuery {
  cursor?: string;
  limit?: number;
  q?: string;
}

function buildPropertiesListSearchParams(query: IAdminPropertiesListQuery): string {
  const params = new URLSearchParams();
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.q != null && query.q !== "") params.set("q", query.q);
  const s = params.toString();
  return s === "" ? "" : `?${s}`;
}

export const authApi = {
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      body: JSON.stringify({ email: email.trim() }),
      method: "POST",
    }),

  loginEmail: (email: string, password: string) =>
    request<IAuthEmailResponse>("/auth/email", {
      body: JSON.stringify({ email, password }),
      method: "POST",
    }),

  loginGoogle: (idToken: string) =>
    request<IAuthEmailResponse>("/auth/google", {
      body: JSON.stringify({ idToken }),
      method: "POST",
    }),

  logout: (refreshToken: string) =>
    request<{ success: boolean }>("/auth/logout", {
      body: JSON.stringify({ refreshToken }),
      method: "POST",
    }),

  register: (body: { email: string; name: string; password: string }) =>
    request<{ message: string }>("/auth/register", {
      body: JSON.stringify({
        email: body.email.trim(),
        name: body.name.trim(),
        password: body.password,
      }),
      method: "POST",
    }),

  registerVerify: (body: { email: string; name: string; otp: string; password: string }) =>
    request<IAuthEmailResponse>("/auth/register/verify", {
      body: JSON.stringify({
        email: body.email.trim(),
        name: body.name.trim(),
        otp: body.otp.trim(),
        password: body.password,
      }),
      method: "POST",
    }),

  resetPassword: (body: { email: string; newPassword: string; otp: string }) =>
    request<IAuthEmailResponse>("/auth/reset-password", {
      body: JSON.stringify({
        email: body.email.trim(),
        newPassword: body.newPassword,
        otp: body.otp.trim(),
      }),
      method: "POST",
    }),
};

export const adminApi = {
  getAdminStats: () => authenticatedRequest<IAdminPlatformStats>("/admin/stats"),

  getAppConfig: () => authenticatedRequest<{ config: IAppConfig }>("/admin/app-config"),

  getSupportRequest: (id: string) => supportApi.get(id),

  getUser: (userId: string) =>
    authenticatedRequest<IAdminUserDetailResponse>(`/admin/users/${encodeURIComponent(userId)}`),

  listAuditEvents: (query: IAdminAuditEventsListQuery = {}) =>
    authenticatedRequest<IAdminAuditEventsListResponse>(
      `/admin/audit-events${buildAuditEventsSearchParams(query)}`
    ),

  listSupportRequests: (query: ISupportRequestsListQuery = {}) =>
    authenticatedRequest<ISupportRequestsListResponse>(
      `/support${buildSupportRequestsListSearchParams(query)}`
    ),

  listUserAuditEvents: (userId: string, query: { cursor?: string; limit?: number } = {}) =>
    authenticatedRequest<IAdminAuditEventsListResponse>(
      `/admin/users/${encodeURIComponent(userId)}/audit-events${buildCursorLimitSearchParams(query)}`
    ),

  listUsers: (query: IAdminUsersListQuery = {}) =>
    authenticatedRequest<IAdminUsersListResponse>(
      `/admin/users${buildUsersListSearchParams(query)}`
    ),

  patchAppConfig: (body: IAdminPatchAppConfigBody) =>
    authenticatedRequest<{ config: IAppConfig }>("/admin/app-config", {
      body: JSON.stringify(body),
      method: "PATCH",
    }),

  patchSupportRequest: (id: string, body: IAdminSupportRequestPatchBody) =>
    authenticatedRequest<IAdminSupportRequestPatchResponse>(`/support/${encodeURIComponent(id)}`, {
      body: JSON.stringify(body),
      method: "PATCH",
    }),

  postSupportMessage: (id: string, body: ISupportMessageCreateBody) =>
    supportApi.postMessage(id, body),

  resetUserAccount: (userId: string) =>
    authenticatedRequest<IAdminUserDetailResponse>(
      `/admin/users/${encodeURIComponent(userId)}/reset-account`,
      { method: "POST", omitDefaultContentType: true }
    ),
};

export const propertiesApi = {
  addMember: (propertyId: string, body: IAdminAddPropertyMemberBody) =>
    authenticatedRequest<TAddPropertyMemberResponse>(
      `/properties/${encodeURIComponent(propertyId)}/members`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  create: (body: IAdminCreatePropertyBody) =>
    authenticatedRequest<{ property: IProperty }>("/properties", {
      body: JSON.stringify(body),
      method: "POST",
    }),

  delete: (propertyId: string) =>
    authenticatedRequest<void>(`/properties/${encodeURIComponent(propertyId)}`, {
      method: "DELETE",
      omitDefaultContentType: true,
    }),

  getDetail: (propertyId: string) =>
    authenticatedRequest<{ property: IPropertyDetail }>(
      `/properties/${encodeURIComponent(propertyId)}`
    ),

  list: (query: IAdminPropertiesListQuery = {}) =>
    authenticatedRequest<IAdminPropertiesListResponse>(
      `/properties${buildPropertiesListSearchParams(query)}`
    ),

  removeMember: (propertyId: string, userId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE", omitDefaultContentType: true }
    ),

  setFavorite: (propertyId: string, body: IAdminSetPropertyFavoriteBody) =>
    authenticatedRequest<{ property: IProperty }>(
      `/properties/${encodeURIComponent(propertyId)}/favorite`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),

  update: (propertyId: string, body: IAdminUpdatePropertyBody) =>
    authenticatedRequest<{ property: IProperty }>(`/properties/${encodeURIComponent(propertyId)}`, {
      body: JSON.stringify(body),
      method: "PATCH",
    }),

  updateMember: (propertyId: string, userId: string, body: IAdminUpdatePropertyMemberBody) =>
    authenticatedRequest<{ member: IPropertyMember }>(
      `/properties/${encodeURIComponent(propertyId)}/members/${encodeURIComponent(userId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),
};

export const unitsApi = {
  create: (propertyId: string, body: ICreatePropertyUnitBody) =>
    authenticatedRequest<{ unit: IPropertyUnit }>(
      `/properties/${encodeURIComponent(propertyId)}/units`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  delete: (propertyId: string, unitId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}`,
      { method: "DELETE", omitDefaultContentType: true }
    ),

  list: (propertyId: string, query?: IPropertyUnitsListQuery) =>
    authenticatedRequest<IPropertyUnitsListResponse>(
      `/properties/${encodeURIComponent(propertyId)}/units${buildUnitsSearchParams(query)}`
    ),

  restore: (propertyId: string, unitId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}/restore`,
      { method: "POST", omitDefaultContentType: true }
    ),

  update: (propertyId: string, unitId: string, body: IUpdatePropertyUnitBody) =>
    authenticatedRequest<{ unit: IPropertyUnit }>(
      `/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),
};

function buildUnitsSearchParams(query: IPropertyUnitsListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.sortBy != null) params.set("sortBy", query.sortBy);
  if (query.sortDir != null) params.set("sortDir", query.sortDir);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const longStaysApi = {
  create: (propertyId: string, body: ICreatePropertyLongStayBody) =>
    authenticatedRequest<{ longStay: IPropertyLongStay }>(
      `/properties/${encodeURIComponent(propertyId)}/long-stays`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  end: (propertyId: string, longStayId: string, body: IEndPropertyLongStayBody) =>
    authenticatedRequest<{ longStay: IPropertyLongStay }>(
      `/properties/${encodeURIComponent(propertyId)}/long-stays/${encodeURIComponent(longStayId)}/end`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  extend: (propertyId: string, longStayId: string, body: IExtendPropertyLongStayBody) =>
    authenticatedRequest<{ longStay: IPropertyLongStay }>(
      `/properties/${encodeURIComponent(propertyId)}/long-stays/${encodeURIComponent(longStayId)}/extend`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  get: (propertyId: string, longStayId: string) =>
    authenticatedRequest<IPropertyLongStayDetailResponse>(
      `/properties/${encodeURIComponent(propertyId)}/long-stays/${encodeURIComponent(longStayId)}`
    ),

  list: (propertyId: string, query: IPropertyLongStaysListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    if (query.unitId) params.set("unitId", query.unitId);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    if (query.q) params.set("q", query.q);
    if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
    if (query.limit != null) params.set("limit", String(query.limit));
    const search = params.toString();
    const qs = search ? `?${search}` : "";
    return authenticatedRequest<IPropertyLongStaysListResponse>(
      `/properties/${encodeURIComponent(propertyId)}/long-stays${qs}`
    );
  },

  update: (propertyId: string, longStayId: string, body: IUpdatePropertyLongStayBody) =>
    authenticatedRequest<{ longStay: IPropertyLongStay }>(
      `/properties/${encodeURIComponent(propertyId)}/long-stays/${encodeURIComponent(longStayId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),
};

export const propertyExportsApi = {
  create: (propertyId: string, body: IPropertyExportCreateRequest) =>
    authenticatedRequest<IPropertyExportCreateResponse>(
      `/properties/${encodeURIComponent(propertyId)}/exports`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  get: (propertyId: string, jobId: string) =>
    authenticatedRequest<IPropertyExportDetailResponse>(
      `/properties/${encodeURIComponent(propertyId)}/exports/${encodeURIComponent(jobId)}`
    ),

  getDownloadUrl: (propertyId: string, jobId: string) =>
    authenticatedRequest<IExportJobDownloadResponse>(
      `/properties/${encodeURIComponent(propertyId)}/exports/${encodeURIComponent(jobId)}/download`
    ),

  list: (propertyId: string, query?: IPropertyExportsListQuery) =>
    authenticatedRequest<IPropertyExportsListResponse>(
      `/properties/${encodeURIComponent(propertyId)}/exports${buildPropertyExportsSearchParams(query)}`
    ),
};

function buildPropertyExportsSearchParams(query: IPropertyExportsListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const tenantEmailCampaignsApi = {
  create: (propertyId: string, body: ICreateTenantEmailCampaignBody, idempotencyKey: string) =>
    authenticatedRequest<ITenantEmailCampaignCreateResponse>(
      `/properties/${encodeURIComponent(propertyId)}/tenant-email-campaigns`,
      {
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": idempotencyKey },
        method: "POST",
      }
    ),

  get: (propertyId: string, campaignId: string) =>
    authenticatedRequest<ITenantEmailCampaignDetailResponse>(
      `/properties/${encodeURIComponent(propertyId)}/tenant-email-campaigns/${encodeURIComponent(campaignId)}`
    ),

  list: (propertyId: string, query?: ITenantEmailCampaignsListQuery) =>
    authenticatedRequest<ITenantEmailCampaignListResponse>(
      `/properties/${encodeURIComponent(propertyId)}/tenant-email-campaigns${buildTenantEmailCampaignsSearchParams(query)}`
    ),

  preview: (propertyId: string) =>
    authenticatedRequest<ITenantEmailCampaignPreviewResponse>(
      `/properties/${encodeURIComponent(propertyId)}/tenant-email-campaigns/preview`
    ),

  reenqueue: (propertyId: string, campaignId: string) =>
    authenticatedRequest<ITenantEmailCampaignReenqueueResponse>(
      `/properties/${encodeURIComponent(propertyId)}/tenant-email-campaigns/${encodeURIComponent(campaignId)}/reenqueue`,
      { method: "POST" }
    ),
};

function buildTenantEmailCampaignsSearchParams(query: ITenantEmailCampaignsListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const settingsApi = {
  get: (propertyId: string) =>
    authenticatedRequest<{ settings: IPropertySettings }>(
      `/properties/${encodeURIComponent(propertyId)}/settings`
    ),

  update: (propertyId: string, body: IUpdatePropertySettingsBody) =>
    authenticatedRequest<{ settings: IPropertySettings }>(
      `/properties/${encodeURIComponent(propertyId)}/settings`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),
};

function buildShortStaysSearchParams(query: IPropertyReservationsListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.checkOutFrom) params.set("checkOutFrom", query.checkOutFrom);
  if (query.checkInTo) params.set("checkInTo", query.checkInTo);
  if (query.unitId) params.set("unitId", query.unitId);
  if (query.channelCommissionId) params.set("channelCommissionId", query.channelCommissionId);
  if (query.status) params.set("status", query.status);
  if (query.rentalType) params.set("rentalType", query.rentalType);
  if (query.includeReservationId) params.set("includeReservationId", query.includeReservationId);
  if (query.q != null && query.q !== "") params.set("q", query.q);
  if (query.refundStatus) params.set("refundStatus", query.refundStatus);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const shortStaysApi = {
  create: (propertyId: string, body: ICreatePropertyReservationBody) =>
    authenticatedRequest<{ shortStay: IPropertyReservation }>(
      `/properties/${encodeURIComponent(propertyId)}/short-stays`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  delete: (propertyId: string, shortStayId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/short-stays/${encodeURIComponent(shortStayId)}`,
      { method: "DELETE", omitDefaultContentType: true }
    ),

  list: (propertyId: string, query?: IPropertyReservationsListQuery) =>
    authenticatedRequest<IPropertyShortStaysListResponse>(
      `/properties/${encodeURIComponent(propertyId)}/short-stays${buildShortStaysSearchParams(query)}`
    ),

  refund: (propertyId: string, shortStayId: string, body?: IRefundLedgerEntryBody) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/short-stays/${encodeURIComponent(shortStayId)}/refund`,
      body?.amount !== undefined
        ? { body: JSON.stringify(body), method: "POST" }
        : { method: "POST", omitDefaultContentType: true }
    ),

  restore: (propertyId: string, shortStayId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/short-stays/${encodeURIComponent(shortStayId)}/restore`,
      { method: "POST", omitDefaultContentType: true }
    ),

  unrefund: (propertyId: string, shortStayId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/short-stays/${encodeURIComponent(shortStayId)}/unrefund`,
      { method: "POST", omitDefaultContentType: true }
    ),

  update: (propertyId: string, shortStayId: string, body: IUpdatePropertyReservationBody) =>
    authenticatedRequest<{ shortStay: IPropertyReservation }>(
      `/properties/${encodeURIComponent(propertyId)}/short-stays/${encodeURIComponent(shortStayId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),
};

function buildIncomeEntriesSearchParams(query: IPropertyIncomeEntriesListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.unitId) params.set("unitId", query.unitId);
  if (query.channelCommissionId) params.set("channelCommissionId", query.channelCommissionId);
  if (query.status) params.set("status", query.status);
  if (query.incomeType) params.set("incomeType", query.incomeType);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDir) params.set("sortDir", query.sortDir);
  if (query.q != null && query.q !== "") params.set("q", query.q);
  if (query.refundStatus) params.set("refundStatus", query.refundStatus);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const incomeEntriesApi = {
  list: (propertyId: string, query?: IPropertyIncomeEntriesListQuery) =>
    authenticatedRequest<IPropertyIncomeEntriesListResponse>(
      `/properties/${encodeURIComponent(propertyId)}/income-entries${buildIncomeEntriesSearchParams(query)}`
    ),
};

function buildIncomeLinesSearchParams(query: IPropertyIncomeLinesListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.unitId) params.set("unitId", query.unitId);
  if (query.incomeLineTypeId) params.set("incomeLineTypeId", query.incomeLineTypeId);
  if (query.reservationId) params.set("reservationId", query.reservationId);
  if (query.q != null && query.q !== "") params.set("q", query.q);
  if (query.refundStatus) params.set("refundStatus", query.refundStatus);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const incomeLinesApi = {
  create: (propertyId: string, body: ICreatePropertyIncomeLineBody) =>
    authenticatedRequest<{ incomeLine: IPropertyIncomeLine }>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  delete: (propertyId: string, lineId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines/${encodeURIComponent(lineId)}`,
      { method: "DELETE", omitDefaultContentType: true }
    ),

  list: (propertyId: string, query?: IPropertyIncomeLinesListQuery) =>
    authenticatedRequest<IPropertyIncomeLinesListResponse>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines${buildIncomeLinesSearchParams(query)}`
    ),

  refund: (propertyId: string, lineId: string, body?: IRefundLedgerEntryBody) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines/${encodeURIComponent(lineId)}/refund`,
      body?.amount !== undefined
        ? { body: JSON.stringify(body), method: "POST" }
        : { method: "POST", omitDefaultContentType: true }
    ),

  restore: (propertyId: string, lineId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines/${encodeURIComponent(lineId)}/restore`,
      { method: "POST", omitDefaultContentType: true }
    ),

  unrefund: (propertyId: string, lineId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines/${encodeURIComponent(lineId)}/unrefund`,
      { method: "POST", omitDefaultContentType: true }
    ),

  update: (propertyId: string, lineId: string, body: IUpdatePropertyIncomeLineBody) =>
    authenticatedRequest<{ incomeLine: IPropertyIncomeLine }>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines/${encodeURIComponent(lineId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),
};

function buildExpensesSearchParams(query: IPropertyExpensesListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.q) params.set("q", query.q);
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const expensesApi = {
  create: (propertyId: string, body: ICreatePropertyExpenseBody) =>
    authenticatedRequest<{ expense: IPropertyExpense }>(
      `/properties/${encodeURIComponent(propertyId)}/expenses`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  delete: (propertyId: string, expenseId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/expenses/${encodeURIComponent(expenseId)}`,
      { method: "DELETE", omitDefaultContentType: true }
    ),

  importCommit: (propertyId: string, body: IExpenseImportCommitBody) =>
    authenticatedRequest<IExpenseImportCommitResponse>(
      `/properties/${encodeURIComponent(propertyId)}/expenses/import/commit`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  importParse: (propertyId: string, formData: FormData) =>
    authenticatedMultipartRequest<IExpenseImportParseResponse>(
      `/properties/${encodeURIComponent(propertyId)}/expenses/import/parse`,
      formData
    ),

  list: (propertyId: string, query?: IPropertyExpensesListQuery) =>
    authenticatedRequest<IPropertyExpensesListResponse>(
      `/properties/${encodeURIComponent(propertyId)}/expenses${buildExpensesSearchParams(query)}`
    ),

  restore: (propertyId: string, expenseId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/expenses/${encodeURIComponent(expenseId)}/restore`,
      { method: "POST", omitDefaultContentType: true }
    ),

  update: (propertyId: string, expenseId: string, body: IUpdatePropertyExpenseBody) =>
    authenticatedRequest<{ expense: IPropertyExpense }>(
      `/properties/${encodeURIComponent(propertyId)}/expenses/${encodeURIComponent(expenseId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),
};

export const incomeImportApi = {
  importCommit: (propertyId: string, body: IIncomeImportCommitBody) =>
    authenticatedRequest<IIncomeImportCommitResponse>(
      `/properties/${encodeURIComponent(propertyId)}/income/import/commit`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  importParse: (propertyId: string, formData: FormData) =>
    authenticatedMultipartRequest<IIncomeImportParseResponse>(
      `/properties/${encodeURIComponent(propertyId)}/income/import/parse`,
      formData
    ),
};

function buildReportsSearchParams(query: IPropertyReportsQuery): string {
  const params = new URLSearchParams();
  params.set("from", query.from);
  params.set("to", query.to);
  if (query.unitId) params.set("unitId", query.unitId);
  if (query.channelCommissionId) params.set("channelCommissionId", query.channelCommissionId);
  if (query.rentalType) params.set("rentalType", query.rentalType);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const reportsApi = {
  exportCsv: (propertyId: string, query: IPropertyReportsQuery) =>
    authenticatedDownload(
      `/properties/${encodeURIComponent(propertyId)}/reports/export${buildReportsSearchParams(query)}`
    ),

  summary: (propertyId: string, query: IPropertyReportsQuery) =>
    authenticatedRequest<{ summary: IPropertyReportSummary }>(
      `/properties/${encodeURIComponent(propertyId)}/reports/summary${buildReportsSearchParams(query)}`
    ),
};

export const portfolioReportsApi = {
  exportCsv: (query: IPropertyReportsQuery) =>
    authenticatedDownload(`/reports/export${buildReportsSearchParams(query)}`),

  summary: (query: IPropertyReportsQuery) =>
    authenticatedRequest<{ summary: IPortfolioReportSummary }>(
      `/reports/summary${buildReportsSearchParams(query)}`
    ),
};

export const homeApi = {
  financialOverview: () =>
    authenticatedRequest<{ overview: IHomeFinancialOverview }>("/home/financial-overview"),
};
