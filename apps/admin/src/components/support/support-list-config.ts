import { type AdminPageIntroProps } from "@/components/admin-page-intro";
import { type TAppliedSupportFilters } from "@/components/support/support-constants";
import { adminApi, supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
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
  filterIdPrefix: string;
  getQueryKey: (applied: TAppliedSupportFilters) => readonly unknown[];
  intro: AdminPageIntroProps;
  tableVariant: TSupportListVariant;
};

const LIST_PAGE_SIZE = 20;

export const ADMIN_SUPPORT_LIST_CONFIG: TSupportListVariantConfig = {
  emptyMessage: "No support requests match these filters.",
  errorMessage: "Could not load requests.",
  fetchPage: ({ applied, cursor }) =>
    adminApi.listSupportRequests({
      category: applied.category,
      cursor,
      limit: LIST_PAGE_SIZE,
      status: applied.status,
    }),
  filterIdPrefix: "admin-support",
  getQueryKey: (applied) =>
    adminQueryKeys.supportRequestsList({
      category: applied.category,
      status: applied.status,
    }),
  intro: {
    eyebrow: "Support",
  },
  tableVariant: "admin",
};

export const USER_SUPPORT_LIST_CONFIG: TSupportListVariantConfig = {
  emptyMessage: "No support requests yet.",
  errorMessage: "Could not load your support requests.",
  fetchPage: ({ applied, cursor }) =>
    supportApi.list({
      category: applied.category,
      cursor,
      limit: LIST_PAGE_SIZE,
      status: applied.status,
    }),
  filterIdPrefix: "user-support",
  getQueryKey: (applied) =>
    adminQueryKeys.userSupportList({
      category: applied.category,
      status: applied.status,
    }),
  intro: {
    eyebrow: "Support",
  },
  tableVariant: "user",
};
