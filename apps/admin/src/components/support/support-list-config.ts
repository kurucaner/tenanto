import { type AdminPageIntroProps } from "@/components/admin-page-intro";
import { type TAppliedSupportFilters } from "@/components/support/support-constants";
import { adminApi, supportApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { type IAdminSupportRequestListItem, type ISupportRequestListItem } from "@/packages/shared";

export type TSupportListVariant = "admin" | "user";

export type TSupportListPageResponse = {
  items: IAdminSupportRequestListItem[] | ISupportRequestListItem[];
  nextCursor: string | null;
};

export type TSupportListVariantConfig = {
  emptyMessage: string;
  errorMessage: string;
  fetchPage: (params: {
    applied: TAppliedSupportFilters;
    cursor?: string;
  }) => Promise<TSupportListPageResponse>;
  getQueryKey: (applied: TAppliedSupportFilters) => readonly unknown[];
  intro: AdminPageIntroProps;
  searchPlaceholder: string;
  tableVariant: TSupportListVariant;
};

const LIST_PAGE_SIZE = 50;

export const ADMIN_SUPPORT_LIST_CONFIG: TSupportListVariantConfig = {
  emptyMessage: "No support requests match these filters.",
  errorMessage: "Could not load requests.",
  fetchPage: ({ applied, cursor }) =>
    adminApi.listSupportRequests({
      category: applied.category,
      cursor,
      from: applied.from,
      limit: LIST_PAGE_SIZE,
      q: applied.q,
      sortBy: applied.sortBy,
      sortDir: applied.sortDir,
      status: applied.status,
      to: applied.to,
    }),
  getQueryKey: (applied) =>
    queryKeys.supportRequestsList({
      category: applied.category,
      from: applied.from,
      q: applied.q,
      sortBy: applied.sortBy,
      sortDir: applied.sortDir,
      status: applied.status,
      to: applied.to,
    }),
  intro: {
    eyebrow: "Support",
  },
  searchPlaceholder: "Search requests, messages, or submitters…",
  tableVariant: "admin",
};

export const USER_SUPPORT_LIST_CONFIG: TSupportListVariantConfig = {
  emptyMessage: "No support requests yet.",
  errorMessage: "Could not load your support requests.",
  fetchPage: ({ applied, cursor }) =>
    supportApi.list({
      category: applied.category,
      cursor,
      from: applied.from,
      limit: LIST_PAGE_SIZE,
      q: applied.q,
      sortBy: applied.sortBy,
      sortDir: applied.sortDir,
      status: applied.status,
      to: applied.to,
    }),
  getQueryKey: (applied) =>
    queryKeys.userSupportList({
      category: applied.category,
      from: applied.from,
      q: applied.q,
      sortBy: applied.sortBy,
      sortDir: applied.sortDir,
      status: applied.status,
      to: applied.to,
    }),
  intro: {
    eyebrow: "Support",
  },
  searchPlaceholder: "Search requests or messages…",
  tableVariant: "user",
};
