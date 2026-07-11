import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Eye, Plus, SquarePen } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { DataTable } from "@/components/data-table/data-table";
import { type DataTableColumn } from "@/components/data-table/data-table-types";
import { FilterSelectField } from "@/components/filters/filter-select-field";
import {
  CreateIncomeLineDialog,
  type CreateIncomeLineDialogPrefill,
} from "@/components/income/create-income-line-dialog";
import { EndLeaseDialog } from "@/components/leases/end-lease-dialog";
import { StartLeaseDialog } from "@/components/leases/start-lease-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import {
  type TPropertyLongStaysListFilters,
  usePropertyLongStaysInfiniteList,
} from "@/hooks/use-property-long-stays-infinite-list";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { settingsApi, unitsApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { getLedgerFiltersGridClass } from "@/lib/ledger-filter-grid";
import { adminQueryKeys } from "@/lib/query-keys";
import { clampToMaxLocalIsoDate, getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  formatPropertyUnitSelectLabel,
  getLeaseOccupancyNames,
  type IPropertyLongStay,
  type IPropertyLongStayDetailResponse,
  type IPropertyUnit,
  PropertyLongStayStatus,
  resolveRentIncomeLineTypeId,
  type TPropertyLongStayStatus,
} from "@/packages/shared";

const LEASE_STATUS_FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Active", value: PropertyLongStayStatus.ACTIVE },
  { label: "Ended", value: PropertyLongStayStatus.ENDED },
] as const;

const LEASE_ROW_ESTIMATED_HEIGHT = 44;

const LEASE_COLUMNS: DataTableColumn[] = [
  { id: "unit", label: "Unit" },
  { id: "tenant", label: "Tenant" },
  { id: "start", label: "Start" },
  { id: "end", label: "End" },
  { align: "right", id: "rent", label: "Rent/mo" },
  { id: "status", label: "Status" },
  { id: "actions", label: "Actions" },
];

function getLeaseKey(lease: IPropertyLongStay): string {
  return lease.id;
}

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
  month?: string,
  expectedAmount?: number
): CreateIncomeLineDialogPrefill {
  const maxDate = getTodayLocalIsoDate();
  const monthDate = month ? `${month}-01` : maxDate;
  return {
    amount: String(expectedAmount ?? lease.monthlyRent),
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
    leaseDetailPath,
    onEndLease,
    onRecordRent,
    unitLabel,
  }: {
    canManage: boolean;
    lease: IPropertyLongStay;
    leaseDetailPath: string;
    onEndLease: (lease: IPropertyLongStay) => void;
    onRecordRent: (lease: IPropertyLongStay) => void;
    unitLabel: string;
  }) => {
    const endDate = lease.actualEndDate ?? lease.leaseEndDate;
    const tenantNames = getLeaseOccupancyNames(lease);

    return (
      <TableRow>
        <TableCell className="font-medium">
          <Link className="hover:underline" to={leaseDetailPath}>
            {unitLabel}
          </Link>
        </TableCell>
        <TableCell>
          <Link className="block" to={leaseDetailPath}>
            <div className="flex flex-wrap gap-1">
              {tenantNames.map((name, index) => (
                <Badge key={`${name}-${index}`} variant="secondary">
                  {name}
                </Badge>
              ))}
            </div>
          </Link>
        </TableCell>
        <TableCell>{lease.leaseStartDate}</TableCell>
        <TableCell>{endDate}</TableCell>
        <TableCell className="text-right">{formatMoney(lease.monthlyRent)}</TableCell>
        <TableCell>
          <Badge variant={lease.status === PropertyLongStayStatus.ACTIVE ? "default" : "secondary"}>
            {lease.status === PropertyLongStayStatus.ACTIVE ? "Active" : "Ended"}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button aria-label="View lease" asChild size="icon-sm" type="button" variant="ghost">
              <Link to={leaseDetailPath}>
                <Eye className="size-3.5" />
              </Link>
            </Button>
            {canManage && lease.status === PropertyLongStayStatus.ACTIVE ? (
              <>
                <Button
                  aria-label="Record rent"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRecordRent(lease);
                  }}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <CircleDollarSign className="size-3.5" />
                </Button>
                <Button
                  aria-label="End lease"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEndLease(lease);
                  }}
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

const PropertyLeaseFilters = memo(
  ({
    onStatusChange,
    onUnitIdChange,
    status,
    unitId,
    units,
  }: {
    onStatusChange: (value: string) => void;
    onUnitIdChange: (value: string) => void;
    status: string;
    unitId: string;
    units: IPropertyUnit[];
  }) => (
    <div className={getLedgerFiltersGridClass(2)}>
      <FilterSelectField
        id="lease-filter-status"
        label="Status"
        onChange={(e) => onStatusChange(e.target.value)}
        options={LEASE_STATUS_FILTER_OPTIONS}
        value={status}
      />
      <FilterSelectField
        emptyOptionLabel="All units"
        id="lease-filter-unit"
        label="Unit"
        onChange={(e) => onUnitIdChange(e.target.value)}
        value={unitId}
      >
        <PropertyUnitSelectOptions units={units.filter((unit) => !unit.isDeleted)} />
      </FilterSelectField>
    </div>
  )
);
PropertyLeaseFilters.displayName = "PropertyLeaseFilters";

export const PropertyLeasesPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;
  const queryClient = useQueryClient();

  const { filters, setFilters } = useUrlFilterState(LEASE_URL_FILTER_SCHEMA);
  const { status, unitId } = filters;
  const [createOpen, setCreateOpen] = useState(false);
  const [endLease, setEndLease] = useState<IPropertyLongStay | null>(null);
  const [recordRentLease, setRecordRentLease] = useState<IPropertyLongStay | null>(null);
  const [recordRentPrefill, setRecordRentPrefill] = useState<CreateIncomeLineDialogPrefill | null>(
    null
  );

  const listQueryFilters = useMemo((): TPropertyLongStaysListFilters => {
    const query: TPropertyLongStaysListFilters = {};
    if (status) {
      query.status = status as TPropertyLongStayStatus;
    }
    if (unitId) {
      query.unitId = unitId;
    }
    return query;
  }, [status, unitId]);

  const { fetchNextPage, hasNextPage, isFetchingNextPage, isPending, longStays } =
    usePropertyLongStaysInfiniteList(propertyId, listQueryFilters);

  const scrollSentinelRef = useInfiniteScrollTrigger({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
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
      let expectedAmount: number | undefined;
      if (month) {
        const detail = queryClient.getQueryData<IPropertyLongStayDetailResponse>(
          adminQueryKeys.propertyLongStay(propertyId, lease.id)
        );
        expectedAmount = detail?.rentSchedule.find((item) => item.month === month)?.expectedRent;
      }
      setRecordRentLease(lease);
      setRecordRentPrefill(buildRentPrefill(lease, rentIncomeLineTypeId, month, expectedAmount));
    },
    [propertyId, queryClient, rentIncomeLineTypeId]
  );

  const renderLeaseRow = useCallback(
    (lease: IPropertyLongStay) => (
      <LeaseRow
        canManage={canManage}
        key={lease.id}
        lease={lease}
        leaseDetailPath={`/properties/${propertyId}/leases/${lease.id}`}
        onEndLease={setEndLease}
        onRecordRent={handleRecordRent}
        unitLabel={unitLabelById.get(lease.unitId) ?? lease.unitId}
      />
    ),
    [canManage, handleRecordRent, propertyId, unitLabelById]
  );

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-0">
          <DataTable
            columns={LEASE_COLUMNS}
            emptyMessage={`No leases yet.${canManage ? " Start a lease to get started." : ""}`}
            filters={
              <PropertyLeaseFilters
                onStatusChange={(value) => setFilters({ status: value })}
                onUnitIdChange={(value) => setFilters({ unitId: value })}
                status={status}
                unitId={unitId}
                units={units}
              />
            }
            getItemKey={getLeaseKey}
            infiniteScroll={{ hasNextPage, isFetchingNextPage }}
            infiniteScrollSentinelRef={scrollSentinelRef}
            isPending={isPending}
            items={longStays}
            renderRow={renderLeaseRow}
            virtualization={{ estimateRowHeight: LEASE_ROW_ESTIMATED_HEIGHT }}
          />
        </CardContent>
      </Card>

      <StartLeaseDialog
        onOpenChange={setCreateOpen}
        open={createOpen}
        propertyId={propertyId}
        units={units}
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
