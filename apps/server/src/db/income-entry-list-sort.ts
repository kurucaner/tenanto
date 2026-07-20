import {
  INCOME_ENTRIES_DEFAULT_SORT_BY,
  INCOME_ENTRIES_DEFAULT_SORT_DIR,
  PROPERTY_AMENITY_UNIT_LABEL,
  type TPropertyIncomeEntriesListSortBy,
  type TPropertyIncomeEntriesListSortDir,
} from "@/packages/shared";

export type TIncomeEntrySortKeyKind = "date" | "num" | "text";

export interface IIncomeEntryListSortOptions {
  sortBy: TPropertyIncomeEntriesListSortBy;
  sortDir: TPropertyIncomeEntriesListSortDir;
  sortKeyKind: TIncomeEntrySortKeyKind;
}

const STAY_STATUS_SORT_SQL = `
  CASE pr.status::text
    WHEN 'active' THEN 'Active'
    WHEN 'stayed' THEN 'Stayed'
    WHEN 'canceled' THEN 'Canceled'
    WHEN 'no_show' THEN 'No Show'
    ELSE pr.status::text
  END`;

const STAY_TAX_TOTAL_SQL = `
  (SELECT COALESCE(SUM((tax_item->>'amount')::numeric), 0)
   FROM jsonb_array_elements(pr.tax_breakdown) AS tax_item)`;

const STAY_NET_PAYOUT_SQL = `pr.net_income + ${STAY_TAX_TOTAL_SQL}`;

const SORT_KEY_CONFIG: Record<
  TPropertyIncomeEntriesListSortBy,
  {
    line: { date?: string; num?: string; text?: string };
    longTerm: { date?: string; num?: string; text?: string };
    stay: { date?: string; num?: string; text?: string };
  }
> = {
  channel: {
    line: { text: "''" },
    longTerm: { text: "''" },
    stay: { text: "pcc.name" },
  },
  checkOut: {
    line: { date: "NULL::date" },
    longTerm: { date: "NULL::date" },
    stay: { date: "pr.check_out" },
  },
  cleaning: {
    line: { num: "0" },
    longTerm: { num: "0" },
    stay: { num: "pr.cleaning_fee" },
  },
  commission: {
    line: { num: "0" },
    longTerm: { num: "0" },
    stay: { num: "pr.channel_commission" },
  },
  date: {
    line: { date: "pil.transaction_date" },
    longTerm: { date: "pil.transaction_date" },
    stay: { date: "pr.check_in" },
  },
  gross: {
    line: { num: "pil.gross_income" },
    longTerm: { num: "pil.gross_income" },
    stay: { num: "pr.gross_income" },
  },
  guest: {
    line: { text: "COALESCE(pil.guest_name, '')" },
    longTerm: { text: "COALESCE(pil.guest_name, '')" },
    stay: { text: "pr.guest_name" },
  },
  net: {
    line: { num: "pil.net_income" },
    longTerm: { num: "pil.net_income" },
    stay: { num: "pr.net_income" },
  },
  netPayout: {
    line: { num: "pil.net_income" },
    longTerm: { num: "pil.net_income" },
    stay: { num: STAY_NET_PAYOUT_SQL },
  },
  nights: {
    line: { num: "0" },
    longTerm: { num: "0" },
    stay: { num: "pr.nights" },
  },
  roomTotal: {
    line: { num: "pil.amount" },
    longTerm: { num: "pil.amount" },
    stay: { num: "pr.room_total" },
  },
  status: {
    line: { text: "''" },
    longTerm: { text: "''" },
    stay: { text: STAY_STATUS_SORT_SQL },
  },
  taxes: {
    line: { num: "0" },
    longTerm: { num: "0" },
    stay: { num: STAY_TAX_TOTAL_SQL },
  },
  type: {
    line: { text: "ilt.name" },
    longTerm: { text: "'Long term'" },
    stay: { text: "'Stay'" },
  },
  unit: {
    line: { text: `COALESCE(pu.unit_number, '${PROPERTY_AMENITY_UNIT_LABEL}')` },
    longTerm: { text: `COALESCE(pu.unit_number, '${PROPERTY_AMENITY_UNIT_LABEL}')` },
    stay: { text: "COALESCE(pu.unit_number, '')" },
  },
};

function resolveSortKeyKind(branch: {
  date?: string;
  num?: string;
  text?: string;
}): TIncomeEntrySortKeyKind {
  if (branch.date) {
    return "date";
  }
  if (branch.num) {
    return "num";
  }
  return "text";
}

function getMergedSortColumn(sortKeyKind: TIncomeEntrySortKeyKind): string {
  if (sortKeyKind === "date") {
    return "merged.sort_key_date";
  }
  if (sortKeyKind === "num") {
    return "merged.sort_key_num";
  }
  return "merged.sort_key_text";
}

function getSortKeyTypeCast(sortKeyKind: TIncomeEntrySortKeyKind): string {
  if (sortKeyKind === "date") {
    return "::date";
  }
  if (sortKeyKind === "num") {
    return "::numeric";
  }
  return "::text";
}

export function resolveIncomeEntryListSort(
  sortBy?: TPropertyIncomeEntriesListSortBy,
  sortDir?: TPropertyIncomeEntriesListSortDir
): IIncomeEntryListSortOptions {
  const resolvedSortBy = sortBy ?? INCOME_ENTRIES_DEFAULT_SORT_BY;
  const config = SORT_KEY_CONFIG[resolvedSortBy];
  const branch = config.stay;
  const sortKeyKind = resolveSortKeyKind(branch);

  return {
    sortBy: resolvedSortBy,
    sortDir: sortDir ?? INCOME_ENTRIES_DEFAULT_SORT_DIR,
    sortKeyKind,
  };
}

export function getStaySortKeySelects(sortBy: TPropertyIncomeEntriesListSortBy): {
  sortKeyDate: string;
  sortKeyNum: string;
  sortKeyText: string;
} {
  const branch = SORT_KEY_CONFIG[sortBy].stay;
  return {
    sortKeyDate: branch.date ?? "NULL::date",
    sortKeyNum: branch.num ?? "NULL::numeric",
    sortKeyText: branch.text ?? "NULL::text",
  };
}

export function getLineSortKeySelects(sortBy: TPropertyIncomeEntriesListSortBy): {
  sortKeyDate: string;
  sortKeyNum: string;
  sortKeyText: string;
} {
  const branch = SORT_KEY_CONFIG[sortBy].line;
  return {
    sortKeyDate: branch.date ?? "NULL::date",
    sortKeyNum: branch.num ?? "NULL::numeric",
    sortKeyText: branch.text ?? "NULL::text",
  };
}

export function getLongTermSortKeySelects(sortBy: TPropertyIncomeEntriesListSortBy): {
  sortKeyDate: string;
  sortKeyNum: string;
  sortKeyText: string;
} {
  const branch = SORT_KEY_CONFIG[sortBy].longTerm;
  return {
    sortKeyDate: branch.date ?? "NULL::date",
    sortKeyNum: branch.num ?? "NULL::numeric",
    sortKeyText: branch.text ?? "NULL::text",
  };
}

export function needsUnitJoinForSort(sortBy: TPropertyIncomeEntriesListSortBy): boolean {
  return sortBy === "unit";
}

export function buildIncomeEntryOrderByClause(sort: IIncomeEntryListSortOptions): string {
  const direction = sort.sortDir === "asc" ? "ASC" : "DESC";
  const nulls = sort.sortDir === "asc" ? "NULLS FIRST" : "NULLS LAST";
  const sortColumn = getMergedSortColumn(sort.sortKeyKind);
  const tiebreakerDirection = sort.sortDir === "asc" ? "ASC" : "DESC";

  return `ORDER BY ${sortColumn} ${direction} ${nulls}, merged.created_at ${tiebreakerDirection}, merged.id ${tiebreakerDirection}, merged.entry_kind ${tiebreakerDirection}`;
}

export function buildIncomeEntryCursorPredicate(
  sort: IIncomeEntryListSortOptions,
  startParamIndex: number
): { params: unknown[]; predicate: string; nextParamIndex: number } {
  const operator = sort.sortDir === "asc" ? ">" : "<";
  const sortColumn = getMergedSortColumn(sort.sortKeyKind);

  let p = startParamIndex;
  const typeCast = getSortKeyTypeCast(sort.sortKeyKind);
  const predicate = `(${sortColumn}, merged.created_at, merged.id, merged.entry_kind) ${operator} ($${p++}${typeCast}, $${p++}::timestamptz, $${p++}::uuid, $${p++}::text)`;

  return {
    nextParamIndex: p,
    params: [],
    predicate,
  };
}
