import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Download, MoreHorizontal, Pencil, Plus, Sparkles } from "lucide-react";
import {
  createContext,
  memo,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import {
  type DataTableColumn,
  type DataTableSortController,
} from "@/components/data-table/data-table-types";
import {
  DeletedBadge,
  IncomeRefundBadge,
  RefundEntityButton,
  RestoreEntityButton,
} from "@/components/deleted-badge";
import { PropertyTableExportDialog } from "@/components/exports/property-table-export-dialog";
import {
  CreateIncomeLineDialog,
  type CreateIncomeLineDialogPrefill,
} from "@/components/income/create-income-line-dialog";
import { CreateReservationDialog } from "@/components/income/create-reservation-dialog";
import { EditIncomeLineDialog } from "@/components/income/edit-income-line-dialog";
import { EditReservationDialog } from "@/components/income/edit-reservation-dialog";
import { ImportIncomeCsvDialog } from "@/components/income/import-income-csv-dialog";
import { IncomeEntryTypeBadge } from "@/components/income/income-entry-type-badge";
import { type TIncomeFilterKey } from "@/components/income/income-filter-panel";
import { buildIncomeTypeFilterOptions } from "@/components/income/income-line-form-options";
import { PropertyIncomeToolbar } from "@/components/income/property-income-toolbar";
import {
  RefundEntryDialog,
  type TRefundEntryConfirmPayload,
} from "@/components/income/refund-entry-dialog";
import { ReservationChannelBadge } from "@/components/income/reservation-channel-badge";
import { buildChannelOptions, STATUS_OPTIONS } from "@/components/income/reservation-form-options";
import { ReservationStatusBadge } from "@/components/income/reservation-status-badge";
import { StayCalculationDetailsDialog } from "@/components/income/stay-calculation-details-dialog";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { TableIconButton } from "@/components/table/table-icon-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  type TDeleteConfirmationOptions,
  useDeleteConfirmation,
} from "@/hooks/use-delete-confirmation";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { useLedgerUrlSearch } from "@/hooks/use-ledger-url-search";
import { usePropertyIncomeEntriesInfiniteList } from "@/hooks/use-property-income-entries-infinite-list";
import { usePropertyIncomeLinesInfiniteList } from "@/hooks/use-property-income-lines-infinite-list";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { usePropertyShortStaysInfiniteList } from "@/hooks/use-property-short-stays-infinite-list";
import { useQuickDelete } from "@/hooks/use-quick-delete";
import { useUrlDateRangeFilter } from "@/hooks/use-url-date-range-filter";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { incomeLinesApi, settingsApi, shortStaysApi, unitsApi } from "@/lib/api-client";
import { getDateRangeSummary, type TDateRangePresetId } from "@/lib/date-range-presets";
import { getFilteredTableFetchState } from "@/lib/filtered-table-fetch-state";
import { formatMoney } from "@/lib/format-money";
import {
  getEntryUnitId,
  resolveIncomeUnitLabel,
  sortIncomeEntries,
  type TIncomeEntrySortColumnId,
} from "@/lib/income-entry-sort";
import {
  buildIncomeToolbarClearAllPatch,
  buildIncomeToolbarClearOnePatch,
  buildIncomeToolbarFilterItems,
  countIncomeSecondaryFilters,
  type IIncomeToolbarFilterItem,
  isIncomeToolbarEntryKindFilter,
  type TIncomeToolbarFilterId,
} from "@/lib/income-toolbar-filters";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { ledgerEntryRowClassName } from "@/lib/ledger-entry-row-styles";
import {
  buildExportFilterSummaryOptions,
  formatPropertyTableExportFilterSummary,
} from "@/lib/property-export-utils";
import { queryKeys } from "@/lib/query-keys";
import { getDefaultReportDateRange } from "@/lib/report-date-defaults";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { type TSelectOption } from "@/lib/select-option-types";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  ExportResourceType,
  formatPropertyUnitSelectLabel,
  getIncomeLineRefundableCap,
  getStayAverageDailyRate,
  getStayNetPayout,
  getStayRefundableCap,
  getStayTaxesTotal,
  IncomeEntryKind,
  IncomeRefundFilter,
  type IPropertyIncomeLine,
  type IPropertyIncomeLinesListQuery,
  type IPropertyIncomeLineType,
  type IPropertyReservation,
  type IPropertyReservationsListQuery,
  type IPropertyUnit,
  isDepositIncomeLine,
  resolveDefaultIncomeLineTypeId,
  type TIncomeRefundFilter,
  type TPropertyIncomeEntriesListFilters,
  type TPropertyIncomeEntry,
  type TStayCalculationMetric,
} from "@/packages/shared";

const REFUND_STATUS_FILTER_OPTIONS = [
  { label: "All incomes", value: "" },
  { label: "Refunded", value: IncomeRefundFilter.REFUNDED },
  { label: "Not refunded", value: IncomeRefundFilter.NOT_REFUNDED },
];

function mapStayToEntry(stay: IPropertyReservation): TPropertyIncomeEntry {
  return { entryKind: IncomeEntryKind.STAY, stay };
}

function mapLineToEntry(line: IPropertyIncomeLine): TPropertyIncomeEntry {
  if (line.longStayId != null && !isDepositIncomeLine(line)) {
    return { entryKind: IncomeEntryKind.LONG_TERM, line };
  }

  return { entryKind: IncomeEntryKind.LINE, line };
}

const INCOME_ROW_ESTIMATED_HEIGHT = 64;

const INCOME_SORTABLE_COLUMNS: (DataTableColumn & { id: TIncomeEntrySortColumnId })[] = [
  { id: "type", label: "Type", sortable: true },
  { id: "unit", label: "Unit", sortable: true },
  { id: "guest", label: "Guest", sortable: true },
  { id: "date", label: "Date / Check-in", sortable: true },
  { id: "checkOut", label: "Check-out", sortable: true },
  { id: "nights", label: "Nights", sortable: true },
  { id: "channel", label: "Channel", sortable: true },
  { id: "status", label: "Status", sortable: true },
  { align: "right", id: "roomTotal", label: "Room total", sortable: true },
  { align: "right", id: "cleaning", label: "Cleaning", sortable: true },
  {
    align: "right",
    id: "taxes",
    info: "Applicable taxes on the room + cleaning subtotal.",
    label: "Taxes",
    sortable: true,
  },
  {
    align: "right",
    id: "commission",
    info: "Channel commission. Expedia applies the rate to room total only (cleaning fee excluded).",
    label: "Commission",
    sortable: true,
  },
  {
    align: "right",
    id: "gross",
    info: "Total billed for the stay, including taxes.",
    label: "Gross",
    sortable: true,
  },
  {
    align: "right",
    id: "netPayout",
    info: "What you keep after the booking channel's commission.",
    label: "Net Payout",
    sortable: true,
  },
];

function getIncomeColumns(canManage: boolean): DataTableColumn[] {
  return [...INCOME_SORTABLE_COLUMNS, { hidden: !canManage, id: "actions", label: "Actions" }];
}

function buildDateFilters(from: string, to: string, unitId: string) {
  const next: { from?: string; to?: string; unitId?: string } = {};
  if (from) next.from = from;
  if (to) next.to = to;
  if (unitId) next.unitId = unitId;
  return next;
}

function buildReservationFilters(
  dateFilters: ReturnType<typeof buildDateFilters>,
  channelCommissionId: string,
  q: string,
  refundStatus: string,
  status: string
): IPropertyReservationsListQuery {
  const next: IPropertyReservationsListQuery = { ...dateFilters };
  if (channelCommissionId) next.channelCommissionId = channelCommissionId;
  if (status) next.status = status as IPropertyReservationsListQuery["status"];
  const qTrim = q.trim();
  if (qTrim) next.q = qTrim;
  if (refundStatus) next.refundStatus = refundStatus as TIncomeRefundFilter;
  return next;
}

function buildLineFilters(
  dateFilters: ReturnType<typeof buildDateFilters>,
  incomeType: string,
  q: string,
  refundStatus: string
): IPropertyIncomeLinesListQuery {
  const next: IPropertyIncomeLinesListQuery = { ...dateFilters };
  if (incomeType && !isIncomeToolbarEntryKindFilter(incomeType)) {
    next.incomeLineTypeId = incomeType;
  }
  const qTrim = q.trim();
  if (qTrim) next.q = qTrim;
  if (refundStatus) next.refundStatus = refundStatus as TIncomeRefundFilter;
  return next;
}

interface IBuildIncomeEntriesFiltersOptions {
  channelCommissionId: string;
  dateFilters: ReturnType<typeof buildDateFilters>;
  incomeType: string;
  q: string;
  refundStatus: string;
  sortBy: TPropertyIncomeEntriesListFilters["sortBy"];
  sortDir: TPropertyIncomeEntriesListFilters["sortDir"];
  status: string;
}

function buildIncomeEntriesFilters({
  channelCommissionId,
  dateFilters,
  incomeType,
  q,
  refundStatus,
  sortBy,
  sortDir,
  status,
}: IBuildIncomeEntriesFiltersOptions): TPropertyIncomeEntriesListFilters {
  const next: TPropertyIncomeEntriesListFilters = { ...dateFilters };
  if (channelCommissionId) next.channelCommissionId = channelCommissionId;
  if (status) next.status = status as TPropertyIncomeEntriesListFilters["status"];
  if (incomeType) next.incomeType = incomeType;
  if (sortBy) next.sortBy = sortBy;
  if (sortDir) next.sortDir = sortDir;
  const qTrim = q.trim();
  if (qTrim) next.q = qTrim;
  if (refundStatus) next.refundStatus = refundStatus as TIncomeRefundFilter;
  return next;
}

interface IIncomeInfiniteListPagination {
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean | undefined;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isPending: boolean;
  meta: { totalCount: number } | undefined;
}

function getActiveIncomeInfiniteListPagination(
  isAllView: boolean,
  isStayOnlyView: boolean,
  isEntriesKindOnlyView: boolean,
  allViewList: IIncomeInfiniteListPagination,
  stayOnlyViewList: IIncomeInfiniteListPagination,
  lineTypeOnlyViewList: IIncomeInfiniteListPagination
): IIncomeInfiniteListPagination {
  if (isAllView || isEntriesKindOnlyView) {
    return allViewList;
  }
  if (isStayOnlyView) {
    return stayOnlyViewList;
  }
  return lineTypeOnlyViewList;
}

function getIncomeEntryKey(entry: TPropertyIncomeEntry): string {
  if (entry.entryKind === IncomeEntryKind.STAY) {
    return `stay-${entry.stay.id}`;
  }
  if (entry.entryKind === IncomeEntryKind.LONG_TERM) {
    return `longTerm-${entry.line.id}`;
  }
  return `line-${entry.line.id}`;
}

function buildStayUnrefundConfirmationOptions(
  stay: IPropertyReservation
): TDeleteConfirmationOptions<IPropertyReservation> {
  return {
    confirmLabel: "Undo refund",
    description: `Restore ${stay.guestName}'s stay to financial reports?`,
    target: stay,
    title: "Undo stay refund",
  };
}

function buildLineUnrefundConfirmationOptions(
  line: IPropertyIncomeLine
): TDeleteConfirmationOptions<IPropertyIncomeLine> {
  const label = line.incomeLineTypeName ?? line.incomeLineTypeId;

  return {
    confirmLabel: "Undo refund",
    description: `Restore this ${label} entry to financial reports?`,
    target: line,
    title: "Undo income refund",
  };
}

type TRefundEntryRequest =
  | {
      cap: number;
      description: string;
      kind: "stay";
      target: IPropertyReservation;
      title: string;
    }
  | {
      cap: number;
      description: string;
      kind: "line";
      target: IPropertyIncomeLine;
      title: string;
    };

function isRefundEntryPending(
  request: TRefundEntryRequest | null,
  isRefundStayPending: boolean,
  isRefundLinePending: boolean
): boolean {
  if (request?.kind === "stay") {
    return isRefundStayPending;
  }
  if (request?.kind === "line") {
    return isRefundLinePending;
  }
  return false;
}

function isDepositLineRefundRequest(request: TRefundEntryRequest | null): boolean {
  return request?.kind === "line" && isDepositIncomeLine(request.target);
}

function buildStayRefundEntryRequest(stay: IPropertyReservation): TRefundEntryRequest {
  return {
    cap: getStayRefundableCap(stay),
    description: `Refund stay for ${stay.guestName}? Refunded amounts are excluded from reports but remain visible here.`,
    kind: "stay",
    target: stay,
    title: "Refund stay",
  };
}

function buildLineRefundEntryRequest(line: IPropertyIncomeLine): TRefundEntryRequest {
  if (isDepositIncomeLine(line)) {
    return {
      cap: getIncomeLineRefundableCap(line),
      description:
        "Return part or all of the held deposit to the tenant. Any amount you don't refund stays withheld (for example, for damages). Refunded amounts are excluded from reports but remain visible here.",
      kind: "line",
      target: line,
      title: "Refund security deposit",
    };
  }

  const label = line.incomeLineTypeName ?? line.incomeLineTypeId;

  return {
    cap: getIncomeLineRefundableCap(line),
    description: `Refund this ${label} entry? Refunded amounts are excluded from reports but remain visible here.`,
    kind: "line",
    target: line,
    title: "Refund income",
  };
}

function buildOtherIncomePrefillFromStay(
  stay: IPropertyReservation,
  incomeLineTypes: IPropertyIncomeLineType[]
): CreateIncomeLineDialogPrefill {
  return {
    guestName: stay.guestName,
    incomeLineTypeId: resolveDefaultIncomeLineTypeId(incomeLineTypes),
    reservationId: stay.id,
    transactionDate: getTodayLocalIsoDate(),
    unitId: stay.unitId,
  };
}

function openOtherIncomeFromStay(
  stay: IPropertyReservation,
  incomeLineTypes: IPropertyIncomeLineType[],
  actions: {
    setCreateLineLockedStay: (stay: IPropertyReservation | null) => void;
    setCreateLineOpen: (open: boolean) => void;
    setCreateLinePrefill: (prefill: CreateIncomeLineDialogPrefill | null) => void;
  }
): void {
  actions.setCreateLineLockedStay(stay);
  actions.setCreateLinePrefill(buildOtherIncomePrefillFromStay(stay, incomeLineTypes));
  actions.setCreateLineOpen(true);
}

interface IPropertyIncomeCreateLineContext {
  openBlank: () => void;
  openFromStay: (stay: IPropertyReservation) => void;
}

const PropertyIncomeCreateLineContext = createContext<IPropertyIncomeCreateLineContext | null>(
  null
);

function usePropertyIncomeCreateLine(): IPropertyIncomeCreateLineContext {
  const context = useContext(PropertyIncomeCreateLineContext);
  if (context === null) {
    throw new Error(
      "usePropertyIncomeCreateLine must be used within PropertyIncomeCreateLineProvider"
    );
  }
  return context;
}

const PropertyIncomeCreateLineProvider = memo(function PropertyIncomeCreateLineProvider({
  children,
  incomeLineTypes,
  propertyId,
  units,
}: {
  children: ReactNode;
  incomeLineTypes: IPropertyIncomeLineType[];
  propertyId: string;
  units: IPropertyUnit[];
}) {
  const [createLineOpen, setCreateLineOpen] = useState(false);
  const [createLinePrefill, setCreateLinePrefill] = useState<CreateIncomeLineDialogPrefill | null>(
    null
  );
  const [createLineLockedStay, setCreateLineLockedStay] = useState<IPropertyReservation | null>(
    null
  );

  const resetCreateLineState = useCallback(() => {
    setCreateLinePrefill(null);
    setCreateLineLockedStay(null);
  }, []);

  const openBlank = useCallback(() => {
    resetCreateLineState();
    setCreateLineOpen(true);
  }, [resetCreateLineState]);

  const openFromStay = useCallback(
    (stay: IPropertyReservation) => {
      openOtherIncomeFromStay(stay, incomeLineTypes, {
        setCreateLineLockedStay,
        setCreateLineOpen,
        setCreateLinePrefill,
      });
    },
    [incomeLineTypes]
  );

  const handleCreateIncomeLineOpenChange = useCallback(
    (open: boolean) => {
      setCreateLineOpen(open);
      if (!open) {
        resetCreateLineState();
      }
    },
    [resetCreateLineState]
  );

  const contextValue = useMemo(() => ({ openBlank, openFromStay }), [openBlank, openFromStay]);

  return (
    <PropertyIncomeCreateLineContext.Provider value={contextValue}>
      {children}
      <CreateIncomeLineDialog
        incomeLineTypes={incomeLineTypes}
        lockedStay={createLineLockedStay}
        onOpenChange={handleCreateIncomeLineOpenChange}
        open={createLineOpen}
        prefill={createLinePrefill}
        propertyId={propertyId}
        units={units}
      />
    </PropertyIncomeCreateLineContext.Provider>
  );
});

const PropertyIncomeEntriesTable = memo(
  ({
    activeFilterCount,
    activeFilterItems,
    activePreset,
    canManage,
    channelCommissionId,
    channelFilterOptions,
    countLabel,
    deletingLineId,
    deletingStayId,
    displayFrom,
    displayTo,
    entries,
    hasNextPage,
    incomeLineTypes,
    incomeType,
    incomeTypeFilterOptions,
    isFetchingNextPage,
    isLoading,
    isQuickDeleteActive,
    isRefreshing,
    onClearAllToolbarFilters,
    onClearSecondaryFilters,
    onDeleteLine,
    onDeleteStay,
    onFilterChange,
    onFromChange,
    onPresetChange,
    onRefundLine,
    onRefundStay,
    onRemoveToolbarFilter,
    onRestoreLine,
    onRestoreStay,
    onSearchInputChange,
    onShowCalculationDetails,
    onToChange,
    propertyId,
    refundingLineId,
    refundingStayId,
    refundStatus,
    refundStatusFilterOptions,
    scrollSentinelRef,
    searchInput,
    showStays,
    sort,
    status,
    statusOptions,
    unitId,
    unitLabelById,
    units,
  }: {
    activeFilterCount: number;
    activeFilterItems: IIncomeToolbarFilterItem[];
    activePreset: TDateRangePresetId | null;
    canManage: boolean;
    channelCommissionId: string;
    channelFilterOptions: TSelectOption[];
    countLabel?: string;
    deletingLineId?: string;
    deletingStayId?: string;
    displayFrom: string;
    displayTo: string;
    entries: TPropertyIncomeEntry[];
    hasNextPage: boolean;
    incomeLineTypes: IPropertyIncomeLineType[];
    incomeType: string;
    incomeTypeFilterOptions: TSelectOption[];
    isFetchingNextPage: boolean;
    isLoading: boolean;
    isQuickDeleteActive: boolean;
    isRefreshing: boolean;
    onClearAllToolbarFilters: () => void;
    onClearSecondaryFilters: () => void;
    onDeleteLine: (line: IPropertyIncomeLine, event?: MouseEvent<HTMLButtonElement>) => void;
    onDeleteStay: (stay: IPropertyReservation, event?: MouseEvent<HTMLButtonElement>) => void;
    onFilterChange: (key: TIncomeFilterKey, value: string) => void;
    onFromChange: (value: string) => void;
    onPresetChange: (presetId: TDateRangePresetId) => void;
    onRefundLine: (line: IPropertyIncomeLine) => void;
    onRefundStay: (stay: IPropertyReservation) => void;
    onRemoveToolbarFilter: (id: TIncomeToolbarFilterId) => void;
    onRestoreLine: (line: IPropertyIncomeLine) => void;
    onRestoreStay: (stay: IPropertyReservation) => void;
    onSearchInputChange: (value: string) => void;
    onShowCalculationDetails: (stay: IPropertyReservation, metric: TStayCalculationMetric) => void;
    onToChange: (value: string) => void;
    propertyId: string;
    refundStatus: string;
    refundStatusFilterOptions: TSelectOption[];
    refundingLineId?: string;
    refundingStayId?: string;
    scrollSentinelRef: RefObject<HTMLDivElement | null>;
    searchInput: string;
    showStays: boolean;
    sort: DataTableSortController;
    status: string;
    statusOptions: TSelectOption[];
    unitId: string;
    unitLabelById: Map<string, string>;
    units: IPropertyUnit[];
  }) => {
    const { openFromStay } = usePropertyIncomeCreateLine();
    const [editIncomeLine, setEditIncomeLine] = useState<IPropertyIncomeLine | null>(null);
    const [editReservation, setEditReservation] = useState<IPropertyReservation | null>(null);

    const handleEditLine = useCallback((line: IPropertyIncomeLine) => {
      setEditIncomeLine(line);
    }, []);

    const handleEditStay = useCallback((stay: IPropertyReservation) => {
      setEditReservation(stay);
    }, []);

    const handleEditIncomeLineOpenChange = useCallback((open: boolean) => {
      if (!open) {
        setEditIncomeLine(null);
      }
    }, []);

    const handleEditReservationOpenChange = useCallback((open: boolean) => {
      if (!open) {
        setEditReservation(null);
      }
    }, []);

    const renderIncomeEntryRow = useCallback(
      (entry: TPropertyIncomeEntry) => (
        <IncomeEntryRow
          canManage={canManage}
          deletingLineId={deletingLineId}
          deletingStayId={deletingStayId}
          entry={entry}
          isQuickDeleteActive={isQuickDeleteActive}
          key={getIncomeEntryKey(entry)}
          onAddOtherIncomeFromStay={openFromStay}
          onDeleteLine={onDeleteLine}
          onDeleteStay={onDeleteStay}
          onEditLine={handleEditLine}
          onEditStay={handleEditStay}
          onRefundLine={onRefundLine}
          onRefundStay={onRefundStay}
          onRestoreLine={onRestoreLine}
          onRestoreStay={onRestoreStay}
          onShowCalculationDetails={onShowCalculationDetails}
          refundingLineId={refundingLineId}
          refundingStayId={refundingStayId}
          unitLabel={resolveIncomeUnitLabel(getEntryUnitId(entry), unitLabelById)}
        />
      ),
      [
        canManage,
        deletingLineId,
        deletingStayId,
        handleEditLine,
        handleEditStay,
        isQuickDeleteActive,
        onDeleteLine,
        onDeleteStay,
        onRefundLine,
        onRefundStay,
        onRestoreLine,
        onRestoreStay,
        onShowCalculationDetails,
        openFromStay,
        refundingLineId,
        refundingStayId,
        unitLabelById,
      ]
    );

    const columns = useMemo(() => getIncomeColumns(canManage), [canManage]);

    const toolbar = useMemo(
      () => (
        <PropertyIncomeToolbar
          activeFilterCount={activeFilterCount}
          activeFilterItems={activeFilterItems}
          activePreset={activePreset}
          channelCommissionId={channelCommissionId}
          channelFilterOptions={channelFilterOptions}
          countLabel={countLabel}
          from={displayFrom}
          incomeType={incomeType}
          incomeTypeFilterOptions={incomeTypeFilterOptions}
          onClearAll={onClearAllToolbarFilters}
          onClearSecondaryFilters={onClearSecondaryFilters}
          onFilterChange={onFilterChange}
          onFromChange={onFromChange}
          onPresetChange={onPresetChange}
          onRemoveFilter={onRemoveToolbarFilter}
          onSearchInputChange={onSearchInputChange}
          onToChange={onToChange}
          refundStatus={refundStatus}
          refundStatusFilterOptions={refundStatusFilterOptions}
          searchInput={searchInput}
          showStays={showStays}
          status={status}
          statusOptions={statusOptions}
          to={displayTo}
          unitId={unitId}
          units={units}
        />
      ),
      [
        activeFilterCount,
        activeFilterItems,
        activePreset,
        channelCommissionId,
        channelFilterOptions,
        countLabel,
        displayFrom,
        displayTo,
        incomeType,
        incomeTypeFilterOptions,
        onClearAllToolbarFilters,
        onClearSecondaryFilters,
        onFilterChange,
        onFromChange,
        onPresetChange,
        onRemoveToolbarFilter,
        onSearchInputChange,
        onToChange,
        refundStatus,
        refundStatusFilterOptions,
        searchInput,
        showStays,
        status,
        statusOptions,
        unitId,
        units,
      ]
    );

    return (
      <>
        <DataTable
          columns={columns}
          emptyMessage={`No income entries yet.${canManage ? " Add a stay or other income to get started." : ""}`}
          getItemKey={getIncomeEntryKey}
          infiniteScroll={{ hasNextPage, isFetchingNextPage }}
          infiniteScrollSentinelRef={scrollSentinelRef}
          isPending={isLoading}
          isRefreshing={isRefreshing}
          items={entries}
          renderRow={renderIncomeEntryRow}
          sort={sort}
          toolbar={toolbar}
          virtualization={{ estimateRowHeight: INCOME_ROW_ESTIMATED_HEIGHT }}
        />
        {editReservation ? (
          <EditReservationDialog
            key={editReservation.id}
            onOpenChange={handleEditReservationOpenChange}
            open={true}
            propertyId={propertyId}
            reservation={editReservation}
            units={units}
          />
        ) : null}
        {editIncomeLine ? (
          <EditIncomeLineDialog
            incomeLine={editIncomeLine}
            incomeLineTypes={incomeLineTypes}
            key={editIncomeLine.id}
            onOpenChange={handleEditIncomeLineOpenChange}
            open={true}
            propertyId={propertyId}
            units={units}
          />
        ) : null}
      </>
    );
  }
);
PropertyIncomeEntriesTable.displayName = "PropertyIncomeEntriesTable";

const PropertyIncomeShellActions = memo(function PropertyIncomeShellActions({
  canManage,
  onExportTable,
  propertyId,
}: {
  canManage: boolean;
  onExportTable: () => void;
  propertyId: string;
}) {
  const { openBlank } = usePropertyIncomeCreateLine();
  const [createStayOpen, setCreateStayOpen] = useState(false);
  const [importCsvOpen, setImportCsvOpen] = useState(false);

  const handleAddStay = useCallback(() => {
    setCreateStayOpen(true);
  }, []);

  const handleImportCsv = useCallback(() => {
    setImportCsvOpen(true);
  }, []);

  const pageActions = useMemo(
    () => (
      <PropertyIncomePageActions
        canManage={canManage}
        onAddOtherIncome={openBlank}
        onAddStay={handleAddStay}
        onExportTable={onExportTable}
        onImportCsv={handleImportCsv}
      />
    ),
    [canManage, handleAddStay, handleImportCsv, onExportTable, openBlank]
  );

  usePropertyShellActions(pageActions);

  return (
    <>
      <CreateReservationDialog
        onOpenChange={setCreateStayOpen}
        open={createStayOpen}
        propertyId={propertyId}
      />
      <ImportIncomeCsvDialog
        onOpenChange={setImportCsvOpen}
        open={importCsvOpen}
        propertyId={propertyId}
      />
    </>
  );
});
PropertyIncomeShellActions.displayName = "PropertyIncomeShellActions";

const PropertyIncomePageActions = memo(
  ({
    canManage,
    onAddOtherIncome,
    onAddStay,
    onExportTable,
    onImportCsv,
  }: {
    canManage: boolean;
    onAddOtherIncome: () => void;
    onAddStay: () => void;
    onExportTable: () => void;
    onImportCsv: () => void;
  }) => (
    <div className="flex items-center gap-2">
      {canManage ? (
        <>
          <Button
            className="hidden gap-1.5 sm:inline-flex"
            onClick={onAddStay}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="size-3.5" />
            Add Short Stay
          </Button>
          <Button className="gap-1.5" onClick={onAddOtherIncome} size="sm" type="button">
            <Plus className="size-3.5" />
            Add Other Income
          </Button>
        </>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="More income actions" size="icon-sm" type="button" variant="outline">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onExportTable}>
            <Download />
            Export table
          </DropdownMenuItem>
          {canManage ? (
            <>
              <DropdownMenuItem className="sm:hidden" onSelect={onAddStay}>
                <Plus />
                Add Short Stay
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onImportCsv}>
                <Sparkles />
                Import CSV
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
);
PropertyIncomePageActions.displayName = "PropertyIncomePageActions";

const StayCalculationDetailsLink = memo(({ onClick }: { onClick: () => void }) => (
  <Button className="h-auto px-0 py-0 text-xs" onClick={onClick} type="button" variant="link">
    Details
  </Button>
));
StayCalculationDetailsLink.displayName = "StayCalculationDetailsLink";

const StayMetricCell = memo(
  ({
    amountLabel,
    onShowDetails,
    showDetails,
  }: {
    amountLabel: string;
    onShowDetails: () => void;
    showDetails: boolean;
  }) => (
    <div className="flex flex-col items-end gap-1">
      <span>{amountLabel}</span>
      {showDetails ? <StayCalculationDetailsLink onClick={onShowDetails} /> : null}
    </div>
  )
);
StayMetricCell.displayName = "StayMetricCell";

type IncomeStayEntryRowProps = {
  canManage: boolean;
  deletingStayId?: string;
  isQuickDeleteActive: boolean;
  onAddOtherIncomeFromStay: (stay: IPropertyReservation) => void;
  onDeleteStay: (stay: IPropertyReservation, event?: MouseEvent<HTMLButtonElement>) => void;
  onEditStay: (stay: IPropertyReservation) => void;
  onRefundStay: (stay: IPropertyReservation) => void;
  onRestoreStay: (stay: IPropertyReservation) => void;
  onShowCalculationDetails: (stay: IPropertyReservation, metric: TStayCalculationMetric) => void;
  refundingStayId?: string;
  stay: IPropertyReservation;
  unitLabel: string;
};

const IncomeStayEntryRow = memo(
  ({
    canManage,
    deletingStayId,
    isQuickDeleteActive,
    onAddOtherIncomeFromStay,
    onDeleteStay,
    onEditStay,
    onRefundStay,
    onRestoreStay,
    onShowCalculationDetails,
    refundingStayId,
    stay,
    unitLabel,
  }: IncomeStayEntryRowProps) => {
    const isDeletePending = deletingStayId === stay.id;
    const isRefundPending = refundingStayId === stay.id;
    const isRefunded = stay.refundedAt !== null;
    const taxesTotal = getStayTaxesTotal(stay);
    const showTaxesDetails = taxesTotal > 0;
    const showCommissionDetails = stay.channelCommission > 0;
    const netPayout = getStayNetPayout(stay);

    return (
      <TableRow className={ledgerEntryRowClassName(stay.isDeleted, stay.refundedAt)}>
        <TableCell>
          <div className="flex items-center gap-2">
            <IncomeEntryTypeBadge entryKind={IncomeEntryKind.STAY} />
            {stay.isDeleted ? <DeletedBadge /> : null}
            {!stay.isDeleted ? (
              <IncomeRefundBadge
                cap={getStayRefundableCap(stay)}
                refundedAmount={stay.refundedAmount}
                refundedAt={stay.refundedAt}
              />
            ) : null}
          </div>
        </TableCell>
        <TableCell className="font-medium">{unitLabel}</TableCell>
        <TableCell>{stay.guestName}</TableCell>
        <TableCell>{stay.checkIn}</TableCell>
        <TableCell>{stay.checkOut}</TableCell>
        <TableCell>{stay.nights}</TableCell>
        <TableCell>
          <ReservationChannelBadge channelName={stay.channelName} />
        </TableCell>
        <TableCell>
          <ReservationStatusBadge status={stay.status} />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex flex-col items-end">
            <span>{formatMoney(stay.roomTotal)}</span>
            {stay.nights > 1 ? (
              <span className="text-muted-foreground text-xs">
                {formatMoney(getStayAverageDailyRate(stay))}/night
              </span>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="text-right">{formatMoney(stay.cleaningFee)}</TableCell>
        <TableCell className="text-right">
          <StayMetricCell
            amountLabel={taxesTotal > 0 ? formatMoney(taxesTotal) : "—"}
            onShowDetails={() => onShowCalculationDetails(stay, "taxes")}
            showDetails={showTaxesDetails}
          />
        </TableCell>
        <TableCell className="text-right">
          <StayMetricCell
            amountLabel={stay.channelCommission > 0 ? formatMoney(stay.channelCommission) : "—"}
            onShowDetails={() => onShowCalculationDetails(stay, "commission")}
            showDetails={showCommissionDetails}
          />
        </TableCell>
        <TableCell className="text-right">
          <StayMetricCell
            amountLabel={formatMoney(stay.grossIncome)}
            onShowDetails={() => onShowCalculationDetails(stay, "gross")}
            showDetails={true}
          />
        </TableCell>
        <TableCell className="text-right">
          <StayMetricCell
            amountLabel={formatMoney(netPayout)}
            onShowDetails={() => onShowCalculationDetails(stay, "netPayout")}
            showDetails={true}
          />
        </TableCell>
        {canManage ? (
          <TableCell>
            <div className="flex items-center gap-1">
              {stay.isDeleted ? (
                <RestoreEntityButton ariaLabel="Restore stay" onClick={() => onRestoreStay(stay)} />
              ) : (
                <>
                  {!isRefunded ? (
                    <TableIconButton
                      ariaLabel="Add other income for this stay"
                      onClick={() => onAddOtherIncomeFromStay(stay)}
                      tooltip="Add other income"
                    >
                      <CirclePlus className="size-3.5" />
                    </TableIconButton>
                  ) : null}
                  {!isRefunded ? (
                    <TableIconButton
                      ariaLabel="Edit stay"
                      onClick={() => onEditStay(stay)}
                      tooltip="Edit stay"
                    >
                      <Pencil className="size-3.5" />
                    </TableIconButton>
                  ) : null}
                  <RefundEntityButton
                    ariaLabel={isRefunded ? "Undo stay refund" : "Refund stay"}
                    disabled={isRefundPending}
                    isRefunded={isRefunded}
                    onClick={() => onRefundStay(stay)}
                  />
                  <QuickDeleteButton
                    ariaLabel="Delete stay"
                    disabled={isDeletePending || isRefundPending}
                    onClick={(event) => onDeleteStay(stay, event)}
                    quickDeleteActive={isQuickDeleteActive}
                  />
                </>
              )}
            </div>
          </TableCell>
        ) : null}
      </TableRow>
    );
  }
);
IncomeStayEntryRow.displayName = "IncomeStayEntryRow";

type IncomeLineEntryRowProps = {
  canManage: boolean;
  deletingLineId?: string;
  entryKind?: typeof IncomeEntryKind.LINE | typeof IncomeEntryKind.LONG_TERM;
  isQuickDeleteActive: boolean;
  line: IPropertyIncomeLine;
  onDeleteLine: (line: IPropertyIncomeLine, event?: MouseEvent<HTMLButtonElement>) => void;
  onEditLine: (line: IPropertyIncomeLine) => void;
  onRefundLine: (line: IPropertyIncomeLine) => void;
  onRestoreLine: (line: IPropertyIncomeLine) => void;
  refundingLineId?: string;
  unitLabel: string;
};

const IncomeLineEntryRow = memo(
  ({
    canManage,
    deletingLineId,
    entryKind,
    isQuickDeleteActive,
    line,
    onDeleteLine,
    onEditLine,
    onRefundLine,
    onRestoreLine,
    refundingLineId,
    unitLabel,
  }: IncomeLineEntryRowProps) => {
    const isDeletePending = deletingLineId === line.id;
    const isRefundPending = refundingLineId === line.id;
    const isRefunded = line.refundedAt !== null;
    const resolvedEntryKind =
      entryKind ??
      (line.longStayId != null && !isDepositIncomeLine(line)
        ? IncomeEntryKind.LONG_TERM
        : IncomeEntryKind.LINE);
    const showDepositBadge = isDepositIncomeLine(line);

    return (
      <TableRow className={ledgerEntryRowClassName(line.isDeleted, line.refundedAt)}>
        <TableCell>
          <div className="flex items-center gap-2">
            {showDepositBadge ? (
              <IncomeEntryTypeBadge entryKind={IncomeEntryKind.DEPOSIT} />
            ) : resolvedEntryKind === IncomeEntryKind.LONG_TERM ? (
              <IncomeEntryTypeBadge entryKind={IncomeEntryKind.LONG_TERM} />
            ) : (
              <IncomeEntryTypeBadge
                entryKind={IncomeEntryKind.LINE}
                incomeLineTypeId={line.incomeLineTypeId}
                label={line.incomeLineTypeName ?? line.incomeLineTypeId}
              />
            )}
            {line.isDeleted ? <DeletedBadge /> : null}
            {!line.isDeleted ? (
              <IncomeRefundBadge
                cap={getIncomeLineRefundableCap(line)}
                refundedAmount={line.refundedAmount}
                refundedAt={line.refundedAt}
              />
            ) : null}
          </div>
        </TableCell>
        <TableCell className="font-medium">{unitLabel}</TableCell>
        <TableCell>{line.guestName ?? "—"}</TableCell>
        <TableCell>{line.transactionDate}</TableCell>
        <TableCell>—</TableCell>
        <TableCell>—</TableCell>
        <TableCell>—</TableCell>
        <TableCell>—</TableCell>
        <TableCell className="text-right">{formatMoney(line.amount)}</TableCell>
        <TableCell className="text-right">—</TableCell>
        <TableCell className="text-right">—</TableCell>
        <TableCell className="text-right">—</TableCell>
        <TableCell className="text-right">{formatMoney(line.grossIncome)}</TableCell>
        <TableCell className="text-right">{formatMoney(line.netIncome)}</TableCell>
        {canManage ? (
          <TableCell>
            <div className="flex items-center gap-1">
              {line.isDeleted ? (
                <RestoreEntityButton
                  ariaLabel="Restore other income"
                  onClick={() => onRestoreLine(line)}
                />
              ) : (
                <>
                  {!isRefunded ? (
                    <TableIconButton
                      ariaLabel="Edit other income"
                      onClick={() => onEditLine(line)}
                      tooltip="Edit other income"
                    >
                      <Pencil className="size-3.5" />
                    </TableIconButton>
                  ) : null}
                  <RefundEntityButton
                    ariaLabel={isRefunded ? "Undo income refund" : "Refund income"}
                    disabled={isRefundPending}
                    isRefunded={isRefunded}
                    onClick={() => onRefundLine(line)}
                  />
                  <QuickDeleteButton
                    ariaLabel="Delete other income"
                    disabled={isDeletePending || isRefundPending}
                    onClick={(event) => onDeleteLine(line, event)}
                    quickDeleteActive={isQuickDeleteActive}
                  />
                </>
              )}
            </div>
          </TableCell>
        ) : null}
      </TableRow>
    );
  }
);
IncomeLineEntryRow.displayName = "IncomeLineEntryRow";

const IncomeEntryRow = memo(
  ({
    canManage,
    deletingLineId,
    deletingStayId,
    entry,
    isQuickDeleteActive,
    onAddOtherIncomeFromStay,
    onDeleteLine,
    onDeleteStay,
    onEditLine,
    onEditStay,
    onRefundLine,
    onRefundStay,
    onRestoreLine,
    onRestoreStay,
    onShowCalculationDetails,
    refundingLineId,
    refundingStayId,
    unitLabel,
  }: {
    canManage: boolean;
    deletingLineId?: string;
    deletingStayId?: string;
    entry: TPropertyIncomeEntry;
    isQuickDeleteActive: boolean;
    onAddOtherIncomeFromStay: (stay: IPropertyReservation) => void;
    onDeleteLine: (line: IPropertyIncomeLine, event?: MouseEvent<HTMLButtonElement>) => void;
    onDeleteStay: (stay: IPropertyReservation, event?: MouseEvent<HTMLButtonElement>) => void;
    onEditLine: (line: IPropertyIncomeLine) => void;
    onEditStay: (stay: IPropertyReservation) => void;
    onRefundLine: (line: IPropertyIncomeLine) => void;
    onRefundStay: (stay: IPropertyReservation) => void;
    onRestoreLine: (line: IPropertyIncomeLine) => void;
    onRestoreStay: (stay: IPropertyReservation) => void;
    onShowCalculationDetails: (stay: IPropertyReservation, metric: TStayCalculationMetric) => void;
    refundingLineId?: string;
    refundingStayId?: string;
    unitLabel: string;
  }) => {
    if (entry.entryKind === IncomeEntryKind.STAY) {
      return (
        <IncomeStayEntryRow
          canManage={canManage}
          deletingStayId={deletingStayId}
          isQuickDeleteActive={isQuickDeleteActive}
          onAddOtherIncomeFromStay={onAddOtherIncomeFromStay}
          onDeleteStay={onDeleteStay}
          onEditStay={onEditStay}
          onRefundStay={onRefundStay}
          onRestoreStay={onRestoreStay}
          onShowCalculationDetails={onShowCalculationDetails}
          refundingStayId={refundingStayId}
          stay={entry.stay}
          unitLabel={unitLabel}
        />
      );
    }

    return (
      <IncomeLineEntryRow
        canManage={canManage}
        deletingLineId={deletingLineId}
        entryKind={
          entry.entryKind === IncomeEntryKind.LONG_TERM
            ? IncomeEntryKind.LONG_TERM
            : IncomeEntryKind.LINE
        }
        isQuickDeleteActive={isQuickDeleteActive}
        line={entry.line}
        onDeleteLine={onDeleteLine}
        onEditLine={onEditLine}
        onRefundLine={onRefundLine}
        onRestoreLine={onRestoreLine}
        refundingLineId={refundingLineId}
        unitLabel={unitLabel}
      />
    );
  }
);
IncomeEntryRow.displayName = "IncomeEntryRow";

const PropertyIncomePage = memo(function PropertyIncomePage() {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;
  const queryClient = useQueryClient();
  const [exportTableOpen, setExportTableOpen] = useState(false);
  const [calculationDetails, setCalculationDetails] = useState<{
    metric: TStayCalculationMetric;
    stay: IPropertyReservation;
  } | null>(null);
  const [refundEntryRequest, setRefundEntryRequest] = useState<TRefundEntryRequest | null>(null);
  const defaultDateRange = useMemo(() => getDefaultReportDateRange(), []);
  const incomeFilterSchema = useMemo(
    () =>
      defineUrlFilterSchema<{
        allTime: string;
        channelCommissionId: string;
        from: string;
        incomeType: string;
        q: string;
        refundStatus: string;
        status: string;
        to: string;
        unitId: string;
      }>({
        allTime: { defaultValue: "" },
        channelCommissionId: { defaultValue: "" },
        from: { defaultValue: defaultDateRange.from },
        incomeType: { defaultValue: "" },
        q: { defaultValue: "" },
        refundStatus: { defaultValue: "" },
        status: { defaultValue: "" },
        to: { defaultValue: defaultDateRange.to },
        unitId: { defaultValue: "" },
      }),
    [defaultDateRange.from, defaultDateRange.to]
  );
  const { filters, setFilter, setFilters } = useUrlFilterState(incomeFilterSchema);
  const {
    allTime: allTimeParam,
    channelCommissionId,
    from,
    incomeType,
    q,
    refundStatus,
    status,
    to,
    unitId,
  } = filters;
  const allTime = allTimeParam === "true";
  const {
    activePreset,
    displayFrom,
    displayTo,
    effectiveFrom,
    effectiveTo,
    onFromChange,
    onPresetChange,
    onToChange,
  } = useUrlDateRangeFilter({
    allTime,
    dateFilterSchema: incomeFilterSchema,
    from,
    to,
  });
  const { onSearchInputChange: handleSearchInputChange, searchInput } = useLedgerUrlSearch(
    q,
    setFilter
  );
  const sortController = useUrlTableSort({
    defaultColumnId: "date",
    defaultDirection: "desc",
  });
  const { sortState } = sortController;

  const handleIncomeFilterChange = useCallback(
    (key: TIncomeFilterKey, value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  const dateFilters = useMemo(
    () => buildDateFilters(effectiveFrom, effectiveTo, unitId),
    [effectiveFrom, effectiveTo, unitId]
  );

  const reservationFilters = useMemo(
    () => buildReservationFilters(dateFilters, channelCommissionId, q, refundStatus, status),
    [channelCommissionId, dateFilters, q, refundStatus, status]
  );

  const lineFilters = useMemo(
    () => buildLineFilters(dateFilters, incomeType, q, refundStatus),
    [dateFilters, incomeType, q, refundStatus]
  );

  const incomeEntriesFilters = useMemo(
    () =>
      buildIncomeEntriesFilters({
        channelCommissionId,
        dateFilters,
        incomeType,
        q,
        refundStatus,
        sortBy: sortState.columnId as TPropertyIncomeEntriesListFilters["sortBy"],
        sortDir: sortState.direction,
        status,
      }),
    [
      channelCommissionId,
      dateFilters,
      incomeType,
      q,
      refundStatus,
      sortState.columnId,
      sortState.direction,
      status,
    ]
  );

  const isAllView = incomeType === "";
  const isStayOnlyView = incomeType === IncomeEntryKind.STAY;
  const isEntriesKindOnlyView =
    incomeType === IncomeEntryKind.LONG_TERM || incomeType === IncomeEntryKind.DEPOSIT;
  const isLineTypeOnlyView = incomeType !== "" && !isIncomeToolbarEntryKindFilter(incomeType);
  const showStays = incomeType === "" || incomeType === IncomeEntryKind.STAY;

  const incomeEntriesInfinite = usePropertyIncomeEntriesInfiniteList(
    propertyId,
    incomeEntriesFilters,
    { enabled: isAllView || isEntriesKindOnlyView }
  );
  const shortStaysInfinite = usePropertyShortStaysInfiniteList(propertyId, reservationFilters, {
    enabled: isStayOnlyView,
  });
  const incomeLinesInfinite = usePropertyIncomeLinesInfiniteList(propertyId, lineFilters, {
    enabled: isLineTypeOnlyView,
  });

  const activeIncomeListPagination = getActiveIncomeInfiniteListPagination(
    isAllView,
    isStayOnlyView,
    isEntriesKindOnlyView,
    incomeEntriesInfinite,
    shortStaysInfinite,
    incomeLinesInfinite
  );

  const scrollSentinelRef = useInfiniteScrollTrigger({
    enabled: isAllView || isStayOnlyView || isEntriesKindOnlyView || isLineTypeOnlyView,
    fetchNextPage: activeIncomeListPagination.fetchNextPage,
    hasNextPage: activeIncomeListPagination.hasNextPage,
    isFetchingNextPage: activeIncomeListPagination.isFetchingNextPage,
  });

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: queryKeys.propertyUnits(propertyId),
  });

  const settingsQuery = useQuery({
    queryFn: () => settingsApi.get(propertyId),
    queryKey: queryKeys.propertySettings(propertyId),
  });

  const units = useMemo(() => unitsQuery.data?.units ?? [], [unitsQuery.data?.units]);
  const activeUnits = useMemo(() => units.filter((unit) => !unit.isDeleted), [units]);
  const incomeLineTypes = useMemo(
    () => settingsQuery.data?.settings.incomeLineTypes ?? [],
    [settingsQuery.data?.settings.incomeLineTypes]
  );

  const incomeTypeFilterOptions = useMemo(
    () => buildIncomeTypeFilterOptions(incomeLineTypes),
    [incomeLineTypes]
  );

  const channelFilterOptions = useMemo(
    () => buildChannelOptions(settingsQuery.data?.settings.channelCommissions ?? []),
    [settingsQuery.data?.settings.channelCommissions]
  );

  const unitLabelById = useMemo(
    () => new Map((unitsQuery.data?.units ?? []).map((unit) => [unit.id, unit.unitNumber])),
    [unitsQuery.data?.units]
  );

  const unitFilterOptions = useMemo(
    () =>
      activeUnits.map((unit) => ({
        label: formatPropertyUnitSelectLabel(unit),
        value: unit.id,
      })),
    [activeUnits]
  );

  const activeSecondaryFilterCount = useMemo(
    () =>
      countIncomeSecondaryFilters({
        channelCommissionId,
        incomeType,
        refundStatus,
        status,
        unitId,
      }),
    [channelCommissionId, incomeType, refundStatus, status, unitId]
  );

  const dateSummary = getDateRangeSummary(activePreset, displayFrom, displayTo);
  const activeFilterItems = useMemo(
    () =>
      buildIncomeToolbarFilterItems({
        activePreset,
        channelCommissionId,
        channelOptions: channelFilterOptions,
        dateSummary,
        incomeType,
        incomeTypeOptions: incomeTypeFilterOptions,
        isDefaultDateRange:
          !allTime && from === defaultDateRange.from && to === defaultDateRange.to,
        refundStatus,
        refundStatusOptions: REFUND_STATUS_FILTER_OPTIONS,
        status,
        statusOptions: STATUS_OPTIONS,
        unitId,
        unitOptions: unitFilterOptions,
      }),
    [
      activePreset,
      allTime,
      channelCommissionId,
      channelFilterOptions,
      dateSummary,
      defaultDateRange.from,
      defaultDateRange.to,
      from,
      incomeType,
      incomeTypeFilterOptions,
      refundStatus,
      status,
      to,
      unitFilterOptions,
      unitId,
    ]
  );

  const handleClearSecondaryFilters = useCallback(() => {
    setFilters({
      channelCommissionId: "",
      incomeType: "",
      refundStatus: "",
      status: "",
      unitId: "",
    });
  }, [setFilters]);

  const handleRemoveToolbarFilter = useCallback(
    (id: TIncomeToolbarFilterId) => {
      setFilters(buildIncomeToolbarClearOnePatch(id, defaultDateRange));
    },
    [defaultDateRange, setFilters]
  );

  const handleClearAllToolbarFilters = useCallback(() => {
    handleSearchInputChange("");
    setFilters(buildIncomeToolbarClearAllPatch(defaultDateRange));
  }, [defaultDateRange, handleSearchInputChange, setFilters]);

  const deleteStayMutation = useMutation({
    mutationFn: (reservation: IPropertyReservation) =>
      shortStaysApi.delete(propertyId, reservation.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to delete stay");
    },
    onSuccess: () => {
      toast.success("Stay deleted");
      invalidatePropertyIncomeCaches(queryClient, propertyId);
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (line: IPropertyIncomeLine) => incomeLinesApi.delete(propertyId, line.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to delete other income");
    },
    onSuccess: () => {
      toast.success("Other income deleted");
      invalidatePropertyIncomeCaches(queryClient, propertyId);
    },
  });

  const {
    deleteConfirmationDialog: lineDeleteConfirmationDialog,
    handleDelete: handleDeleteLine,
    isQuickDeleteActive: isLineQuickDeleteActive,
  } = useQuickDelete<IPropertyIncomeLine>({
    deleteFn: (line, onDeleted) => deleteLineMutation.mutate(line, { onSuccess: onDeleted }),
    getConfirmationOptions: (line) => ({
      description: `Delete ${line.incomeLineTypeName ?? line.incomeLineTypeId} entry? It will be hidden from reports.`,
      target: line,
      title: "Delete other income",
    }),
    isPending: deleteLineMutation.isPending,
  });

  const {
    deleteConfirmationDialog: stayDeleteConfirmationDialog,
    handleDelete: handleDeleteStay,
    isQuickDeleteActive: isStayQuickDeleteActive,
  } = useQuickDelete<IPropertyReservation>({
    deleteFn: (stay, onDeleted) => deleteStayMutation.mutate(stay, { onSuccess: onDeleted }),
    getConfirmationOptions: (stay) => ({
      description: `Delete stay for ${stay.guestName}? It will be hidden from reports.`,
      target: stay,
      title: "Delete stay",
    }),
    isPending: deleteStayMutation.isPending,
  });

  const isQuickDeleteActive = isLineQuickDeleteActive || isStayQuickDeleteActive;

  const restoreStayMutation = useMutation({
    mutationFn: (reservation: IPropertyReservation) =>
      shortStaysApi.restore(propertyId, reservation.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to restore stay");
    },
    onSuccess: () => {
      toast.success("Stay restored");
      invalidatePropertyIncomeCaches(queryClient, propertyId);
    },
  });

  const restoreLineMutation = useMutation({
    mutationFn: (line: IPropertyIncomeLine) => incomeLinesApi.restore(propertyId, line.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to restore other income");
    },
    onSuccess: () => {
      toast.success("Other income restored");
      invalidatePropertyIncomeCaches(queryClient, propertyId);
    },
  });

  const refundStayMutation = useMutation({
    mutationFn: ({ amount, stay }: { amount?: number; stay: IPropertyReservation }) =>
      shortStaysApi.refund(propertyId, stay.id, amount !== undefined ? { amount } : undefined),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to refund stay");
    },
    onSuccess: (_, { amount }) => {
      toast.success(amount !== undefined ? "Stay partially refunded" : "Stay refunded");
      invalidatePropertyIncomeCaches(queryClient, propertyId);
    },
  });

  const unrefundStayMutation = useMutation({
    mutationFn: (stay: IPropertyReservation) => shortStaysApi.unrefund(propertyId, stay.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to undo stay refund");
    },
    onSuccess: () => {
      toast.success("Stay refund undone");
      invalidatePropertyIncomeCaches(queryClient, propertyId);
    },
  });

  const refundLineMutation = useMutation({
    mutationFn: ({ amount, line }: { amount?: number; line: IPropertyIncomeLine }) =>
      incomeLinesApi.refund(propertyId, line.id, amount !== undefined ? { amount } : undefined),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to refund income");
    },
    onSuccess: (_, { amount, line }) => {
      toast.success(amount !== undefined ? "Income partially refunded" : "Income refunded");
      invalidatePropertyIncomeCaches(queryClient, propertyId, { longStayId: line.longStayId });
    },
  });

  const unrefundLineMutation = useMutation({
    mutationFn: (line: IPropertyIncomeLine) => incomeLinesApi.unrefund(propertyId, line.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to undo income refund");
    },
    onSuccess: (_, line) => {
      toast.success("Income refund undone");
      invalidatePropertyIncomeCaches(queryClient, propertyId, { longStayId: line.longStayId });
    },
  });

  const isRefundStayPending = refundStayMutation.isPending || unrefundStayMutation.isPending;
  const isRefundLinePending = refundLineMutation.isPending || unrefundLineMutation.isPending;

  const deletingStayId = deleteStayMutation.isPending
    ? deleteStayMutation.variables?.id
    : undefined;
  const deletingLineId = deleteLineMutation.isPending
    ? deleteLineMutation.variables?.id
    : undefined;
  let refundingStayId: string | undefined;
  if (refundStayMutation.isPending) {
    refundingStayId = refundStayMutation.variables?.stay.id;
  } else if (unrefundStayMutation.isPending) {
    refundingStayId = unrefundStayMutation.variables?.id;
  }

  let refundingLineId: string | undefined;
  if (refundLineMutation.isPending) {
    refundingLineId = refundLineMutation.variables?.line.id;
  } else if (unrefundLineMutation.isPending) {
    refundingLineId = unrefundLineMutation.variables?.id;
  }

  const closeRefundEntry = useCallback(() => {
    setRefundEntryRequest(null);
  }, []);

  const {
    deleteConfirmationDialog: stayUnrefundConfirmationDialog,
    requestDelete: requestStayUnrefund,
  } = useDeleteConfirmation<IPropertyReservation>(isRefundStayPending, (stay, onDone) => {
    unrefundStayMutation.mutate(stay, { onSuccess: onDone });
  });

  const {
    deleteConfirmationDialog: lineUnrefundConfirmationDialog,
    requestDelete: requestLineUnrefund,
  } = useDeleteConfirmation<IPropertyIncomeLine>(isRefundLinePending, (line, onDone) => {
    unrefundLineMutation.mutate(line, { onSuccess: onDone });
  });

  const handleRefundEntryConfirm = useCallback(
    (payload: TRefundEntryConfirmPayload) => {
      if (!refundEntryRequest) {
        return;
      }

      const amount = payload.mode === "partial" ? payload.amount : undefined;

      if (refundEntryRequest.kind === "stay") {
        refundStayMutation.mutate(
          { amount, stay: refundEntryRequest.target },
          { onSuccess: closeRefundEntry }
        );
        return;
      }

      refundLineMutation.mutate(
        { amount, line: refundEntryRequest.target },
        { onSuccess: closeRefundEntry }
      );
    },
    [closeRefundEntry, refundEntryRequest, refundLineMutation, refundStayMutation]
  );

  const handleRefundStay = useCallback(
    (stay: IPropertyReservation) => {
      if (stay.refundedAt) {
        requestStayUnrefund(buildStayUnrefundConfirmationOptions(stay));
        return;
      }

      setRefundEntryRequest(buildStayRefundEntryRequest(stay));
    },
    [requestStayUnrefund]
  );

  const handleRefundLine = useCallback(
    (line: IPropertyIncomeLine) => {
      if (line.refundedAt) {
        requestLineUnrefund(buildLineUnrefundConfirmationOptions(line));
        return;
      }

      setRefundEntryRequest(buildLineRefundEntryRequest(line));
    },
    [requestLineUnrefund]
  );

  const displayEntries = useMemo(() => {
    if (isAllView || isEntriesKindOnlyView) {
      return incomeEntriesInfinite.entries;
    }

    const mappedEntries = isStayOnlyView
      ? shortStaysInfinite.shortStays.map(mapStayToEntry)
      : incomeLinesInfinite.incomeLines.map(mapLineToEntry);

    return sortIncomeEntries(mappedEntries, sortState, unitLabelById);
  }, [
    incomeEntriesInfinite.entries,
    incomeLinesInfinite.incomeLines,
    isAllView,
    isEntriesKindOnlyView,
    isStayOnlyView,
    shortStaysInfinite.shortStays,
    sortState,
    unitLabelById,
  ]);

  const { isFilterRefetching, isTableInitialPending } = getFilteredTableFetchState({
    isFetching: activeIncomeListPagination.isFetching,
    isFetchingNextPage: activeIncomeListPagination.isFetchingNextPage,
    isPending: activeIncomeListPagination.isPending,
    itemCount: displayEntries.length,
  });
  const listMeta = activeIncomeListPagination.meta;
  const hasNextPage = Boolean(activeIncomeListPagination.hasNextPage);
  const isFetchingNextPage = activeIncomeListPagination.isFetchingNextPage;

  const handleOpenExportTable = useCallback(() => {
    setExportTableOpen(true);
  }, []);

  const exportFilterSummaryOptions = useMemo(
    () => buildExportFilterSummaryOptions(settingsQuery.data?.settings, units),
    [settingsQuery.data?.settings, units]
  );

  const incomeExportFilterSummary = useMemo(
    () =>
      formatPropertyTableExportFilterSummary(
        { filters: incomeEntriesFilters, resourceType: ExportResourceType.INCOME },
        exportFilterSummaryOptions
      ),
    [exportFilterSummaryOptions, incomeEntriesFilters]
  );

  const countLabel = listMeta ? `${listMeta.totalCount} entries` : undefined;

  return (
    <PropertyIncomeCreateLineProvider
      incomeLineTypes={incomeLineTypes}
      propertyId={propertyId}
      units={activeUnits}
    >
      <PropertyIncomeShellActions
        canManage={canManage}
        onExportTable={handleOpenExportTable}
        propertyId={propertyId}
      />

      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <PropertyIncomeEntriesTable
            activeFilterCount={activeSecondaryFilterCount}
            activeFilterItems={activeFilterItems}
            activePreset={activePreset}
            canManage={canManage}
            channelCommissionId={channelCommissionId}
            channelFilterOptions={channelFilterOptions}
            countLabel={countLabel}
            deletingLineId={deletingLineId}
            deletingStayId={deletingStayId}
            displayFrom={displayFrom}
            displayTo={displayTo}
            entries={displayEntries}
            hasNextPage={hasNextPage}
            incomeLineTypes={incomeLineTypes}
            incomeType={incomeType}
            incomeTypeFilterOptions={incomeTypeFilterOptions}
            isFetchingNextPage={isFetchingNextPage}
            isLoading={isTableInitialPending}
            isQuickDeleteActive={isQuickDeleteActive}
            isRefreshing={isFilterRefetching}
            onClearAllToolbarFilters={handleClearAllToolbarFilters}
            onClearSecondaryFilters={handleClearSecondaryFilters}
            onDeleteLine={handleDeleteLine}
            onDeleteStay={handleDeleteStay}
            onFilterChange={handleIncomeFilterChange}
            onFromChange={onFromChange}
            onPresetChange={onPresetChange}
            onRefundLine={handleRefundLine}
            onRefundStay={handleRefundStay}
            onRemoveToolbarFilter={handleRemoveToolbarFilter}
            onRestoreLine={(line) => restoreLineMutation.mutate(line)}
            onRestoreStay={(stay) => restoreStayMutation.mutate(stay)}
            onSearchInputChange={handleSearchInputChange}
            onShowCalculationDetails={(stay, metric) => setCalculationDetails({ metric, stay })}
            onToChange={onToChange}
            propertyId={propertyId}
            refundStatus={refundStatus}
            refundStatusFilterOptions={REFUND_STATUS_FILTER_OPTIONS}
            refundingLineId={refundingLineId}
            refundingStayId={refundingStayId}
            scrollSentinelRef={scrollSentinelRef}
            searchInput={searchInput}
            showStays={showStays}
            sort={sortController}
            status={status}
            statusOptions={STATUS_OPTIONS}
            unitId={unitId}
            unitLabelById={unitLabelById}
            units={activeUnits}
          />
        </CardContent>
      </Card>

      <StayCalculationDetailsDialog
        metric={calculationDetails?.metric ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setCalculationDetails(null);
          }
        }}
        open={calculationDetails !== null}
        stay={calculationDetails?.stay ?? null}
      />

      {lineDeleteConfirmationDialog}
      {stayDeleteConfirmationDialog}
      {lineUnrefundConfirmationDialog}
      {stayUnrefundConfirmationDialog}

      <RefundEntryDialog
        cap={refundEntryRequest?.cap ?? 0}
        confirmLabel={isDepositLineRefundRequest(refundEntryRequest) ? "Refund deposit" : undefined}
        description={refundEntryRequest?.description ?? ""}
        fullOptionLabel={
          isDepositLineRefundRequest(refundEntryRequest)
            ? "Full refund (return entire remaining amount)"
            : undefined
        }
        isPending={isRefundEntryPending(
          refundEntryRequest,
          isRefundStayPending,
          isRefundLinePending
        )}
        onConfirm={handleRefundEntryConfirm}
        onOpenChange={(open) => {
          if (!open && !isRefundStayPending && !isRefundLinePending) {
            closeRefundEntry();
          }
        }}
        open={refundEntryRequest !== null}
        partialOptionLabel={
          isDepositLineRefundRequest(refundEntryRequest)
            ? "Partial refund (return some; remainder withheld)"
            : undefined
        }
        title={refundEntryRequest?.title ?? ""}
      />

      <PropertyTableExportDialog
        config={{ filters: incomeEntriesFilters, resourceType: ExportResourceType.INCOME }}
        filterSummary={incomeExportFilterSummary}
        matchedRowCount={listMeta?.totalCount}
        onOpenChange={setExportTableOpen}
        open={exportTableOpen}
        propertyId={propertyId}
      />
    </PropertyIncomeCreateLineProvider>
  );
});
PropertyIncomePage.displayName = "PropertyIncomePage";

export { PropertyIncomePage };
