import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Pencil, Plus } from "lucide-react";
import { memo, type MouseEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { DeletedBadge, deletedRowClassName, RestoreEntityButton } from "@/components/deleted-badge";
import { DateFilterField } from "@/components/filters/date-filter-field";
import { FilterSelectField } from "@/components/filters/filter-select-field";
import {
  CreateIncomeLineDialog,
  type CreateIncomeLineDialogPrefill,
} from "@/components/income/create-income-line-dialog";
import { CreateReservationDialog } from "@/components/income/create-reservation-dialog";
import { EditIncomeLineDialog } from "@/components/income/edit-income-line-dialog";
import { EditReservationDialog } from "@/components/income/edit-reservation-dialog";
import { IncomeEntryTypeBadge } from "@/components/income/income-entry-type-badge";
import {
  buildIncomeTypeFilterOptions,
} from "@/components/income/income-line-form-options";
import { ReservationChannelBadge } from "@/components/income/reservation-channel-badge";
import {
  CHANNEL_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/income/reservation-form-options";
import { ReservationStatusBadge } from "@/components/income/reservation-status-badge";
import { StayCalculationDetailsDialog } from "@/components/income/stay-calculation-details-dialog";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
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
import { getLedgerFiltersGridClass } from "@/lib/ledger-filter-grid";
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

const INCOME_TABLE_COLUMNS: {
  align?: "left" | "right";
  id: TIncomeEntrySortColumnId;
  info?: string;
  label: string;
  sortable?: boolean;
}[] = [
  { id: "type", label: "Type" },
  { id: "unit", label: "Unit" },
  { id: "guest", label: "Guest" },
  { id: "date", label: "Date / Check-in" },
  { id: "checkOut", label: "Check-out" },
  { id: "nights", label: "Nights" },
  { id: "channel", label: "Channel" },
  { id: "status", label: "Status" },
  { align: "right", id: "roomTotal", label: "Room total" },
  { align: "right", id: "cleaning", label: "Cleaning" },
  {
    align: "right",
    id: "taxes",
    info: "Applicable taxes on the room + cleaning subtotal.",
    label: "Taxes",
  },
  {
    align: "right",
    id: "commission",
    info: "Channel commission. Expedia applies the rate to room total only (cleaning fee excluded).",
    label: "Commission",
  },
  {
    align: "right",
    id: "gross",
    info: "Total billed for the stay, including taxes.",
    label: "Gross",
  },
  {
    align: "right",
    id: "netPayout",
    info: "What you keep after the booking channel's commission.",
    label: "Net Payout",
  },
];

const INCOME_URL_FILTER_SCHEMA = defineUrlFilterSchema<{
  channel: string;
  from: string;
  incomeType: string;
  status: string;
  to: string;
  unitId: string;
}>({
  channel: { defaultValue: "" },
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
  channel: string,
  status: string
): IPropertyReservationsListQuery {
  const next: IPropertyReservationsListQuery = { ...dateFilters };
  if (channel) next.channel = channel as IPropertyReservationsListQuery["channel"];
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

const PropertyIncomeEntriesTable = memo(
  ({
    canManage,
    entries,
    getColumnAriaSort,
    getColumnDirection,
    isDeleteLinePending,
    isDeleteStayPending,
    isLoading,
    isQuickDeleteActive,
    onAddOtherIncomeFromStay,
    onDeleteLine,
    onDeleteStay,
    onEditLine,
    onEditStay,
    onRestoreLine,
    onRestoreStay,
    onShowCalculationDetails,
    onSortColumn,
    unitLabelById,
  }: {
    canManage: boolean;
    entries: TPropertyIncomeEntry[];
    getColumnAriaSort: (columnId: string) => "ascending" | "descending" | "none";
    getColumnDirection: (columnId: string) => "asc" | "desc" | null;
    isDeleteLinePending: boolean;
    isDeleteStayPending: boolean;
    isLoading: boolean;
    isQuickDeleteActive: boolean;
    onAddOtherIncomeFromStay: (stay: IPropertyReservation) => void;
    onDeleteLine: (line: IPropertyIncomeLine, event?: MouseEvent<HTMLButtonElement>) => void;
    onDeleteStay: (stay: IPropertyReservation, event?: MouseEvent<HTMLButtonElement>) => void;
    onEditLine: (line: IPropertyIncomeLine) => void;
    onEditStay: (stay: IPropertyReservation) => void;
    onRestoreLine: (line: IPropertyIncomeLine) => void;
    onRestoreStay: (stay: IPropertyReservation) => void;
    onShowCalculationDetails: (stay: IPropertyReservation, metric: TStayCalculationMetric) => void;
    onSortColumn: (columnId: string) => void;
    unitLabelById: Map<string, string>;
  }) => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {INCOME_TABLE_COLUMNS.map((column) => (
                <SortableTableHead
                  align={column.align}
                  ariaSort={getColumnAriaSort(column.id)}
                  direction={getColumnDirection(column.id)}
                  info={column.info}
                  key={column.id}
                  label={column.label}
                  onSort={() => onSortColumn(column.id)}
                />
              ))}
              {canManage ? (
                <SortableTableHead
                  ariaSort="none"
                  direction={null}
                  label="Actions"
                  onSort={() => {}}
                  sortable={false}
                />
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={canManage ? 15 : 14}>
                  No income entries yet.
                  {canManage ? " Add a stay or other income to get started." : ""}
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <IncomeEntryRow
                  canManage={canManage}
                  entry={entry}
                  isDeleteLinePending={isDeleteLinePending}
                  isDeleteStayPending={isDeleteStayPending}
                  isQuickDeleteActive={isQuickDeleteActive}
                  key={getIncomeEntryKey(entry)}
                  onAddOtherIncomeFromStay={onAddOtherIncomeFromStay}
                  onDeleteLine={onDeleteLine}
                  onDeleteStay={onDeleteStay}
                  onEditLine={onEditLine}
                  onEditStay={onEditStay}
                  onRestoreLine={onRestoreLine}
                  onRestoreStay={onRestoreStay}
                  onShowCalculationDetails={onShowCalculationDetails}
                  unitLabel={resolveIncomeUnitLabel(getEntryUnitId(entry), unitLabelById)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
    incomeLineTypes,
    onCreateIncomeLineOpenChange,
    onCreateStayOpenChange,
    onEditIncomeLineOpenChange,
    onEditReservationOpenChange,
    propertyId,
    units,
  }: {
    createLineLockedStay: IPropertyReservation | null;
    createLineOpen: boolean;
    createLinePrefill: CreateIncomeLineDialogPrefill | null;
    createStayOpen: boolean;
    editIncomeLine: IPropertyIncomeLine | null;
    editReservation: IPropertyReservation | null;
    incomeLineTypes: IPropertyIncomeLineType[];
    onCreateIncomeLineOpenChange: (open: boolean) => void;
    onCreateStayOpenChange: (open: boolean) => void;
    onEditIncomeLineOpenChange: (open: boolean) => void;
    onEditReservationOpenChange: (open: boolean) => void;
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
  ({ onAddOtherIncome, onAddStay }: { onAddOtherIncome: () => void; onAddStay: () => void }) => (
    <>
      <Button className="gap-1.5" onClick={onAddStay} size="sm" type="button" variant="outline">
        <Plus className="size-3.5" />
        Add Short Stay
      </Button>
      <Button className="gap-1.5" onClick={onAddOtherIncome} size="sm" type="button">
        <Plus className="size-3.5" />
        Add Other Income
      </Button>
    </>
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
  onAddOtherIncomeFromStay: (stay: IPropertyReservation) => void;
  onDeleteStay: (stay: IPropertyReservation, event?: MouseEvent<HTMLButtonElement>) => void;
  onEditStay: (stay: IPropertyReservation) => void;
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
    onAddOtherIncomeFromStay,
    onDeleteStay,
    onEditStay,
    onRestoreStay,
    onShowCalculationDetails,
    stay,
    unitLabel,
  }: IncomeStayEntryRowProps) => {
    const taxesTotal = getStayTaxesTotal(stay);
    const showTaxesDetails = taxesTotal > 0;
    const showCommissionDetails = stay.channelCommission > 0;
    const netPayout = getStayNetPayout(stay);

    return (
      <TableRow className={stay.isDeleted ? deletedRowClassName : undefined}>
        <TableCell>
          <div className="flex items-center gap-2">
            <IncomeEntryTypeBadge entryKind={IncomeEntryKind.STAY} />
            {stay.isDeleted ? <DeletedBadge /> : null}
          </div>
        </TableCell>
        <TableCell className="font-medium">{unitLabel}</TableCell>
        <TableCell>{stay.guestName}</TableCell>
        <TableCell>{stay.checkIn}</TableCell>
        <TableCell>{stay.checkOut}</TableCell>
        <TableCell>{stay.nights}</TableCell>
        <TableCell>
          <ReservationChannelBadge channel={stay.channel} />
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
                  <Button
                    aria-label="Add other income for this stay"
                    onClick={() => onAddOtherIncomeFromStay(stay)}
                    size="icon-sm"
                    title="Add other income"
                    type="button"
                    variant="ghost"
                  >
                    <CirclePlus className="size-3.5" />
                  </Button>
                  <Button
                    aria-label="Edit stay"
                    onClick={() => onEditStay(stay)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <QuickDeleteButton
                    ariaLabel="Delete stay"
                    disabled={isDeletePending}
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
  line: IPropertyIncomeLine;
  onDeleteLine: (line: IPropertyIncomeLine, event?: MouseEvent<HTMLButtonElement>) => void;
  onEditLine: (line: IPropertyIncomeLine) => void;
  onRestoreLine: (line: IPropertyIncomeLine) => void;
  unitLabel: string;
};

const IncomeLineEntryRow = memo(
  ({
    canManage,
    isDeletePending,
    isQuickDeleteActive,
    line,
    onDeleteLine,
    onEditLine,
    onRestoreLine,
    unitLabel,
  }: IncomeLineEntryRowProps) => (
    <TableRow className={line.isDeleted ? deletedRowClassName : undefined}>
      <TableCell>
        <div className="flex items-center gap-2">
          <IncomeEntryTypeBadge
            entryKind={IncomeEntryKind.LINE}
            incomeLineTypeId={line.incomeLineTypeId}
            label={line.incomeLineTypeName ?? line.incomeLineTypeId}
          />
          {line.isDeleted ? <DeletedBadge /> : null}
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
                <Button
                  aria-label="Edit other income"
                  onClick={() => onEditLine(line)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <QuickDeleteButton
                  ariaLabel="Delete other income"
                  disabled={isDeletePending}
                  onClick={(event) => onDeleteLine(line, event)}
                  quickDeleteActive={isQuickDeleteActive}
                />
              </>
            )}
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  )
);
IncomeLineEntryRow.displayName = "IncomeLineEntryRow";

const IncomeEntryRow = memo(
  ({
    canManage,
    entry,
    isDeleteLinePending,
    isDeleteStayPending,
    isQuickDeleteActive,
    onAddOtherIncomeFromStay,
    onDeleteLine,
    onDeleteStay,
    onEditLine,
    onEditStay,
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
    onAddOtherIncomeFromStay: (stay: IPropertyReservation) => void;
    onDeleteLine: (line: IPropertyIncomeLine, event?: MouseEvent<HTMLButtonElement>) => void;
    onDeleteStay: (stay: IPropertyReservation, event?: MouseEvent<HTMLButtonElement>) => void;
    onEditLine: (line: IPropertyIncomeLine) => void;
    onEditStay: (stay: IPropertyReservation) => void;
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
          onAddOtherIncomeFromStay={onAddOtherIncomeFromStay}
          onDeleteStay={onDeleteStay}
          onEditStay={onEditStay}
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
        line={entry.line}
        onDeleteLine={onDeleteLine}
        onEditLine={onEditLine}
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
  onAddStay: () => void
) {
  const pageActions = useMemo(
    () =>
      canManage ? (
        <PropertyIncomePageActions onAddOtherIncome={onAddOtherIncome} onAddStay={onAddStay} />
      ) : null,
    [canManage, onAddOtherIncome, onAddStay]
  );

  usePropertyShellActions(pageActions);
}

const PropertyIncomePage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;
  const queryClient = useQueryClient();
  const [createStayOpen, setCreateStayOpen] = useState(false);
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
  const { channel, from, incomeType, status, to, unitId } = filters;
  const { getColumnAriaSort, getColumnDirection, sortState, toggleSort } = useUrlTableSort({
    defaultColumnId: "date",
    defaultDirection: "desc",
  });

  const dateFilters = useMemo(() => buildDateFilters(from, to, unitId), [from, to, unitId]);

  const reservationFilters = useMemo(
    () => buildReservationFilters(dateFilters, channel, status),
    [channel, dateFilters, status]
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

  useRegisterIncomePageActions(canManage, handleAddOtherIncome, handleAddStay);

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className={getLedgerFiltersGridClass(6)}>
            <DateFilterField
              id="filter-from"
              label="From"
              onChange={(e) => setFilter("from", e.target.value)}
              value={from}
            />
            <DateFilterField
              id="filter-to"
              label="To"
              onChange={(e) => setFilter("to", e.target.value)}
              value={to}
            />
            <FilterSelectField
              id="filter-unit"
              label="Unit"
              onChange={(e) => setFilter("unitId", e.target.value)}
              value={unitId}
            >
              <PropertyUnitSelectOptions emptyOptionLabel="All units" units={units} />
            </FilterSelectField>
            <FilterSelectField
              id="filter-income-type"
              label="Income type"
              onChange={(e) => setFilter("incomeType", e.target.value)}
              options={incomeTypeFilterOptions}
              value={incomeType}
            />
            <FilterSelectField
              disabled={!showStays}
              emptyOptionLabel="All channels"
              id="filter-channel"
              label="Channel"
              onChange={(e) => setFilter("channel", e.target.value)}
              options={CHANNEL_OPTIONS}
              value={channel}
            />
            <FilterSelectField
              disabled={!showStays}
              emptyOptionLabel="All statuses"
              id="filter-status"
              label="Status"
              onChange={(e) => setFilter("status", e.target.value)}
              options={STATUS_OPTIONS}
              value={status}
            />
          </div>

          <PropertyIncomeEntriesTable
            canManage={canManage}
            entries={sortedEntries}
            getColumnAriaSort={getColumnAriaSort}
            getColumnDirection={getColumnDirection}
            isDeleteLinePending={deleteLineMutation.isPending}
            isDeleteStayPending={deleteStayMutation.isPending}
            isLoading={isLoading}
            isQuickDeleteActive={isQuickDeleteActive}
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
            onRestoreLine={(line) => restoreLineMutation.mutate(line)}
            onRestoreStay={(stay) => restoreStayMutation.mutate(stay)}
            onShowCalculationDetails={(stay, metric) => setCalculationDetails({ metric, stay })}
            onSortColumn={toggleSort}
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

      <PropertyIncomePageDialogs
        createLineLockedStay={createLineLockedStay}
        createLineOpen={createLineOpen}
        createLinePrefill={createLinePrefill}
        createStayOpen={createStayOpen}
        editIncomeLine={editIncomeLine}
        editReservation={editReservation}
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
        propertyId={propertyId}
        units={activeUnits}
      />
    </>
  );
});
PropertyIncomePage.displayName = "PropertyIncomePage";

export { PropertyIncomePage };
