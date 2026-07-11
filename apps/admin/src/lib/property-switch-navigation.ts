const PRESERVED_PROPERTY_SWITCH_PARAMS = ["channelCommissionId", "from", "rentalType", "to"] as const;

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
