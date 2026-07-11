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

export function formatReportMonthLabel(month: string): string {
  const [year, monthNum] = month.split("-");
  return new Date(Date.UTC(Number(year), Number(monthNum) - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
  });
}

export function buildPropertyReportsPath(
  propertyId: string,
  options: {
    channelCommissionId?: string;
    from: string;
    rentalType?: string;
    to: string;
    unitId?: string;
  }
): string {
  const params = new URLSearchParams();
  params.set("from", options.from);
  params.set("to", options.to);
  if (options.rentalType) params.set("rentalType", options.rentalType);
  if (options.unitId) params.set("unitId", options.unitId);
  if (options.channelCommissionId) params.set("channelCommissionId", options.channelCommissionId);
  const search = params.toString();
  const querySuffix = search ? `?${search}` : "";
  return `/properties/${propertyId}/reports${querySuffix}`;
}
