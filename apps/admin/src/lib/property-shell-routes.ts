export function isPropertyLeaseDetailPath(pathname: string): boolean {
  return /^\/properties\/[^/]+\/leases\/[^/]+$/.test(pathname);
}
