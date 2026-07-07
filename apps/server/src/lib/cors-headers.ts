import { isProduction } from "./environment";

const PRODUCTION_ORIGINS = [process.env["WEB_APP_URL"], process.env["ADMIN_APP_URL"]].filter(
  (value): value is string => value != null && value !== ""
);

export function resolveAllowedOrigin(requestOrigin: string | undefined): string | null {
  if (!isProduction) {
    return requestOrigin ?? "*";
  }
  if (requestOrigin == null || requestOrigin === "") {
    return null;
  }
  return PRODUCTION_ORIGINS.includes(requestOrigin) ? requestOrigin : null;
}

export function buildSseCorsHeaders(requestOrigin: string | undefined): Record<string, string> {
  const allowedOrigin = resolveAllowedOrigin(requestOrigin);
  if (allowedOrigin == null) {
    return {};
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type, X-Stream-Client-Id",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigin,
  };

  if (allowedOrigin !== "*") {
    headers.Vary = "Origin";
  }

  return headers;
}
