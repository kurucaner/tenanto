import { DateRangePreset, resolveDateRangePreset } from "@/lib/date-range-presets";

export function getDefaultReportDateRange(): { from: string; to: string } {
  return resolveDateRangePreset(DateRangePreset.CURRENT_MONTH)!;
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
