import { PROPERTY_SHELL_TABS } from "@/config/property-shell-tabs";

const PRESERVED_PROPERTY_SWITCH_PARAMS = [
  "channelCommissionId",
  "from",
  "rentalType",
  "to",
] as const;

export function getPropertyTabSuffix(pathname: string, propertyId: string): string {
  const base = `/properties/${propertyId}`;
  if (pathname === base || pathname === `${base}/`) {
    return "";
  }
  if (pathname.startsWith(`${base}/`)) {
    return pathname.slice(base.length);
  }
  return "";
}

export function sanitizePropertySwitchSearchParams(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const next = new URLSearchParams();

  for (const key of PRESERVED_PROPERTY_SWITCH_PARAMS) {
    const value = params.get(key);
    if (value) {
      next.set(key, value);
    }
  }

  const serialized = next.toString();
  return serialized ? `?${serialized}` : "";
}

function resolveResumeShellTabPath(propertyId: string, lastPath: string): string {
  const suffix = getPropertyTabSuffix(`/properties/${propertyId}${lastPath}`, propertyId);
  const sortedTabs = [...PROPERTY_SHELL_TABS].sort((left, right) => right.path.length - left.path.length);

  for (const tab of sortedTabs) {
    if (tab.path === "") {
      if (suffix === "" || suffix === "/") {
        return `/properties/${propertyId}`;
      }
      continue;
    }

    const prefix = `/${tab.path}`;
    if (suffix === prefix || suffix.startsWith(`${prefix}/`)) {
      return `/properties/${propertyId}/${tab.path}`;
    }
  }

  return `/properties/${propertyId}`;
}

/**
 * Builds a resume path from stored `lastPath`. Nested routes (e.g. `/leases/:id`) resume to the
 * shell list tab only in v1 — not the specific nested resource.
 */
export function buildPropertyResumePath(propertyId: string, lastPath?: string): string {
  if (lastPath == null || lastPath === "") {
    return `/properties/${propertyId}`;
  }

  return resolveResumeShellTabPath(propertyId, lastPath);
}

export function buildPropertySwitchPath({
  nextPropertyId,
  pathname,
  propertyId,
  search,
}: {
  nextPropertyId: string;
  pathname: string;
  propertyId: string;
  search: string;
}): string {
  const suffix = getPropertyTabSuffix(pathname, propertyId);
  const sanitizedSearch = sanitizePropertySwitchSearchParams(search);
  return `/properties/${nextPropertyId}${suffix}${sanitizedSearch}`;
}
