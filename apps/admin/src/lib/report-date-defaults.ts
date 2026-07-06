export function getDefaultReportDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function formatReportPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function buildPropertyReportsPath(
  propertyId: string,
  from: string,
  to: string,
  rentalType?: string
): string {
  const params = new URLSearchParams();
  params.set("from", from);
  params.set("to", to);
  if (rentalType) params.set("rentalType", rentalType);
  const search = params.toString();
  return `/properties/${propertyId}/reports${search ? `?${search}` : ""}`;
}
