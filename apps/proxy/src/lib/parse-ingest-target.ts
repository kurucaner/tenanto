import { isAllowedRumPath } from "./intake-origin";

export type IngestTarget = {
  pathname: string;
  search: string;
};

export function parseIngestTarget(
  encodedTarget: string | null | undefined
): IngestTarget | null {
  if (!encodedTarget?.trim()) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(encodedTarget);
  } catch {
    return null;
  }

  if (!decoded.startsWith("/")) {
    return null;
  }

  const queryIndex = decoded.indexOf("?");
  const pathname = queryIndex === -1 ? decoded : decoded.slice(0, queryIndex);
  const search = queryIndex === -1 ? "" : decoded.slice(queryIndex);

  if (!isAllowedRumPath(pathname)) {
    return null;
  }

  return { pathname, search };
}
