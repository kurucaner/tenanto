import { clearAppSession } from "@/lib/clear-app-session";
import {
  type IAdminAddPropertyMemberBody,
  type IAdminAuditEventsListQuery,
  type IAdminAuditEventsListResponse,
  type IAdminCreatePropertyBody,
  type IAdminPatchAppConfigBody,
  type IAdminPlatformStats,
  type IAdminPropertiesListResponse,
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
  type IEndPropertyLongStayBody,
  type IExpenseImportCommitBody,
  type IExpenseImportCommitResponse,
  type IExpenseImportParseResponse,
  type IExtendPropertyLongStayBody,
  type IHomeFinancialOverview,
  type IPortfolioReportSummary,
  type IProperty,
  type IPropertyDetail,
  type IPropertyExpense,
  type IPropertyExpensesListQuery,
  type IPropertyExpensesListResponse,
  type IPropertyIncomeLine,
  type IPropertyIncomeLinesListQuery,
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
  type IPropertyUnit,
  type ISupportAttachmentPresignBody,
  type ISupportAttachmentPresignResponse,
  type ISupportCreateBody,
  type ISupportMessageCreateBody,
  type ISupportRequestDetail,
  type ISupportRequestsListQuery,
  type ISupportRequestsListResponse,
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

  const handleSessionInvalid = (): never => {
    clearAppSession();
    onSessionExpired?.();
    throw new Error("Session expired");
  };

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

  const handleSessionInvalid = (): never => {
    clearAppSession();
    onSessionExpired?.();
    throw new Error("Session expired");
  };

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

  const handleSessionInvalid = (): never => {
    clearAppSession();
    onSessionExpired?.();
    throw new Error("Session expired");
  };

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

function buildNotificationsListSearchParams(query: IUserNotificationsListQuery): string {
  const params = new URLSearchParams();
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  const s = params.toString();
  return s === "" ? "" : `?${s}`;
}

export const notificationsApi = {
  getUnreadCount: () =>
    authenticatedRequest<IUserNotificationsUnreadCountResponse>("/notifications/unread-count"),

  list: (query: IUserNotificationsListQuery = {}) =>
    authenticatedRequest<IUserNotificationsListResponse>(
      `/notifications${buildNotificationsListSearchParams(query)}`
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
  loginEmail: (email: string, password: string) =>
    request<IAuthEmailResponse>("/auth/email", {
      body: JSON.stringify({ email, password }),
      method: "POST",
    }),

  logout: (refreshToken: string) =>
    request<{ success: boolean }>("/auth/logout", {
      body: JSON.stringify({ refreshToken }),
      method: "POST",
    }),
};

export const adminApi = {
  getAdminStats: () => authenticatedRequest<IAdminPlatformStats>("/admin/stats"),

  getAppConfig: () => authenticatedRequest<{ config: IAppConfig }>("/admin/app-config"),

  patchAppConfig: (body: IAdminPatchAppConfigBody) =>
    authenticatedRequest<{ config: IAppConfig }>("/admin/app-config", {
      body: JSON.stringify(body),
      method: "PATCH",
    }),

  getUser: (userId: string) =>
    authenticatedRequest<IAdminUserDetailResponse>(`/admin/users/${encodeURIComponent(userId)}`),

  listUsers: (query: IAdminUsersListQuery = {}) =>
    authenticatedRequest<IAdminUsersListResponse>(
      `/admin/users${buildUsersListSearchParams(query)}`
    ),

  resetUserAccount: (userId: string) =>
    authenticatedRequest<IAdminUserDetailResponse>(
      `/admin/users/${encodeURIComponent(userId)}/reset-account`,
      { method: "POST", omitDefaultContentType: true }
    ),

  listUserAuditEvents: (userId: string, query: { cursor?: string; limit?: number } = {}) =>
    authenticatedRequest<IAdminAuditEventsListResponse>(
      `/admin/users/${encodeURIComponent(userId)}/audit-events${buildCursorLimitSearchParams(query)}`
    ),

  listAuditEvents: (query: IAdminAuditEventsListQuery = {}) =>
    authenticatedRequest<IAdminAuditEventsListResponse>(
      `/admin/audit-events${buildAuditEventsSearchParams(query)}`
    ),

  listSupportRequests: (query: ISupportRequestsListQuery = {}) =>
    authenticatedRequest<ISupportRequestsListResponse>(
      `/support${buildSupportRequestsListSearchParams(query)}`
    ),

  getSupportRequest: (id: string) => supportApi.get(id),

  postSupportMessage: (id: string, body: ISupportMessageCreateBody) =>
    supportApi.postMessage(id, body),

  patchSupportRequest: (id: string, body: IAdminSupportRequestPatchBody) =>
    authenticatedRequest<IAdminSupportRequestPatchResponse>(`/support/${encodeURIComponent(id)}`, {
      body: JSON.stringify(body),
      method: "PATCH",
    }),
};

export const propertiesApi = {
  list: (query: IAdminPropertiesListQuery = {}) =>
    authenticatedRequest<IAdminPropertiesListResponse>(
      `/properties${buildPropertiesListSearchParams(query)}`
    ),

  create: (body: IAdminCreatePropertyBody) =>
    authenticatedRequest<{ property: IProperty }>("/properties", {
      body: JSON.stringify(body),
      method: "POST",
    }),

  getDetail: (propertyId: string) =>
    authenticatedRequest<{ property: IPropertyDetail }>(
      `/properties/${encodeURIComponent(propertyId)}`
    ),

  update: (propertyId: string, body: IAdminUpdatePropertyBody) =>
    authenticatedRequest<{ property: IProperty }>(`/properties/${encodeURIComponent(propertyId)}`, {
      body: JSON.stringify(body),
      method: "PATCH",
    }),

  delete: (propertyId: string) =>
    authenticatedRequest<void>(`/properties/${encodeURIComponent(propertyId)}`, {
      method: "DELETE",
      omitDefaultContentType: true,
    }),

  addMember: (propertyId: string, body: IAdminAddPropertyMemberBody) =>
    authenticatedRequest<TAddPropertyMemberResponse>(
      `/properties/${encodeURIComponent(propertyId)}/members`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  updateMember: (propertyId: string, userId: string, body: IAdminUpdatePropertyMemberBody) =>
    authenticatedRequest<{ member: IPropertyMember }>(
      `/properties/${encodeURIComponent(propertyId)}/members/${encodeURIComponent(userId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),

  removeMember: (propertyId: string, userId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE", omitDefaultContentType: true }
    ),
};

export const unitsApi = {
  list: (propertyId: string) =>
    authenticatedRequest<{ units: IPropertyUnit[] }>(
      `/properties/${encodeURIComponent(propertyId)}/units`
    ),

  create: (propertyId: string, body: ICreatePropertyUnitBody) =>
    authenticatedRequest<{ unit: IPropertyUnit }>(
      `/properties/${encodeURIComponent(propertyId)}/units`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  update: (propertyId: string, unitId: string, body: IUpdatePropertyUnitBody) =>
    authenticatedRequest<{ unit: IPropertyUnit }>(
      `/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),

  delete: (propertyId: string, unitId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}`,
      { method: "DELETE", omitDefaultContentType: true }
    ),

  restore: (propertyId: string, unitId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}/restore`,
      { method: "POST", omitDefaultContentType: true }
    ),
};

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
    if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
    if (query.limit != null) params.set("limit", String(query.limit));
    const search = params.toString();
    return authenticatedRequest<IPropertyLongStaysListResponse>(
      `/properties/${encodeURIComponent(propertyId)}/long-stays${search ? `?${search}` : ""}`
    );
  },

  update: (propertyId: string, longStayId: string, body: IUpdatePropertyLongStayBody) =>
    authenticatedRequest<{ longStay: IPropertyLongStay }>(
      `/properties/${encodeURIComponent(propertyId)}/long-stays/${encodeURIComponent(longStayId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),
};

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

function buildReservationsSearchParams(query: IPropertyReservationsListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.checkOutFrom) params.set("checkOutFrom", query.checkOutFrom);
  if (query.checkInTo) params.set("checkInTo", query.checkInTo);
  if (query.unitId) params.set("unitId", query.unitId);
  if (query.channel) params.set("channel", query.channel);
  if (query.status) params.set("status", query.status);
  if (query.rentalType) params.set("rentalType", query.rentalType);
  if (query.includeReservationId) params.set("includeReservationId", query.includeReservationId);
  if (query.limit != null) params.set("limit", String(query.limit));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const reservationsApi = {
  list: (propertyId: string, query?: IPropertyReservationsListQuery) =>
    authenticatedRequest<{ reservations: IPropertyReservation[] }>(
      `/properties/${encodeURIComponent(propertyId)}/reservations${buildReservationsSearchParams(query)}`
    ),

  create: (propertyId: string, body: ICreatePropertyReservationBody) =>
    authenticatedRequest<{ reservation: IPropertyReservation }>(
      `/properties/${encodeURIComponent(propertyId)}/reservations`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  update: (propertyId: string, reservationId: string, body: IUpdatePropertyReservationBody) =>
    authenticatedRequest<{ reservation: IPropertyReservation }>(
      `/properties/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(reservationId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),

  delete: (propertyId: string, reservationId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(reservationId)}`,
      { method: "DELETE", omitDefaultContentType: true }
    ),

  restore: (propertyId: string, reservationId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(reservationId)}/restore`,
      { method: "POST", omitDefaultContentType: true }
    ),
};

function buildIncomeLinesSearchParams(query: IPropertyIncomeLinesListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.unitId) params.set("unitId", query.unitId);
  if (query.incomeLineTypeId) params.set("incomeLineTypeId", query.incomeLineTypeId);
  if (query.reservationId) params.set("reservationId", query.reservationId);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const incomeLinesApi = {
  list: (propertyId: string, query?: IPropertyIncomeLinesListQuery) =>
    authenticatedRequest<{ incomeLines: IPropertyIncomeLine[] }>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines${buildIncomeLinesSearchParams(query)}`
    ),

  create: (propertyId: string, body: ICreatePropertyIncomeLineBody) =>
    authenticatedRequest<{ incomeLine: IPropertyIncomeLine }>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  update: (propertyId: string, lineId: string, body: IUpdatePropertyIncomeLineBody) =>
    authenticatedRequest<{ incomeLine: IPropertyIncomeLine }>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines/${encodeURIComponent(lineId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),

  delete: (propertyId: string, lineId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines/${encodeURIComponent(lineId)}`,
      { method: "DELETE", omitDefaultContentType: true }
    ),

  restore: (propertyId: string, lineId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/income-lines/${encodeURIComponent(lineId)}/restore`,
      { method: "POST", omitDefaultContentType: true }
    ),
};

function buildExpensesSearchParams(query: IPropertyExpensesListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.category) params.set("category", query.category);
  if (query.cursor != null && query.cursor !== "") params.set("cursor", query.cursor);
  if (query.limit != null) params.set("limit", String(query.limit));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const expensesApi = {
  list: (propertyId: string, query?: IPropertyExpensesListQuery) =>
    authenticatedRequest<IPropertyExpensesListResponse>(
      `/properties/${encodeURIComponent(propertyId)}/expenses${buildExpensesSearchParams(query)}`
    ),

  create: (propertyId: string, body: ICreatePropertyExpenseBody) =>
    authenticatedRequest<{ expense: IPropertyExpense }>(
      `/properties/${encodeURIComponent(propertyId)}/expenses`,
      { body: JSON.stringify(body), method: "POST" }
    ),

  update: (propertyId: string, expenseId: string, body: IUpdatePropertyExpenseBody) =>
    authenticatedRequest<{ expense: IPropertyExpense }>(
      `/properties/${encodeURIComponent(propertyId)}/expenses/${encodeURIComponent(expenseId)}`,
      { body: JSON.stringify(body), method: "PATCH" }
    ),

  delete: (propertyId: string, expenseId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/expenses/${encodeURIComponent(expenseId)}`,
      { method: "DELETE", omitDefaultContentType: true }
    ),

  restore: (propertyId: string, expenseId: string) =>
    authenticatedRequest<void>(
      `/properties/${encodeURIComponent(propertyId)}/expenses/${encodeURIComponent(expenseId)}/restore`,
      { method: "POST", omitDefaultContentType: true }
    ),

  importParse: (propertyId: string, formData: FormData) =>
    authenticatedMultipartRequest<IExpenseImportParseResponse>(
      `/properties/${encodeURIComponent(propertyId)}/expenses/import/parse`,
      formData
    ),

  importCommit: (propertyId: string, body: IExpenseImportCommitBody) =>
    authenticatedRequest<IExpenseImportCommitResponse>(
      `/properties/${encodeURIComponent(propertyId)}/expenses/import/commit`,
      { body: JSON.stringify(body), method: "POST" }
    ),
};

function buildReportsSearchParams(query: IPropertyReportsQuery): string {
  const params = new URLSearchParams();
  params.set("from", query.from);
  params.set("to", query.to);
  if (query.unitId) params.set("unitId", query.unitId);
  if (query.channel) params.set("channel", query.channel);
  if (query.rentalType) params.set("rentalType", query.rentalType);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const reportsApi = {
  summary: (propertyId: string, query: IPropertyReportsQuery) =>
    authenticatedRequest<{ summary: IPropertyReportSummary }>(
      `/properties/${encodeURIComponent(propertyId)}/reports/summary${buildReportsSearchParams(query)}`
    ),

  exportCsv: (propertyId: string, query: IPropertyReportsQuery) =>
    authenticatedDownload(
      `/properties/${encodeURIComponent(propertyId)}/reports/export${buildReportsSearchParams(query)}`
    ),
};

export const portfolioReportsApi = {
  summary: (query: IPropertyReportsQuery) =>
    authenticatedRequest<{ summary: IPortfolioReportSummary }>(
      `/reports/summary${buildReportsSearchParams(query)}`
    ),

  exportCsv: (query: IPropertyReportsQuery) =>
    authenticatedDownload(`/reports/export${buildReportsSearchParams(query)}`),
};

export const homeApi = {
  financialOverview: () =>
    authenticatedRequest<{ overview: IHomeFinancialOverview }>("/home/financial-overview"),
};
