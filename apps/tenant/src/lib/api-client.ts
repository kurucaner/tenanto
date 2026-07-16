import { clearAppSession } from "@/lib/clear-app-session";
import { createApiClient } from "@/packages/app-ui";
import {
  type ITenantAppleAuthBody,
  type ITenantAuthLoginBody,
  type ITenantAuthLogoutBody,
  type ITenantAuthRefreshBody,
  type ITenantAuthRegisterStartBody,
  type ITenantAuthRegisterVerifyBody,
  type ITenantAuthSessionResponse,
  type ITenantGoogleAuthBody,
  type ITenantInvitePreviewResponse,
  type ITenantInviteRedeemBody,
  type ITenantInviteRedeemResponse,
  type ITenantInviteRegisterBody,
  type ITenantInviteRegisterGoogleBody,
  type ITenantLeaseDetailResponse,
  type ITenantLeasesListResponse,
  type ITenantMembershipActionResponse,
  type ITenantMeResponse,
  type ITenantPendingInvitesResponse,
  type ITenantUser,
  TenantLeaseListStatus,
  type TTenantLeaseListStatus,
} from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

function getApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL;
  if (url == null || url === "") {
    throw new Error("VITE_API_URL is not set");
  }
  return url.replace(/\/$/, "");
}

const { authenticatedRequest, refreshAccessTokenForStream, request, setOnSessionExpired } =
  createApiClient<ITenantUser>({
    clearSession: clearAppSession,
    getAccessToken: () => useAuthStore.getState().accessToken,
    getApiBaseUrl,
    getRefreshToken: () => useAuthStore.getState().refreshToken,
    onRefreshSuccess: ({ accessToken, user }) => {
      useAuthStore.getState().setAccessToken(accessToken);
      useAuthStore.getState().setUser(user);
    },
    refreshPath: "/tenant/auth/refresh",
  });

export { refreshAccessTokenForStream, setOnSessionExpired };

export const tenantAuthApi = {
  login: (body: ITenantAuthLoginBody) =>
    request<ITenantAuthSessionResponse>("/tenant/auth/login", {
      body: JSON.stringify({
        email: body.email.trim(),
        password: body.password,
      }),
      method: "POST",
    }),

  loginApple: (body: ITenantAppleAuthBody) =>
    request<ITenantAuthSessionResponse>("/tenant/auth/apple", {
      body: JSON.stringify({
        identityToken: body.identityToken,
        ...(body.name != null && body.name.trim() !== "" ? { name: body.name.trim() } : {}),
      }),
      method: "POST",
    }),

  loginGoogle: (idToken: string) =>
    request<ITenantAuthSessionResponse>("/tenant/auth/google", {
      body: JSON.stringify({ idToken } satisfies ITenantGoogleAuthBody),
      method: "POST",
    }),

  logout: (body: ITenantAuthLogoutBody) =>
    request<{ success: boolean }>("/tenant/auth/logout", {
      body: JSON.stringify({ refreshToken: body.refreshToken }),
      method: "POST",
    }),

  refresh: (body: ITenantAuthRefreshBody) =>
    request<{ accessToken: string; user: ITenantUser }>("/tenant/auth/refresh", {
      body: JSON.stringify({ refreshToken: body.refreshToken }),
      method: "POST",
    }),

  registerStart: (body: ITenantAuthRegisterStartBody) =>
    request<{ message: string }>("/tenant/auth/register/start", {
      body: JSON.stringify({ email: body.email.trim() }),
      method: "POST",
    }),

  registerVerify: (body: ITenantAuthRegisterVerifyBody) =>
    request<ITenantAuthSessionResponse>("/tenant/auth/register/verify", {
      body: JSON.stringify({
        email: body.email.trim(),
        name: body.name.trim(),
        otp: body.otp.trim(),
        password: body.password,
      }),
      method: "POST",
    }),
};

export const tenantPortalApi = {
  acceptInvite: (membershipId: string) =>
    authenticatedRequest<ITenantMembershipActionResponse>(
      `/tenant/me/invites/${encodeURIComponent(membershipId)}/accept`,
      { method: "POST" }
    ),

  declineInvite: (membershipId: string) =>
    authenticatedRequest<ITenantMembershipActionResponse>(
      `/tenant/me/invites/${encodeURIComponent(membershipId)}/decline`,
      { method: "POST", omitDefaultContentType: true }
    ),

  getLease: (leaseId: string) =>
    authenticatedRequest<ITenantLeaseDetailResponse>(
      `/tenant/me/leases/${encodeURIComponent(leaseId)}`
    ),

  getMe: () => authenticatedRequest<ITenantMeResponse>("/tenant/me"),

  listLeases: (status: TTenantLeaseListStatus = TenantLeaseListStatus.ACTIVE) => {
    const query =
      status === TenantLeaseListStatus.ACTIVE ? "" : `?status=${encodeURIComponent(status)}`;
    return authenticatedRequest<ITenantLeasesListResponse>(`/tenant/me/leases${query}`);
  },

  listPendingInvites: () =>
    authenticatedRequest<ITenantPendingInvitesResponse>("/tenant/me/invites/pending"),

  previewInvite: (token: string) =>
    request<ITenantInvitePreviewResponse>(
      `/tenant/invites/preview?token=${encodeURIComponent(token)}`
    ),

  redeemInvite: (body: ITenantInviteRedeemBody) =>
    request<ITenantInviteRedeemResponse>("/tenant/invites/redeem", {
      body: JSON.stringify(body),
      method: "POST",
    }),

  redeemInviteAuthenticated: (token: string) =>
    authenticatedRequest<ITenantInviteRedeemResponse>("/tenant/invites/redeem", {
      body: JSON.stringify({ token }),
      method: "POST",
    }),

  registerWithInvite: (body: ITenantInviteRegisterBody) =>
    request<ITenantInviteRedeemResponse>("/tenant/invites/register", {
      body: JSON.stringify({
        name: body.name.trim(),
        password: body.password,
        token: body.token.trim(),
      }),
      method: "POST",
    }),

  registerWithInviteGoogle: (body: ITenantInviteRegisterGoogleBody) =>
    request<ITenantInviteRedeemResponse>("/tenant/invites/register/google", {
      body: JSON.stringify({
        idToken: body.idToken.trim(),
        token: body.token.trim(),
      }),
      method: "POST",
    }),
};
