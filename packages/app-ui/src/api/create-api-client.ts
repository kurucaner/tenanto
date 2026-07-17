import { JwtError } from "@/packages/shared";

import type {
  IApiClient,
  ICreateApiClientConfig,
  IUnauthorizedBody,
  TRequestOptions,
} from "./types";

const getDefaultHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
});

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export function createApiClient<TUser>(
  config: ICreateApiClientConfig<TUser>
): IApiClient {
  let onSessionExpired: (() => void) | undefined;
  let inFlightRefresh: Promise<string | null> | null = null;

  const rawRequest = async (path: string, options: TRequestOptions = {}): Promise<Response> => {
    const { omitDefaultContentType, ...requestInit } = options;
    const defaultHeaders = { ...getDefaultHeaders() };
    if (omitDefaultContentType) {
      delete defaultHeaders["Content-Type"];
    }
    return fetch(`${config.getApiBaseUrl()}${path}`, {
      ...requestInit,
      headers: {
        ...defaultHeaders,
        ...requestInit.headers,
      },
    });
  };

  const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await rawRequest(path, options);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { code?: string; error?: string };
      const err = new Error(body.error ?? `Request failed: ${response.status}`);
      (err as Error & { code?: string }).code = body.code;
      throw err;
    }
    return parseJsonResponse<T>(response);
  };

  const handleSessionInvalid = (): never => {
    config.clearSession();
    onSessionExpired?.();
    throw new Error("Session expired");
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    const refreshToken = config.getRefreshToken();
    if (!refreshToken) {
      config.clearSession();
      onSessionExpired?.();
      return null;
    }
    try {
      const result = await request<{ accessToken: string; user: TUser }>(config.refreshPath, {
        body: JSON.stringify({ refreshToken }),
        method: "POST",
      });
      config.onRefreshSuccess(result);
      return result.accessToken;
    } catch {
      config.clearSession();
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

  const authenticatedRequest = async <T>(
    path: string,
    options: TRequestOptions = {},
    isRetry = false
  ): Promise<T> => {
    const token = config.getAccessToken();
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

    const body = (await response.json().catch(() => ({}))) as IUnauthorizedBody;
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
    const token = config.getAccessToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${config.getApiBaseUrl()}${path}`, {
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

    const body = (await response.json().catch(() => ({}))) as IUnauthorizedBody;
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
    options: TRequestOptions = {},
    isRetry = false
  ): Promise<Blob> => {
    const token = config.getAccessToken();
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

    const body = (await response.json().catch(() => ({}))) as IUnauthorizedBody;
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

  return {
    authenticatedDownload,
    authenticatedMultipartRequest,
    authenticatedRequest,
    getApiBaseUrl: config.getApiBaseUrl,
    rawRequest,
    refreshAccessToken,
    refreshAccessTokenForStream: getDeduplicatedRefresh,
    request,
    setOnSessionExpired: (callback: (() => void) | undefined) => {
      onSessionExpired = callback;
    },
  };
}
