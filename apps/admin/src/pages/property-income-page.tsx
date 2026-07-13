import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Pencil, Plus } from "lucide-react";
import { memo, type MouseEvent, type ReactNode, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ImportCsvButton } from "@/components/csv-import/import-csv-button";
import { DataTable } from "@/components/data-table/data-table";
import {
  type DataTableColumn,
  type DataTableSortController,
} from "@/components/data-table/data-table-types";
import {
  DeletedBadge,
  RefundedBadge,
  RefundEntityButton,
  RestoreEntityButton,
} from "@/components/deleted-badge";
import { DateFilterField } from "@/components/filters/date-filter-field";
import { FilterSelectField } from "@/components/filters/filter-select-field";
import { LedgerFilterGrid } from "@/components/filters/ledger-filter-grid";
import { LedgerFiltersSection } from "@/components/filters/ledger-filters-section";
import {
  CreateIncomeLineDialog,
  type CreateIncomeLineDialogPrefill,
} from "@/components/income/create-income-line-dialog";
import { CreateReservationDialog } from "@/components/income/create-reservation-dialog";
import { EditIncomeLineDialog } from "@/components/income/edit-income-line-dialog";
import { EditReservationDialog } from "@/components/income/edit-reservation-dialog";
import { ImportIncomeCsvDialog } from "@/components/income/import-income-csv-dialog";
import { IncomeEntryTypeBadge } from "@/components/income/income-entry-type-badge";
import { buildIncomeTypeFilterOptions } from "@/components/income/income-line-form-options";
import { ReservationChannelBadge } from "@/components/income/reservation-channel-badge";
import { buildChannelOptions, STATUS_OPTIONS } from "@/components/income/reservation-form-options";
import { ReservationStatusBadge } from "@/components/income/reservation-status-badge";
import { StayCalculationDetailsDialog } from "@/components/income/stay-calculation-details-dialog";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { TableIconButton } from "@/components/table/table-icon-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import {
  type TDeleteConfirmationOptions,
  useDeleteConfirmation,
} from "@/hooks/use-delete-confirmation";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useQuickDelete } from "@/hooks/use-quick-delete";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { incomeLinesApi, reservationsApi, settingsApi, unitsApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import {
  getEntryUnitId,
  resolveIncomeUnitLabel,
  sortIncomeEntries,
  type TIncomeEntrySortColumnId,
} from "@/lib/income-entry-sort";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { ledgerEntryRowClassName } from "@/lib/ledger-entry-row-styles";
import { adminQueryKeys } from "@/lib/query-keys";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  getStayAverageDailyRate,
  getStayNetPayout,
  getStayTaxesTotal,
  IncomeEntryKind,
  type IPropertyIncomeLine,
  type IPropertyIncomeLinesListQuery,
  type IPropertyIncomeLineType,
  type IPropertyReservation,
  type IPropertyReservationsListQuery,
  type IPropertyUnit,
  resolveDefaultIncomeLineTypeId,
  type TPropertyIncomeEntry,
  type TStayCalculationMetric,
} from "@/packages/shared";

function buildMergedEntries(
  reservations: IPropertyReservation[],
  incomeLines: IPropertyIncomeLine[],
  incomeTypeFilter: string
): TPropertyIncomeEntry[] {
  const entries: TPropertyIncomeEntry[] = [];
  const showStays = incomeTypeFilter === "" || incomeTypeFilter === IncomeEntryKind.STAY;
  const showLines = incomeTypeFilter === "" || incomeTypeFilter !== IncomeEntryKind.STAY;

  if (showStays) {
    for (const stay of reservations) {
      entries.push({ entryKind: IncomeEntryKind.STAY, stay });
    }
  }

  if (showLines) {
    for (const line of incomeLines) {
      if (incomeTypeFilter === "" || line.incomeLineTypeId === incomeTypeFilter) {
        entries.push({ entryKind: IncomeEntryKind.LINE, line });
      }
    }
  }

  return entries;
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

const INCOME_URL_FILTER_SCHEMA = defineUrlFilterSchema<{
  channelCommissionId: string;
  from: string;
  incomeType: string;
  status: string;
  to: string;
  unitId: string;
}>({
  channelCommissionId: { defaultValue: "" },
  from: { defaultValue: "" },
  incomeType: { defaultValue: "" },
  status: { defaultValue: "" },
  to: { defaultValue: "" },
  unitId: { defaultValue: "" },
});

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
  status: string
): IPropertyReservationsListQuery {
  const next: IPropertyReservationsListQuery = { ...dateFilters };
  if (channelCommissionId) next.channelCommissionId = channelCommissionId;
  if (status) next.status = status as IPropertyReservationsListQuery["status"];
  return next;
}

function buildLineFilters(
  dateFilters: ReturnType<typeof buildDateFilters>,
  incomeType: string
): IPropertyIncomeLinesListQuery {
  const next: IPropertyIncomeLinesListQuery = { ...dateFilters };
  if (incomeType && incomeType !== IncomeEntryKind.STAY) {
    next.incomeLineTypeId = incomeType;
  }
  return next;
}

function getIncomeEntryKey(entry: TPropertyIncomeEntry): string {
  return entry.entryKind === IncomeEntryKind.STAY
    ? `stay-${entry.stay.id}`
    : `line-${entry.line.id}`;
}

function buildStayRefundConfirmationOptions(
  stay: IPropertyReservation
): TDeleteConfirmationOptions<IPropertyReservation> {
  if (stay.refundedAt) {
    return {
      confirmLabel: "Undo refund",
      description: `Restore ${stay.guestName}'s stay to financial reports?`,
      target: stay,
      title: "Undo stay refund",
    };
  }

  return {
    confirmLabel: "Refund",
    description: `Refund stay for ${stay.guestName}? It will be excluded from reports but remain visible here.`,
    target: stay,
    title: "Refund stay",
  };
}

function buildLineRefundConfirmationOptions(
  line: IPropertyIncomeLine
): TDeleteConfirmationOptions<IPropertyIncomeLine> {
  const label = line.incomeLineTypeName ?? line.incomeLineTypeId;

  if (line.refundedAt) {
    return {
      confirmLabel: "Undo refund",
      description: `Restore this ${label} entry to financial reports?`,
      target: line,
      title: "Undo income refund",
    };
  }

  return {
    confirmLabel: "Refund",
    description: `Refund this ${label} entry? It will be excluded from reports but remain visible here.`,
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
    transactionDate: stay.checkOut,
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

function handleCreateIncomeLineOpenChange(
  open: boolean,
  setCreateLineOpen: (open: boolean) => void,
  resetCreateLineState: () => void
): void {
  setCreateLineOpen(open);
  if (!open) {
    resetCreateLineState();
  }
}

type TIncomeFilterKey = "channelCommissionId" | "from" | "incomeType" | "status" | "to" | "unitId";

const PropertyIncomeFilters = memo(
  ({
    channelCommissionId,
    channelFilterOptions,
    from,
    incomeType,
    incomeTypeFilterOptions,
    onFilterChange,
    showStays,
    status,
    to,
    unitId,
    units,
  }: {
    channelCommissionId: string;
    channelFilterOptions: { label: string; value: string }[];
    from: string;
    incomeType: string;
    incomeTypeFilterOptions: { label: string; value: string }[];
    onFilterChange: (key: TIncomeFilterKey, value: string) => void;
    showStays: boolean;
    status: string;
    to: string;
    unitId: string;
    units: IPropertyUnit[];
  }) => (
    <LedgerFiltersSection>
      <LedgerFilterGrid filterCount={6}>
        <DateFilterField
          id="filter-from"
          label="From"
          onChange={(e) => onFilterChange("from", e.target.value)}
          value={from}
        />
        <DateFilterField
          id="filter-to"
          label="To"
          onChange={(e) => onFilterChange("to", e.target.value)}
          value={to}
        />
        <FilterSelectField
          id="filter-unit"
          label="Unit"
          onChange={(e) => onFilterChange("unitId", e.target.value)}
          value={unitId}
        >
          <PropertyUnitSelectOptions emptyOptionLabel="All units" units={units} />
        </FilterSelectField>
        <FilterSelectField
          id="filter-income-type"
          label="Income type"
          onChange={(e) => onFilterChange("incomeType", e.target.value)}
          options={incomeTypeFilterOptions}
          value={incomeType}
        />
        <FilterSelectField
          disabled={!showStays}
          emptyOptionLabel="All channels"
          id="filter-channel"
          label="Channel"
          onChange={(e) => onFilterChange("channelCommissionId", e.target.value)}
          options={channelFilterOptions}
          value={channelCommissionId}
        />
        <FilterSelectField
          disabled={!showStays}
          emptyOptionLabel="All statuses"
          id="filter-status"
          label="Status"
          onChange={(e) => onFilterChange("status", e.target.value)}
          options={STATUS_OPTIONS}
          value={status}
        />
      </LedgerFilterGrid>
    </LedgerFiltersSection>
  )
);
PropertyIncomeFilters.displayName = "PropertyIncomeFilters";

const PropertyIncomeEntriesTable = memo(
  ({
    canManage,
    entries,
    filters,
    isDeleteLinePending,
    isDeleteStayPending,
    isLoading,
    isQuickDeleteActive,
    isRefundLinePending,
    isRefundStayPending,
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
    sort,
    unitLabelById,
  }: {
    canManage: boolean;
    entries: TPropertyIncomeEntry[];
    filters: ReactNode;
    isDeleteLinePending: boolean;
    isDeleteStayPending: boolean;
    isLoading: boolean;
    isQuickDeleteActive: boolean;
    isRefundLinePending: boolean;
    isRefundStayPending: boolean;
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
    sort: DataTableSortController;
    unitLabelById: Map<string, string>;
  }) => {
    const renderIncomeEntryRow = useCallback(
      (entry: TPropertyIncomeEntry) => (
        <IncomeEntryRow
          canManage={canManage}
          entry={entry}
          isDeleteLinePending={isDeleteLinePending}
          isDeleteStayPending={isDeleteStayPending}
          isQuickDeleteActive={isQuickDeleteActive}
          isRefundLinePending={isRefundLinePending}
          isRefundStayPending={isRefundStayPending}
          key={getIncomeEntryKey(entry)}
          onAddOtherIncomeFromStay={onAddOtherIncomeFromStay}
          onDeleteLine={onDeleteLine}
          onDeleteStay={onDeleteStay}
          onEditLine={onEditLine}
          onEditStay={onEditStay}
          onRefundLine={onRefundLine}
          onRefundStay={onRefundStay}
          onRestoreLine={onRestoreLine}
          onRestoreStay={onRestoreStay}
          onShowCalculationDetails={onShowCalculationDetails}
          unitLabel={resolveIncomeUnitLabel(getEntryUnitId(entry), unitLabelById)}
        />
      ),
      [
        canManage,
        isDeleteLinePending,
        isDeleteStayPending,
        isQuickDeleteActive,
        isRefundLinePending,
        isRefundStayPending,
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
        unitLabelById,
      ]
    );

    const columns = useMemo(() => getIncomeColumns(canManage), [canManage]);

    return (
      <DataTable
        columns={columns}
        emptyMessage={`No income entries yet.${canManage ? " Add a stay or other income to get started." : ""}`}
        filters={filters}
        getItemKey={getIncomeEntryKey}
        isPending={isLoading}
        items={entries}
        renderRow={renderIncomeEntryRow}
        sort={sort}
        virtualization={{ estimateRowHeight: INCOME_ROW_ESTIMATED_HEIGHT }}
      />
    );
  }
);
PropertyIncomeEntriesTable.displayName = "PropertyIncomeEntriesTable";

const PropertyIncomePageDialogs = memo(
  ({
    createLineLockedStay,
    createLineOpen,
    createLinePrefill,
    createStayOpen,
    editIncomeLine,
    editReservation,
    importCsvOpen,
    incomeLineTypes,
    onCreateIncomeLineOpenChange,
    onCreateStayOpenChange,
    onEditIncomeLineOpenChange,
    onEditReservationOpenChange,
    onImportCsvOpenChange,
    propertyId,
    units,
  }: {
    createLineLockedStay: IPropertyReservation | null;
    createLineOpen: boolean;
    createLinePrefill: CreateIncomeLineDialogPrefill | null;
    createStayOpen: boolean;
    editIncomeLine: IPropertyIncomeLine | null;
    editReservation: IPropertyReservation | null;
    importCsvOpen: boolean;
    incomeLineTypes: IPropertyIncomeLineType[];
    onCreateIncomeLineOpenChange: (open: boolean) => void;
    onCreateStayOpenChange: (open: boolean) => void;
    onEditIncomeLineOpenChange: (open: boolean) => void;
    onEditReservationOpenChange: (open: boolean) => void;
    onImportCsvOpenChange: (open: boolean) => void;
    propertyId: string;
    units: IPropertyUnit[];
  }) => (
    <>
      <CreateReservationDialog
        onOpenChange={onCreateStayOpenChange}
        open={createStayOpen}
        propertyId={propertyId}
      />
      <CreateIncomeLineDialog
        incomeLineTypes={incomeLineTypes}
        lockedStay={createLineLockedStay}
        onOpenChange={onCreateIncomeLineOpenChange}
        open={createLineOpen}
        prefill={createLinePrefill}
        propertyId={propertyId}
        units={units}
      />
      <ImportIncomeCsvDialog
        onOpenChange={onImportCsvOpenChange}
        open={importCsvOpen}
        propertyId={propertyId}
      />
      {editReservation ? (
        <EditReservationDialog
          key={editReservation.id}
          onOpenChange={onEditReservationOpenChange}
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
          onOpenChange={onEditIncomeLineOpenChange}
          open={true}
          propertyId={propertyId}
          units={units}
        />
      ) : null}
    </>
  )
);
PropertyIncomePageDialogs.displayName = "PropertyIncomePageDialogs";

function handleEditDialogOpenChange(open: boolean, clearSelection: () => void): void {
  if (!open) {
    clearSelection();
  }
}

const PropertyIncomePageActions = memo(
  ({
    onAddOtherIncome,
    onAddStay,
    onImportCsv,
  }: {
    onAddOtherIncome: () => void;
    onAddStay: () => void;
    onImportCsv: () => void;
  }) => (
    <div className="flex items-center gap-2">
      <ImportCsvButton onClick={onImportCsv} />
      <Button className="gap-1.5" onClick={onAddStay} size="sm" type="button" variant="outline">
        <Plus className="size-3.5" />
        Add Short Stay
      </Button>
      <Button className="gap-1.5" onClick={onAddOtherIncome} size="sm" type="button">
        <Plus className="size-3.5" />
        Add Other Income
      </Button>
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
  isDeletePending: boolean;
  isQuickDeleteActive: boolean;
  isRefundPending: boolean;
  onAddOtherIncomeFromStay: (stay: IPropertyReservation) => void;
  onDeleteStay: (stay: IPropertyReservation, event?: MouseEvent<HTMLButtonElement>) => void;
  onEditStay: (stay: IPropertyReservation) => void;
  onRefundStay: (stay: IPropertyReservation) => void;
  onRestoreStay: (stay: IPropertyReservation) => void;
  onShowCalculationDetails: (stay: IPropertyReservation, metric: TStayCalculationMetric) => void;
  stay: IPropertyReservation;
  unitLabel: string;
};

const IncomeStayEntryRow = memo(
  ({
    canManage,
    isDeletePending,
    isQuickDeleteActive,
    isRefundPending,
    onAddOtherIncomeFromStay,
    onDeleteStay,
    onEditStay,
    onRefundStay,
    onRestoreStay,
    onShowCalculationDetails,
    stay,
    unitLabel,
  }: IncomeStayEntryRowProps) => {
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
            {!stay.isDeleted && isRefunded ? <RefundedBadge /> : null}
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
  isDeletePending: boolean;
  isQuickDeleteActive: boolean;
  isRefundPending: boolean;
  line: IPropertyIncomeLine;
  onDeleteLine: (line: IPropertyIncomeLine, event?: MouseEvent<HTMLButtonElement>) => void;
  onEditLine: (line: IPropertyIncomeLine) => void;
  onRefundLine: (line: IPropertyIncomeLine) => void;
  onRestoreLine: (line: IPropertyIncomeLine) => void;
  unitLabel: string;
};

const IncomeLineEntryRow = memo(
  ({
    canManage,
    isDeletePending,
    isQuickDeleteActive,
    isRefundPending,
    line,
    onDeleteLine,
    onEditLine,
    onRefundLine,
    onRestoreLine,
    unitLabel,
  }: IncomeLineEntryRowProps) => {
    const isRefunded = line.refundedAt !== null;

    return (
      <TableRow className={ledgerEntryRowClassName(line.isDeleted, line.refundedAt)}>
        <TableCell>
          <div className="flex items-center gap-2">
            <IncomeEntryTypeBadge
              entryKind={IncomeEntryKind.LINE}
              incomeLineTypeId={line.incomeLineTypeId}
              label={line.incomeLineTypeName ?? line.incomeLineTypeId}
            />
            {line.isDeleted ? <DeletedBadge /> : null}
            {!line.isDeleted && isRefunded ? <RefundedBadge /> : null}
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
    entry,
    isDeleteLinePending,
    isDeleteStayPending,
    isQuickDeleteActive,
    isRefundLinePending,
    isRefundStayPending,
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
    unitLabel,
  }: {
    canManage: boolean;
    entry: TPropertyIncomeEntry;
    isDeleteLinePending: boolean;
    isDeleteStayPending: boolean;
    isQuickDeleteActive: boolean;
    isRefundLinePending: boolean;
    isRefundStayPending: boolean;
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
    unitLabel: string;
  }) => {
    if (entry.entryKind === IncomeEntryKind.STAY) {
      return (
        <IncomeStayEntryRow
          canManage={canManage}
          isDeletePending={isDeleteStayPending}
          isQuickDeleteActive={isQuickDeleteActive}
          isRefundPending={isRefundStayPending}
          onAddOtherIncomeFromStay={onAddOtherIncomeFromStay}
          onDeleteStay={onDeleteStay}
          onEditStay={onEditStay}
          onRefundStay={onRefundStay}
          onRestoreStay={onRestoreStay}
          onShowCalculationDetails={onShowCalculationDetails}
          stay={entry.stay}
          unitLabel={unitLabel}
        />
      );
    }

    return (
      <IncomeLineEntryRow
        canManage={canManage}
        isDeletePending={isDeleteLinePending}
        isQuickDeleteActive={isQuickDeleteActive}
        isRefundPending={isRefundLinePending}
        line={entry.line}
        onDeleteLine={onDeleteLine}
        onEditLine={onEditLine}
        onRefundLine={onRefundLine}
        onRestoreLine={onRestoreLine}
        unitLabel={unitLabel}
      />
    );
  }
);
IncomeEntryRow.displayName = "IncomeEntryRow";

function useRegisterIncomePageActions(
  canManage: boolean,
  onAddOtherIncome: () => void,
  onAddStay: () => void,
  onImportCsv: () => void
) {
  const pageActions = useMemo(
    () =>
      canManage ? (
        <PropertyIncomePageActions
          onAddOtherIncome={onAddOtherIncome}
          onAddStay={onAddStay}
          onImportCsv={onImportCsv}
        />
      ) : null,
    [canManage, onAddOtherIncome, onAddStay, onImportCsv]
  );

  usePropertyShellActions(pageActions);
}

const PropertyIncomePage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;
  const queryClient = useQueryClient();
  const [createStayOpen, setCreateStayOpen] = useState(false);
  const [importCsvOpen, setImportCsvOpen] = useState(false);
  const [createLineOpen, setCreateLineOpen] = useState(false);
  const [createLinePrefill, setCreateLinePrefill] = useState<CreateIncomeLineDialogPrefill | null>(
    null
  );
  const [createLineLockedStay, setCreateLineLockedStay] = useState<IPropertyReservation | null>(
    null
  );
  const [editReservation, setEditReservation] = useState<IPropertyReservation | null>(null);
  const [editIncomeLine, setEditIncomeLine] = useState<IPropertyIncomeLine | null>(null);
  const [calculationDetails, setCalculationDetails] = useState<{
    metric: TStayCalculationMetric;
    stay: IPropertyReservation;
  } | null>(null);
  const { filters, setFilter } = useUrlFilterState(INCOME_URL_FILTER_SCHEMA);
  const { channelCommissionId, from, incomeType, status, to, unitId } = filters;
  const sortController = useUrlTableSort({
    defaultColumnId: "date",
    defaultDirection: "desc",
  });
  const { sortState } = sortController;

  const dateFilters = useMemo(() => buildDateFilters(from, to, unitId), [from, to, unitId]);

  const reservationFilters = useMemo(
    () => buildReservationFilters(dateFilters, channelCommissionId, status),
    [channelCommissionId, dateFilters, status]
  );

  const lineFilters = useMemo(
    () => buildLineFilters(dateFilters, incomeType),
    [dateFilters, incomeType]
  );

  const reservationsQuery = useQuery({
    enabled: incomeType === "" || incomeType === IncomeEntryKind.STAY,
    queryFn: () => reservationsApi.list(propertyId, reservationFilters),
    queryKey: adminQueryKeys.propertyReservations(propertyId, reservationFilters),
  });

  const incomeLinesQuery = useQuery({
    enabled: incomeType === "" || incomeType !== IncomeEntryKind.STAY,
    queryFn: () => incomeLinesApi.list(propertyId, lineFilters),
    queryKey: adminQueryKeys.propertyIncomeLines(propertyId, lineFilters),
  });

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: adminQueryKeys.propertyUnits(propertyId),
  });

  const settingsQuery = useQuery({
    queryFn: () => settingsApi.get(propertyId),
    queryKey: adminQueryKeys.propertySettings(propertyId),
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

  const deleteStayMutation = useMutation({
    mutationFn: (reservation: IPropertyReservation) =>
      reservationsApi.delete(propertyId, reservation.id),
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
      reservationsApi.restore(propertyId, reservation.id),
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
    mutationFn: (stay: IPropertyReservation) => reservationsApi.refund(propertyId, stay.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to refund stay");
    },
    onSuccess: () => {
      toast.success("Stay refunded");
      invalidatePropertyIncomeCaches(queryClient, propertyId);
    },
  });

  const unrefundStayMutation = useMutation({
    mutationFn: (stay: IPropertyReservation) => reservationsApi.unrefund(propertyId, stay.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to undo stay refund");
    },
    onSuccess: () => {
      toast.success("Stay refund undone");
      invalidatePropertyIncomeCaches(queryClient, propertyId);
    },
  });

  const refundLineMutation = useMutation({
    mutationFn: (line: IPropertyIncomeLine) => incomeLinesApi.refund(propertyId, line.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to refund income");
    },
    onSuccess: (_, line) => {
      toast.success("Income refunded");
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

  const {
    deleteConfirmationDialog: stayRefundConfirmationDialog,
    requestDelete: requestStayRefund,
  } = useDeleteConfirmation<IPropertyReservation>(isRefundStayPending, (stay, onDone) => {
    if (stay.refundedAt) {
      unrefundStayMutation.mutate(stay, { onSuccess: onDone });
      return;
    }
    refundStayMutation.mutate(stay, { onSuccess: onDone });
  });

  const {
    deleteConfirmationDialog: lineRefundConfirmationDialog,
    requestDelete: requestLineRefund,
  } = useDeleteConfirmation<IPropertyIncomeLine>(isRefundLinePending, (line, onDone) => {
    if (line.refundedAt) {
      unrefundLineMutation.mutate(line, { onSuccess: onDone });
      return;
    }
    refundLineMutation.mutate(line, { onSuccess: onDone });
  });

  const handleRefundStay = useCallback(
    (stay: IPropertyReservation) => {
      requestStayRefund(buildStayRefundConfirmationOptions(stay));
    },
    [requestStayRefund]
  );

  const handleRefundLine = useCallback(
    (line: IPropertyIncomeLine) => {
      requestLineRefund(buildLineRefundConfirmationOptions(line));
    },
    [requestLineRefund]
  );

  const entries = useMemo(
    () =>
      buildMergedEntries(
        reservationsQuery.data?.reservations ?? [],
        incomeLinesQuery.data?.incomeLines ?? [],
        incomeType
      ),
    [incomeLinesQuery.data?.incomeLines, incomeType, reservationsQuery.data?.reservations]
  );

  const sortedEntries = useMemo(
    () => sortIncomeEntries(entries, sortState, unitLabelById),
    [entries, sortState, unitLabelById]
  );

  const showStays = incomeType === "" || incomeType === IncomeEntryKind.STAY;
  const showLines = incomeType === "" || incomeType !== IncomeEntryKind.STAY;
  const isLoading =
    (showStays && reservationsQuery.isPending) || (showLines && incomeLinesQuery.isPending);

  const handleAddOtherIncome = useCallback(() => {
    setCreateLinePrefill(null);
    setCreateLineLockedStay(null);
    setCreateLineOpen(true);
  }, []);

  const handleAddStay = useCallback(() => {
    setCreateStayOpen(true);
  }, []);

  const handleOpenImportCsv = useCallback(() => {
    setImportCsvOpen(true);
  }, []);

  useRegisterIncomePageActions(canManage, handleAddOtherIncome, handleAddStay, handleOpenImportCsv);

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-0">
          <PropertyIncomeEntriesTable
            canManage={canManage}
            entries={sortedEntries}
            filters={
              <PropertyIncomeFilters
                channelCommissionId={channelCommissionId}
                channelFilterOptions={channelFilterOptions}
                from={from}
                incomeType={incomeType}
                incomeTypeFilterOptions={incomeTypeFilterOptions}
                onFilterChange={setFilter}
                showStays={showStays}
                status={status}
                to={to}
                unitId={unitId}
                units={units}
              />
            }
            isDeleteLinePending={deleteLineMutation.isPending}
            isDeleteStayPending={deleteStayMutation.isPending}
            isLoading={isLoading}
            isQuickDeleteActive={isQuickDeleteActive}
            isRefundLinePending={isRefundLinePending}
            isRefundStayPending={isRefundStayPending}
            onAddOtherIncomeFromStay={(stay) =>
              openOtherIncomeFromStay(stay, incomeLineTypes, {
                setCreateLineLockedStay,
                setCreateLineOpen,
                setCreateLinePrefill,
              })
            }
            onDeleteLine={handleDeleteLine}
            onDeleteStay={handleDeleteStay}
            onEditLine={setEditIncomeLine}
            onEditStay={setEditReservation}
            onRefundLine={handleRefundLine}
            onRefundStay={handleRefundStay}
            onRestoreLine={(line) => restoreLineMutation.mutate(line)}
            onRestoreStay={(stay) => restoreStayMutation.mutate(stay)}
            onShowCalculationDetails={(stay, metric) => setCalculationDetails({ metric, stay })}
            sort={sortController}
            unitLabelById={unitLabelById}
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
      {lineRefundConfirmationDialog}
      {stayRefundConfirmationDialog}

      <PropertyIncomePageDialogs
        createLineLockedStay={createLineLockedStay}
        createLineOpen={createLineOpen}
        createLinePrefill={createLinePrefill}
        createStayOpen={createStayOpen}
        editIncomeLine={editIncomeLine}
        editReservation={editReservation}
        importCsvOpen={importCsvOpen}
        incomeLineTypes={incomeLineTypes}
        onCreateIncomeLineOpenChange={(open) =>
          handleCreateIncomeLineOpenChange(open, setCreateLineOpen, () => {
            setCreateLinePrefill(null);
            setCreateLineLockedStay(null);
          })
        }
        onCreateStayOpenChange={setCreateStayOpen}
        onEditIncomeLineOpenChange={(open) =>
          handleEditDialogOpenChange(open, () => setEditIncomeLine(null))
        }
        onEditReservationOpenChange={(open) =>
          handleEditDialogOpenChange(open, () => setEditReservation(null))
        }
        onImportCsvOpenChange={setImportCsvOpen}
        propertyId={propertyId}
        units={activeUnits}
      />
    </>
  );
});
PropertyIncomePage.displayName = "PropertyIncomePage";

export { PropertyIncomePage };
