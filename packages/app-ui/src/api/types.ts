export type TRequestOptions = RequestInit & { omitDefaultContentType?: boolean };

export interface IUnauthorizedBody {
  code?: string;
  error?: string;
}

export interface ICreateApiClientConfig<TUser> {
  clearSession: () => void;
  getAccessToken: () => string | null;
  getApiBaseUrl: () => string;
  getRefreshToken: () => string | null;
  onRefreshSuccess: (result: { accessToken: string; user: TUser }) => void;
  refreshPath: string;
}

export interface IApiClient {
  authenticatedDownload: (path: string, options?: TRequestOptions, isRetry?: boolean) => Promise<Blob>;
  authenticatedMultipartRequest: <T>(
    path: string,
    formData: FormData,
    isRetry?: boolean
  ) => Promise<T>;
  authenticatedRequest: <T>(
    path: string,
    options?: TRequestOptions,
    isRetry?: boolean
  ) => Promise<T>;
  getApiBaseUrl: () => string;
  rawRequest: (path: string, options?: TRequestOptions) => Promise<Response>;
  refreshAccessToken: () => Promise<string | null>;
  refreshAccessTokenForStream: () => Promise<string | null>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  setOnSessionExpired: (callback: (() => void) | undefined) => void;
}
