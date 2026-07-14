import { MOBILE_BOTTOM_NAV_SUPPORT_BLEED_HEIGHT_CLASS } from "@/config/mobile-layout";
import { cn } from "@/lib/utils";
import {
  SUPPORT_ALLOWED_IMAGE_MIME_TYPES,
  type SupportCategory,
  type SupportRequestStatus,
  type TSupportRequestsListSortBy,
  type TSupportRequestsListSortDir,
} from "@/packages/shared";

export { SUPPORT_MAX_IMAGE_ATTACHMENTS, SUPPORT_MAX_IMAGE_BYTES } from "@/packages/shared";

export { SUPPORT_ALLOWED_IMAGE_MIME_TYPES };

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
  from?: string;
  q?: string;
  sortBy?: TSupportRequestsListSortBy;
  sortDir?: TSupportRequestsListSortDir;
  status?: SupportRequestStatus;
  to?: string;
};

export const supportTextareaClass = cn(
  "min-h-[88px] w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
);

export const SUPPORT_IMAGE_ACCEPT = SUPPORT_ALLOWED_IMAGE_MIME_TYPES.join(",");

export const SUPPORT_ALLOWED_IMAGE_MIME_TYPE_SET = new Set<string>(
  SUPPORT_ALLOWED_IMAGE_MIME_TYPES
);

export const supportAttachmentDropzoneClass = cn(
  "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-transparent px-4 py-6 text-sm outline-none transition-colors dark:bg-input/30",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
);

export const supportDetailMetaClass = "px-4 md:px-6 lg:px-8";

export const supportDetailRailClass = "bg-muted/20 px-4 py-5 lg:bg-muted/10 lg:px-5";

export const supportDetailSectionLabelClass =
  "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

export const supportComposerShellClass =
  "rounded-2xl bg-muted/40 p-2 shadow-sm ring-1 ring-border/10";

export const supportComposerTextareaClass = cn(
  "min-h-11 w-full resize-none rounded-xl border-0 bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none focus-visible:ring-0"
);

export const supportDetailFullBleedClass = cn(
  "-mx-6 -mb-6 flex min-h-0 w-[calc(100%+3rem)] flex-col",
  MOBILE_BOTTOM_NAV_SUPPORT_BLEED_HEIGHT_CLASS,
  "md:-mx-8 md:-mb-8 md:w-[calc(100%+4rem)] md:h-[calc(100dvh-3.5rem-2rem)]"
);
