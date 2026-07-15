export function buildObfuscatedProxyUrl(
  proxyUrl: string,
  options: { parameters: string; path: string; subdomain?: string }
): string {
  const params = new URLSearchParams(options.parameters);
  if (options.subdomain) {
    params.set("ddforwardSubdomain", options.subdomain);
  }
  const target = `${options.path}?${params.toString()}`;
  return `${proxyUrl}/ingest?t=${encodeURIComponent(target)}`;
}
