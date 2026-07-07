import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";

import { CreateIncomeLineDialog, type CreateIncomeLineDialogPrefill } from "@/components/income/create-income-line-dialog";
import { CreateReservationDialog } from "@/components/income/create-reservation-dialog";
import { EditIncomeLineDialog } from "@/components/income/edit-income-line-dialog";
import { EditReservationDialog } from "@/components/income/edit-reservation-dialog";
import { formatIncomeLineTypeLabel, INCOME_TYPE_FILTER_OPTIONS, incomeLineSelectClassName } from "@/components/income/income-line-form-options";
import {
  CHANNEL_OPTIONS,
  formatChannelLabel,
  formatStatusLabel,
  reservationSelectClassName,
  STATUS_OPTIONS,
} from "@/components/income/reservation-form-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { incomeLinesApi, reservationsApi, unitsApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  IncomeEntryKind,
  IncomeLineType,
  type IPropertyIncomeLine,
  type IPropertyIncomeLinesListQuery,
  type IPropertyReservation,
  type IPropertyReservationsListQuery,
  type TIncomeLineType,
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
      if (incomeTypeFilter === "" || line.lineType === incomeTypeFilter) {
        entries.push({ entryKind: IncomeEntryKind.LINE, line });
      }
    }
  }

  return entries.sort((a, b) => getEntryDate(b).localeCompare(getEntryDate(a)));
}

function getEntryDate(entry: TPropertyIncomeEntry): string {
  return entry.entryKind === IncomeEntryKind.STAY
    ? entry.stay.checkIn
    : entry.line.transactionDate;
}

function getEntryTypeLabel(entry: TPropertyIncomeEntry): string {
  return entry.entryKind === IncomeEntryKind.STAY
    ? "Stay"
    : formatIncomeLineTypeLabel(entry.line.lineType);
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
    unitLabel,
  }: {
    canManage: boolean;
    entry: TPropertyIncomeEntry;
    onAddOtherIncomeFromStay: (stay: IPropertyReservation) => void;
    onDeleteLine: (line: IPropertyIncomeLine) => void;
    onDeleteStay: (stay: IPropertyReservation) => void;
    onEditLine: (line: IPropertyIncomeLine) => void;
    onEditStay: (stay: IPropertyReservation) => void;
    unitLabel: string;
  }) => {
    if (entry.entryKind === IncomeEntryKind.STAY) {
      const { stay } = entry;
      return (
        <TableRow>
          <TableCell>{getEntryTypeLabel(entry)}</TableCell>
          <TableCell className="font-medium">{unitLabel}</TableCell>
          <TableCell>{stay.guestName}</TableCell>
          <TableCell>{stay.checkIn}</TableCell>
          <TableCell>{stay.checkOut}</TableCell>
          <TableCell>{stay.nights}</TableCell>
          <TableCell>{formatChannelLabel(stay.channel)}</TableCell>
          <TableCell>{formatStatusLabel(stay.status)}</TableCell>
          <TableCell className="text-right">{formatMoney(stay.roomRate)}</TableCell>
          <TableCell className="text-right">{formatMoney(stay.cleaningFee)}</TableCell>
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
        <TableCell>{getEntryTypeLabel(entry)}</TableCell>
        <TableCell className="font-medium">{unitLabel}</TableCell>
        <TableCell>{line.guestName ?? "—"}</TableCell>
        <TableCell>{line.transactionDate}</TableCell>
        <TableCell>—</TableCell>
        <TableCell>—</TableCell>
        <TableCell>—</TableCell>
        <TableCell>—</TableCell>
        <TableCell className="text-right">{formatMoney(line.amount)}</TableCell>
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
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [unitId, setUnitId] = useState("");
    const [channel, setChannel] = useState("");
    const [status, setStatus] = useState("");
    const [incomeType, setIncomeType] = useState("");

    const dateFilters = useMemo(() => {
      const next: { from?: string; to?: string; unitId?: string } = {};
      if (from) next.from = from;
      if (to) next.to = to;
      if (unitId) next.unitId = unitId;
      return next;
    }, [from, to, unitId]);

    const reservationFilters = useMemo<IPropertyReservationsListQuery>(() => {
      const next: IPropertyReservationsListQuery = { ...dateFilters };
      if (channel) next.channel = channel as IPropertyReservationsListQuery["channel"];
      if (status) next.status = status as IPropertyReservationsListQuery["status"];
      return next;
    }, [channel, dateFilters, status]);

    const lineFilters = useMemo<IPropertyIncomeLinesListQuery>(() => {
      const next: IPropertyIncomeLinesListQuery = { ...dateFilters };
      if (incomeType && incomeType !== IncomeEntryKind.STAY) {
        next.lineType = incomeType as TIncomeLineType;
      }
      return next;
    }, [dateFilters, incomeType]);

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

    const units = unitsQuery.data?.units ?? [];

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

    const showStays = incomeType === "" || incomeType === IncomeEntryKind.STAY;
    const showLines = incomeType === "" || incomeType !== IncomeEntryKind.STAY;
    const isLoading =
      (showStays && reservationsQuery.isPending) ||
      (showLines && incomeLinesQuery.isPending);

    usePropertyShellActions(
      canManage ? (
        <>
          <Button
            className="gap-1.5"
            onClick={() => setCreateStayOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="size-3.5" />
            Add Stay
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => {
              setCreateLinePrefill(null);
              setCreateLineLockedStay(null);
              setCreateLineOpen(true);
            }}
            size="sm"
            type="button"
          >
            <Plus className="size-3.5" />
            Add Other Income
          </Button>
        </>
      ) : null
    );

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
                  <option value="">All units</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unitNumber}
                    </option>
                  ))}
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
                  {INCOME_TYPE_FILTER_OPTIONS.map((opt) => (
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
                  disabled={incomeType !== "" && incomeType !== IncomeEntryKind.STAY}
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
                  disabled={incomeType !== "" && incomeType !== IncomeEntryKind.STAY}
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

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Date / Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Nights</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Room rate</TableHead>
                      <TableHead className="text-right">Cleaning</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      {canManage ? <TableHead>Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow>
                        <TableCell
                          className="text-muted-foreground"
                          colSpan={canManage ? 13 : 12}
                        >
                          No income entries yet.{canManage ? " Add a stay or other income to get started." : ""}
                        </TableCell>
                      </TableRow>
                    ) : (
                      entries.map((entry) => (
                        <IncomeEntryRow
                          canManage={canManage}
                          entry={entry}
                          key={
                            entry.entryKind === IncomeEntryKind.STAY
                              ? `stay-${entry.stay.id}`
                              : `line-${entry.line.id}`
                          }
                          onAddOtherIncomeFromStay={(stay) => {
                            setCreateLineLockedStay(stay);
                            setCreateLinePrefill({
                              guestName: stay.guestName,
                              lineType: IncomeLineType.EXTRA_CLEANING,
                              reservationId: stay.id,
                              transactionDate: stay.checkOut,
                              unitId: stay.unitId,
                            });
                            setCreateLineOpen(true);
                          }}
                          onDeleteLine={(line) => {
                            if (
                              !globalThis.confirm(
                                `Delete ${formatIncomeLineTypeLabel(line.lineType)} entry? This cannot be undone.`
                              )
                            ) {
                              return;
                            }
                            deleteLineMutation.mutate(line);
                          }}
                          onDeleteStay={(stay) => {
                            if (
                              !globalThis.confirm(
                                `Delete stay for ${stay.guestName}? This cannot be undone.`
                              )
                            ) {
                              return;
                            }
                            deleteStayMutation.mutate(stay);
                          }}
                          onEditLine={setEditIncomeLine}
                          onEditStay={setEditReservation}
                          unitLabel={
                            unitLabelById.get(
                              entry.entryKind === IncomeEntryKind.STAY
                                ? entry.stay.unitId
                                : entry.line.unitId
                            ) ?? "—"
                          }
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <CreateReservationDialog
          onOpenChange={setCreateStayOpen}
          open={createStayOpen}
          propertyId={propertyId}
        />
        <CreateIncomeLineDialog
          lockedStay={createLineLockedStay}
          onOpenChange={(open) => {
            setCreateLineOpen(open);
            if (!open) {
              setCreateLinePrefill(null);
              setCreateLineLockedStay(null);
            }
          }}
          open={createLineOpen}
          prefill={createLinePrefill}
          propertyId={propertyId}
        />
        {editReservation ? (
          <EditReservationDialog
            key={editReservation.id}
            onOpenChange={(open) => {
              if (!open) setEditReservation(null);
            }}
            open={true}
            propertyId={propertyId}
            reservation={editReservation}
            units={units}
          />
        ) : null}
        {editIncomeLine ? (
          <EditIncomeLineDialog
            incomeLine={editIncomeLine}
            key={editIncomeLine.id}
            onOpenChange={(open) => {
              if (!open) setEditIncomeLine(null);
            }}
            open={true}
            propertyId={propertyId}
            units={units}
          />
        ) : null}
      </>
    );
});
PropertyIncomePage.displayName = "PropertyIncomePage";

export { PropertyIncomePage };
