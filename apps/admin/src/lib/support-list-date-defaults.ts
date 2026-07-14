import { DateRangePreset, resolveDateRangePreset } from "@/lib/date-range-presets";

export function getDefaultSupportListDateRange(): { from: string; to: string } {
  return resolveDateRangePreset(DateRangePreset.MONTH)!;
}
