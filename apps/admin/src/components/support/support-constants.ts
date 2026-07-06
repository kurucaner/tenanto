import { cn } from "@/lib/utils";
import {
  type SupportCategory,
  type SupportRequestStatus,
} from "@/packages/shared";

export const STATUS_OPTIONS: { label: string; value: "" | SupportRequestStatus }[] = [
  { label: "All statuses", value: "" },
  { label: "Pending", value: "pending" },
  { label: "In progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
];

export const CATEGORY_OPTIONS: { label: string; value: "" | SupportCategory }[] = [
  { label: "All categories", value: "" },
  { label: "Bug", value: "bug" },
  { label: "Feature", value: "feature" },
  { label: "General", value: "general" },
];

export const CREATE_CATEGORY_OPTIONS: { label: string; value: SupportCategory }[] = [
  { label: "Bug report", value: "bug" },
  { label: "Feature request", value: "feature" },
  { label: "General", value: "general" },
];

export const STATUS_LABEL: Record<SupportRequestStatus, string> = {
  in_progress: "In progress",
  pending: "Pending",
  resolved: "Resolved",
};

export const STATUS_BADGE_CLASS: Record<SupportRequestStatus, string> = {
  in_progress:
    "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  pending:
    "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  resolved:
    "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export type TAppliedSupportFilters = {
  category?: SupportCategory;
  status?: SupportRequestStatus;
};

export const supportSelectClass = cn(
  "h-8 w-full min-w-[160px] rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
);

export const supportTextareaClass = cn(
  "min-h-[88px] w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
);
