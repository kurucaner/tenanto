import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Eye, Plus, SquarePen } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";

import { FilterField } from "@/components/filters/filter-field";
import { CreateIncomeLineDialog, type CreateIncomeLineDialogPrefill } from "@/components/income/create-income-line-dialog";
import { incomeLineSelectClassName } from "@/components/income/income-line-form-options";
import { EndLeaseDialog } from "@/components/leases/end-lease-dialog";
import { LeaseDetailSheet } from "@/components/leases/lease-detail-sheet";
import { StartLeaseDialog } from "@/components/leases/start-lease-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { longStaysApi, settingsApi, unitsApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { getLedgerFiltersGridClass } from "@/lib/ledger-filter-grid";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  clampToMaxLocalIsoDate,
  getTodayLocalIsoDate,
} from "@/lib/reservation-date-utils";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  formatPropertyUnitSelectLabel,
  getLeaseOccupancyNames,
  type IPropertyLongStay,
  type IPropertyLongStaysListQuery,
  PropertyLongStayStatus,
  resolveRentIncomeLineTypeId,
  type TPropertyLongStayStatus,
} from "@/packages/shared";

const LEASE_STATUS_FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Active", value: PropertyLongStayStatus.ACTIVE },
  { label: "Ended", value: PropertyLongStayStatus.ENDED },
] as const;

const LEASE_URL_FILTER_SCHEMA = defineUrlFilterSchema<{
  status: string;
  unitId: string;
}>({
  status: { defaultValue: "" },
  unitId: { defaultValue: "" },
});

function buildRentPrefill(
  lease: IPropertyLongStay,
  incomeLineTypeId: string,
  month?: string
): CreateIncomeLineDialogPrefill {
  const maxDate = getTodayLocalIsoDate();
  const monthDate = month ? `${month}-01` : maxDate;
  return {
    amount: String(lease.monthlyRent),
    guestName: lease.guestName,
    incomeLineTypeId,
    longStayId: lease.id,
    transactionDate: clampToMaxLocalIsoDate(monthDate, maxDate),
    unitId: lease.unitId,
  };
}

const LeaseRow = memo(
  ({
    canManage,
    lease,
    onEndLease,
    onRecordRent,
    onView,
    unitLabel,
  }: {
    canManage: boolean;
    lease: IPropertyLongStay;
    onEndLease: (lease: IPropertyLongStay) => void;
    onRecordRent: (lease: IPropertyLongStay) => void;
    onView: (lease: IPropertyLongStay) => void;
    unitLabel: string;
  }) => {
    const endDate = lease.actualEndDate ?? lease.leaseEndDate;
    const tenantNames = getLeaseOccupancyNames(lease);

    return (
      <TableRow>
        <TableCell className="font-medium">{unitLabel}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {tenantNames.map((name, index) => (
              <Badge key={`${name}-${index}`} variant="secondary">
                {name}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>{lease.leaseStartDate}</TableCell>
        <TableCell>{endDate}</TableCell>
        <TableCell className="text-right">{formatMoney(lease.monthlyRent)}</TableCell>
        <TableCell>
          <Badge
            variant={lease.status === PropertyLongStayStatus.ACTIVE ? "default" : "secondary"}
          >
            {lease.status === PropertyLongStayStatus.ACTIVE ? "Active" : "Ended"}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              aria-label="View lease"
              onClick={() => onView(lease)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Eye className="size-3.5" />
            </Button>
            {canManage && lease.status === PropertyLongStayStatus.ACTIVE ? (
              <>
                <Button
                  aria-label="Record rent"
                  onClick={() => onRecordRent(lease)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <CircleDollarSign className="size-3.5" />
                </Button>
                <Button
                  aria-label="End lease"
                  onClick={() => onEndLease(lease)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <SquarePen className="size-3.5" />
                </Button>
              </>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
    );
  }
);
LeaseRow.displayName = "LeaseRow";

export const PropertyLeasesPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;

  const { filters, setFilters } = useUrlFilterState(LEASE_URL_FILTER_SCHEMA);
  const { status, unitId } = filters;
  const [createOpen, setCreateOpen] = useState(false);
  const [detailLease, setDetailLease] = useState<IPropertyLongStay | null>(null);
  const [endLease, setEndLease] = useState<IPropertyLongStay | null>(null);
  const [recordRentLease, setRecordRentLease] = useState<IPropertyLongStay | null>(null);
  const [recordRentPrefill, setRecordRentPrefill] = useState<CreateIncomeLineDialogPrefill | null>(
    null
  );

  const listQueryFilters = useMemo((): IPropertyLongStaysListQuery => {
    const query: IPropertyLongStaysListQuery = {};
    if (status) {
      query.status = status as TPropertyLongStayStatus;
    }
    if (unitId) {
      query.unitId = unitId;
    }
    return query;
  }, [status, unitId]);

  const leasesQuery = useQuery({
    queryFn: () => longStaysApi.list(propertyId, listQueryFilters),
    queryKey: adminQueryKeys.propertyLongStays(propertyId, listQueryFilters),
  });

  const activeLeasesQuery = useQuery({
    queryFn: () => longStaysApi.list(propertyId, { status: PropertyLongStayStatus.ACTIVE }),
    queryKey: adminQueryKeys.propertyLongStays(propertyId, { status: PropertyLongStayStatus.ACTIVE }),
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
  const incomeLineTypes = useMemo(
    () => settingsQuery.data?.settings.incomeLineTypes ?? [],
    [settingsQuery.data?.settings.incomeLineTypes]
  );
  const rentIncomeLineTypeId = useMemo(
    () => resolveRentIncomeLineTypeId(incomeLineTypes),
    [incomeLineTypes]
  );

  const unitLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of units) {
      map.set(unit.id, formatPropertyUnitSelectLabel(unit));
    }
    return map;
  }, [units]);

  const occupiedUnitIds = useMemo(() => {
    const ids = new Set<string>();
    for (const lease of activeLeasesQuery.data?.longStays ?? []) {
      ids.add(lease.unitId);
    }
    return ids;
  }, [activeLeasesQuery.data?.longStays]);

  const handleOpenCreate = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const pageActions = useMemo(
    () =>
      canManage ? (
        <Button className="gap-1.5" onClick={handleOpenCreate} size="sm" type="button">
          <Plus className="size-3.5" />
          Start Lease
        </Button>
      ) : null,
    [canManage, handleOpenCreate]
  );

  usePropertyShellActions(pageActions);

  const handleRecordRent = useCallback(
    (lease: IPropertyLongStay, month?: string) => {
      setRecordRentLease(lease);
      setRecordRentPrefill(buildRentPrefill(lease, rentIncomeLineTypeId, month));
    },
    [rentIncomeLineTypeId]
  );

  const leases = leasesQuery.data?.longStays ?? [];

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className={`border-b p-4 ${getLedgerFiltersGridClass(2)}`}>
            <FilterField>
              <Label htmlFor="lease-filter-status">Status</Label>
              <select
                className={incomeLineSelectClassName}
                id="lease-filter-status"
                onChange={(e) => setFilters({ status: e.target.value })}
                value={status}
              >
                {LEASE_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField>
              <Label htmlFor="lease-filter-unit">Unit</Label>
              <select
                className={incomeLineSelectClassName}
                id="lease-filter-unit"
                onChange={(e) => setFilters({ unitId: e.target.value })}
                value={unitId}
              >
                <option value="">All units</option>
                <PropertyUnitSelectOptions units={units.filter((unit) => !unit.isDeleted)} />
              </select>
            </FilterField>
          </div>

          {leasesQuery.isPending ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead className="text-right">Rent/mo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={7}>
                      No leases yet.{canManage ? " Start a lease to get started." : ""}
                    </TableCell>
                  </TableRow>
                ) : (
                  leases.map((lease) => (
                    <LeaseRow
                      canManage={canManage}
                      key={lease.id}
                      lease={lease}
                      onEndLease={setEndLease}
                      onRecordRent={handleRecordRent}
                      onView={setDetailLease}
                      unitLabel={unitLabelById.get(lease.unitId) ?? lease.unitId}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StartLeaseDialog
        occupiedUnitIds={occupiedUnitIds}
        onOpenChange={setCreateOpen}
        open={createOpen}
        propertyId={propertyId}
        units={units}
      />

      <LeaseDetailSheet
        canManage={canManage}
        lease={detailLease}
        onOpenChange={(open) => {
          if (!open) setDetailLease(null);
        }}
        onRecordRent={handleRecordRent}
        open={detailLease != null}
        propertyId={propertyId}
        unitLabelById={unitLabelById}
      />

      {endLease ? (
        <EndLeaseDialog
          key={endLease.id}
          lease={endLease}
          onOpenChange={(open) => {
            if (!open) setEndLease(null);
          }}
          open={true}
          propertyId={propertyId}
        />
      ) : null}

      {recordRentLease ? (
        <CreateIncomeLineDialog
          incomeLineTypes={incomeLineTypes}
          key={`${recordRentLease.id}-${recordRentPrefill?.transactionDate ?? "today"}`}
          lockedLease={recordRentLease}
          onOpenChange={(open) => {
            if (!open) {
              setRecordRentLease(null);
              setRecordRentPrefill(null);
            }
          }}
          open={true}
          prefill={recordRentPrefill}
          propertyId={propertyId}
          units={units}
        />
      ) : null}
    </>
  );
});
PropertyLeasesPage.displayName = "PropertyLeasesPage";
