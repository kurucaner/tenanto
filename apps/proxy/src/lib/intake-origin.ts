const SITE_TO_INTAKE_ORIGIN: Record<string, string> = {
  "ap1.datadoghq.com": "https://browser-intake-ap1-datadoghq.com",
  "ap2.datadoghq.com": "https://browser-intake-ap2-datadoghq.com",
  "datadoghq.com": "https://browser-intake-datadoghq.com",
  "datadoghq.eu": "https://browser-intake-datadoghq.eu",
  "ddog-gov.com": "https://browser-intake-ddog-gov.com",
  "uk1.datadoghq.com": "https://browser-intake-uk1-datadoghq.com",
  "us2.ddog-gov.com": "https://browser-intake-us2-ddog-gov.com",
  "us3.datadoghq.com": "https://browser-intake-us3-datadoghq.com",
  "us5.datadoghq.com": "https://browser-intake-us5-datadoghq.com",
};

export function resolveIntakeOrigin(site: string): string {
  const normalized = site.trim().toLowerCase();
  const origin = SITE_TO_INTAKE_ORIGIN[normalized];

  if (!origin) {
    throw new Error(`Unsupported Datadog site: ${site}`);
  }

  return origin;
}

export function isAllowedRumPath(pathname: string): boolean {
  return pathname.startsWith("/api/v2/");
}
