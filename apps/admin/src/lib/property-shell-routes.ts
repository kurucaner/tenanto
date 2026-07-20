export function isPropertyLeaseFocusedPath(pathname: string): boolean {
  return /^\/properties\/[^/]+\/leases\/(?:new|[^/]+)$/.test(pathname);
}

/** @deprecated Prefer {@link isPropertyLeaseFocusedPath} */
export function isPropertyLeaseDetailPath(pathname: string): boolean {
  return isPropertyLeaseFocusedPath(pathname) && !pathname.endsWith("/leases/new");
}
