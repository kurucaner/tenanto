import {
  ReportRentalTypeFilter,
  type TReportRentalTypeFilter,
} from "@/packages/shared";

export const RENTAL_TYPE_FILTER_OPTIONS: { label: string; value: TReportRentalTypeFilter | "" }[] =
  [
    { label: "Both", value: "" },
    { label: "Short term", value: ReportRentalTypeFilter.SHORT_TERM },
    { label: "Long term", value: ReportRentalTypeFilter.LONG_TERM },
  ];
