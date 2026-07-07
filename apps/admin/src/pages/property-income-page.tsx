import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { CreateIncomeLineDialog, type CreateIncomeLineDialogPrefill } from "@/components/income/create-income-line-dialog";
import { CreateReservationDialog } from "@/components/income/create-reservation-dialog";
import { EditIncomeLineDialog } from "@/components/income/edit-income-line-dialog";
import { EditReservationDialog } from "@/components/income/edit-reservation-dialog";
import { IncomeEntryTypeBadge } from "@/components/income/income-entry-type-badge";
import { buildIncomeTypeFilterOptions, incomeLineSelectClassName } from "@/components/income/income-line-form-options";
import { ReservationChannelBadge } from "@/components/income/reservation-channel-badge";
import {
  CHANNEL_OPTIONS,
  reservationSelectClassName,
  STATUS_OPTIONS,
} from "@/components/income/reservation-form-options";
import { ReservationStatusBadge } from "@/components/income/reservation-status-badge";
import { StayFeesDetailsDialog } from "@/components/income/stay-fees-details-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useTableSort } from "@/hooks/use-table-sort";
import { incomeLinesApi, reservationsApi, settingsApi, unitsApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import {
  getEntryUnitId,
  sortIncomeEntries,
  type TIncomeEntrySortColumnId,
} from "@/lib/income-entry-sort";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  getStayTaxesAndFeesTotal,
  IncomeEntryKind,
  type IPropertyIncomeLine,
  type IPropertyIncomeLinesListQuery,
  type IPropertyIncomeLineType,
  type IPropertyReservation,
  type IPropertyReservationsListQuery,
  type IPropertyUnit,
  resolveDefaultIncomeLineTypeId,
  type TPropertyIncomeEntry,
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
  { id: "roomRate", label: "Room rate / night", align: "right" },
  { id: "cleaning", label: "Cleaning", align: "right" },
  { id: "taxesFees", label: "Taxes & Fees", align: "right" },
  { id: "gross", label: "Gross", align: "right" },
  { id: "net", label: "Net", align: "right" },
];

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

function handleDeleteLine(
  line: IPropertyIncomeLine,
  mutate: (line: IPropertyIncomeLine) => void
): void {
  const typeLabel = line.incomeLineTypeName ?? line.incomeLineTypeId;
  if (
    !globalThis.confirm(
      `Delete ${typeLabel} entry? This cannot be undone.`
    )
  ) {
    return;
  }
  mutate(line);
}

function handleDeleteStay(
  stay: IPropertyReservation,
  mutate: (stay: IPropertyReservation) => void
): void {
  if (!globalThis.confirm(`Delete stay for ${stay.guestName}? This cannot be undone.`)) {
    return;
  }
  mutate(stay);
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
    isLoading,
    onAddOtherIncomeFromStay,
    onDeleteLine,
    onDeleteStay,
    onEditLine,
    onEditStay,
    onShowFeesDetails,
    onSortColumn,
    unitLabelById,
  }: {
    canManage: boolean;
    entries: TPropertyIncomeEntry[];
    getColumnAriaSort: (columnId: string) => "ascending" | "descending" | "none";
    getColumnDirection: (columnId: string) => "asc" | "desc" | null;
    isLoading: boolean;
    onAddOtherIncomeFromStay: (stay: IPropertyReservation) => void;
    onDeleteLine: (line: IPropertyIncomeLine) => void;
    onDeleteStay: (stay: IPropertyReservation) => void;
    onEditLine: (line: IPropertyIncomeLine) => void;
    onEditStay: (stay: IPropertyReservation) => void;
    onShowFeesDetails: (stay: IPropertyReservation) => void;
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
                <TableCell className="text-muted-foreground" colSpan={canManage ? 14 : 13}>
                  No income entries yet.
                  {canManage ? " Add a stay or other income to get started." : ""}
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <IncomeEntryRow
                  canManage={canManage}
                  entry={entry}
                  key={getIncomeEntryKey(entry)}
                  onAddOtherIncomeFromStay={onAddOtherIncomeFromStay}
                  onDeleteLine={onDeleteLine}
                  onDeleteStay={onDeleteStay}
                  onEditLine={onEditLine}
                  onEditStay={onEditStay}
                  onShowFeesDetails={onShowFeesDetails}
                  unitLabel={unitLabelById.get(getEntryUnitId(entry)) ?? "—"}
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
  ({
    onAddOtherIncome,
    onAddStay,
  }: {
    onAddOtherIncome: () => void;
    onAddStay: () => void;
  }) => (
    <>
      <Button className="gap-1.5" onClick={onAddStay} size="sm" type="button" variant="outline">
        <Plus className="size-3.5" />
        Add Stay
      </Button>
      <Button className="gap-1.5" onClick={onAddOtherIncome} size="sm" type="button">
        <Plus className="size-3.5" />
        Add Other Income
      </Button>
    </>
  )
);
PropertyIncomePageActions.displayName = "PropertyIncomePageActions";

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

const IncomeEntryRow = memo(
  ({
    canManage,
    entry,
    onAddOtherIncomeFromStay,
    onDeleteLine,
    onDeleteStay,
    onEditLine,
    onEditStay,
    onShowFeesDetails,
    unitLabel,
  }: {
    canManage: boolean;
    entry: TPropertyIncomeEntry;
    onAddOtherIncomeFromStay: (stay: IPropertyReservation) => void;
    onDeleteLine: (line: IPropertyIncomeLine) => void;
    onDeleteStay: (stay: IPropertyReservation) => void;
    onEditLine: (line: IPropertyIncomeLine) => void;
    onEditStay: (stay: IPropertyReservation) => void;
    onShowFeesDetails: (stay: IPropertyReservation) => void;
    unitLabel: string;
  }) => {
    if (entry.entryKind === IncomeEntryKind.STAY) {
      const { stay } = entry;
      const taxesAndFeesTotal = getStayTaxesAndFeesTotal(stay);
      const showFeesDetails = taxesAndFeesTotal > 0;

      return (
        <TableRow>
          <TableCell>
            <IncomeEntryTypeBadge entryKind={IncomeEntryKind.STAY} />
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
          <TableCell className="text-right">{formatMoney(stay.roomRate)}</TableCell>
          <TableCell className="text-right">{formatMoney(stay.cleaningFee)}</TableCell>
          <TableCell className="text-right">
            <div className="flex flex-col items-end gap-1">
              <span>{showFeesDetails ? formatMoney(taxesAndFeesTotal) : "—"}</span>
              {showFeesDetails ? (
                <Button
                  className="h-auto px-0 py-0 text-xs"
                  onClick={() => onShowFeesDetails(stay)}
                  type="button"
                  variant="link"
                >
                  Details
                </Button>
              ) : null}
            </div>
          </TableCell>
          <TableCell className="text-right">{formatMoney(stay.grossIncome)}</TableCell>
          <TableCell className="text-right font-medium">{formatMoney(stay.netIncome)}</TableCell>
          {canManage ? (
            <TableCell>
              <div className="flex items-center gap-1">
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
                <Button
                  aria-label="Delete stay"
                  onClick={() => onDeleteStay(stay)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </TableCell>
          ) : null}
        </TableRow>
      );
    }

    const { line } = entry;
    return (
      <TableRow>
        <TableCell>
          <IncomeEntryTypeBadge
            entryKind={IncomeEntryKind.LINE}
            incomeLineTypeId={line.incomeLineTypeId}
            label={line.incomeLineTypeName ?? line.incomeLineTypeId}
          />
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
        <TableCell className="text-right">{formatMoney(line.grossIncome)}</TableCell>
        <TableCell className="text-right font-medium">{formatMoney(line.netIncome)}</TableCell>
        {canManage ? (
          <TableCell>
            <div className="flex items-center gap-1">
              <Button
                aria-label="Edit other income"
                onClick={() => onEditLine(line)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                aria-label="Delete other income"
                onClick={() => onDeleteLine(line)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          </TableCell>
        ) : null}
      </TableRow>
    );
  }
);
IncomeEntryRow.displayName = "IncomeEntryRow";

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
    const [feesDetailsStay, setFeesDetailsStay] = useState<IPropertyReservation | null>(null);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [unitId, setUnitId] = useState("");
    const [channel, setChannel] = useState("");
    const [status, setStatus] = useState("");
    const [incomeType, setIncomeType] = useState("");
    const {
      getColumnAriaSort,
      getColumnDirection,
      sortState,
      toggleSort,
    } = useTableSort("date", "desc");

    const dateFilters = useMemo(
      () => buildDateFilters(from, to, unitId),
      [from, to, unitId]
    );

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

    const units = unitsQuery.data?.units ?? [];
    const incomeLineTypes = useMemo(
      () => settingsQuery.data?.settings.incomeLineTypes ?? [],
      [settingsQuery.data?.settings.incomeLineTypes]
    );

    const incomeTypeFilterOptions = useMemo(
      () => buildIncomeTypeFilterOptions(incomeLineTypes),
      [incomeLineTypes]
    );

    const unitLabelById = useMemo(
      () =>
        new Map(
          (unitsQuery.data?.units ?? []).map((unit) => [unit.id, unit.unitNumber])
        ),
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
      (showStays && reservationsQuery.isPending) ||
      (showLines && incomeLinesQuery.isPending);

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
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1.5">
                <Label htmlFor="filter-from">From</Label>
                <Input
                  id="filter-from"
                  onChange={(e) => setFrom(e.target.value)}
                  type="date"
                  value={from}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-to">To</Label>
                <Input
                  id="filter-to"
                  onChange={(e) => setTo(e.target.value)}
                  type="date"
                  value={to}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-unit">Unit</Label>
                <select
                  className={reservationSelectClassName}
                  id="filter-unit"
                  onChange={(e) => setUnitId(e.target.value)}
                  value={unitId}
                >
                  <PropertyUnitSelectOptions emptyOptionLabel="All units" units={units} />
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-income-type">Income type</Label>
                <select
                  className={incomeLineSelectClassName}
                  id="filter-income-type"
                  onChange={(e) => setIncomeType(e.target.value)}
                  value={incomeType}
                >
                  {incomeTypeFilterOptions.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-channel">Channel</Label>
                <select
                  className={reservationSelectClassName}
                  disabled={!showStays}
                  id="filter-channel"
                  onChange={(e) => setChannel(e.target.value)}
                  value={channel}
                >
                  <option value="">All channels</option>
                  {CHANNEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-status">Status</Label>
                <select
                  className={reservationSelectClassName}
                  disabled={!showStays}
                  id="filter-status"
                  onChange={(e) => setStatus(e.target.value)}
                  value={status}
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <PropertyIncomeEntriesTable
              canManage={canManage}
              entries={sortedEntries}
              getColumnAriaSort={getColumnAriaSort}
              getColumnDirection={getColumnDirection}
              isLoading={isLoading}
              onAddOtherIncomeFromStay={(stay) =>
                openOtherIncomeFromStay(stay, incomeLineTypes, {
                  setCreateLineLockedStay,
                  setCreateLineOpen,
                  setCreateLinePrefill,
                })
              }
              onDeleteLine={(line) => handleDeleteLine(line, deleteLineMutation.mutate)}
              onDeleteStay={(stay) => handleDeleteStay(stay, deleteStayMutation.mutate)}
              onEditLine={setEditIncomeLine}
              onEditStay={setEditReservation}
              onShowFeesDetails={setFeesDetailsStay}
              onSortColumn={toggleSort}
              unitLabelById={unitLabelById}
            />
          </CardContent>
        </Card>

        <StayFeesDetailsDialog
          onOpenChange={(open) => {
            if (!open) {
              setFeesDetailsStay(null);
            }
          }}
          open={feesDetailsStay !== null}
          stay={feesDetailsStay}
        />

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
          units={units}
        />
      </>
    );
});
PropertyIncomePage.displayName = "PropertyIncomePage";

export { PropertyIncomePage };
