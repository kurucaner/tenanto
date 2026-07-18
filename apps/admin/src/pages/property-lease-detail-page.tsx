import { useQuery } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  CreateIncomeLineDialog,
  type CreateIncomeLineDialogPrefill,
} from "@/components/income/create-income-line-dialog";
import { EndLeaseDialog } from "@/components/leases/end-lease-dialog";
import { ExtendLeaseDialog } from "@/components/leases/extend-lease-dialog";
import { LeaseDetailHeader } from "@/components/leases/lease-detail-header";
import { LeaseOverviewSection } from "@/components/leases/lease-overview-section";
import { LeasePaymentsSection } from "@/components/leases/lease-payments-section";
import { LeaseTenantsSection } from "@/components/leases/lease-tenants-section";
import { LeaseTermsSection } from "@/components/leases/lease-terms-section";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePropertyLongStayDetail } from "@/hooks/use-property-long-stay-detail";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { settingsApi, unitsApi } from "@/lib/api-client";
import {
  LEASE_DETAIL_TAB_LABELS,
  LEASE_DETAIL_TAB_URL_SCHEMA,
  LEASE_DETAIL_TABS,
  resolveLeaseDetailTab,
} from "@/lib/lease-detail-tab-schema";
import { buildLeaseRecordRentPrefill } from "@/lib/lease-record-rent-prefill";
import { queryKeys } from "@/lib/query-keys";
import { formatPropertyUnitSelectLabel, resolveRentIncomeLineTypeId } from "@/packages/shared";

export const PropertyLeaseDetailPage = memo(() => {
  const { leaseId, propertyId: routePropertyId } = useParams<{
    leaseId: string;
    propertyId: string;
  }>();
  const { permissions, propertyId: shellPropertyId } = usePropertyShell();
  const propertyId = routePropertyId ?? shellPropertyId;
  const canManage = permissions.canManageLedger;

  const { filters, setFilter } = useUrlFilterState(LEASE_DETAIL_TAB_URL_SCHEMA);
  const activeTab = resolveLeaseDetailTab(filters.tab);

  const [endLeaseOpen, setEndLeaseOpen] = useState(false);
  const [extendLeaseOpen, setExtendLeaseOpen] = useState(false);
  const [recordRentPrefill, setRecordRentPrefill] = useState<CreateIncomeLineDialogPrefill | null>(
    null
  );

  const {
    currentRent,
    isError,
    isPending,
    lease,
    primaryTenantContact,
    rentPeriods,
    rentSchedule,
    secondaryTenantContacts,
    termsEditability,
  } = usePropertyLongStayDetail(propertyId, leaseId);

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: queryKeys.propertyUnits(propertyId),
  });

  const settingsQuery = useQuery({
    queryFn: () => settingsApi.get(propertyId),
    queryKey: queryKeys.propertySettings(propertyId),
  });

  const unitLabel = useMemo(() => {
    if (!lease) {
      return "";
    }
    const unit = unitsQuery.data?.units.find((item) => item.id === lease.unitId);
    return unit ? formatPropertyUnitSelectLabel(unit) : lease.unitId;
  }, [lease, unitsQuery.data?.units]);

  const rentIncomeLineTypeId = useMemo(
    () => resolveRentIncomeLineTypeId(settingsQuery.data?.settings.incomeLineTypes ?? []),
    [settingsQuery.data?.settings.incomeLineTypes]
  );

  const incomeLineTypes = useMemo(
    () => settingsQuery.data?.settings.incomeLineTypes ?? [],
    [settingsQuery.data?.settings.incomeLineTypes]
  );

  const units = useMemo(() => unitsQuery.data?.units ?? [], [unitsQuery.data?.units]);

  const handleTabChange = useCallback(
    (value: string) => {
      setFilter("tab", value);
    },
    [setFilter]
  );

  const handleRecordRent = useCallback(
    (month?: string) => {
      if (!lease) {
        return;
      }
      setRecordRentPrefill(
        buildLeaseRecordRentPrefill(lease, rentIncomeLineTypeId, {
          month,
          rentSchedule,
        })
      );
    },
    [lease, rentIncomeLineTypeId, rentSchedule]
  );

  const handleEndLeaseSuccess = useCallback(() => {
    setEndLeaseOpen(false);
  }, []);

  if (!leaseId) {
    return <p className="text-muted-foreground text-sm">Invalid lease.</p>;
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    );
  }

  if (isError || !lease || !primaryTenantContact) {
    return (
      <div className="space-y-4">
        <Link
          className="text-muted-foreground text-sm hover:underline"
          to={`/properties/${propertyId}/leases`}
        >
          ← Back to leases
        </Link>
        <p className="text-destructive text-sm">Lease not found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <Link
          className="text-muted-foreground w-fit text-sm hover:underline"
          to={`/properties/${propertyId}/leases`}
        >
          ← Back to leases
        </Link>

        <LeaseDetailHeader
          canManage={canManage}
          currentRent={currentRent}
          lease={lease}
          onEndLease={() => setEndLeaseOpen(true)}
          onExtendLease={() => setExtendLeaseOpen(true)}
          unitLabel={unitLabel}
        />

        <Tabs onValueChange={handleTabChange} value={activeTab}>
          <TabsList>
            {LEASE_DETAIL_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {LEASE_DETAIL_TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <LeaseOverviewSection currentRent={currentRent} lease={lease} />
          </TabsContent>

          <TabsContent value="tenants">
            <LeaseTenantsSection
              canManage={canManage}
              lease={lease}
              primaryTenantContact={primaryTenantContact}
              propertyId={propertyId}
              secondaryTenantContacts={secondaryTenantContacts}
            />
          </TabsContent>

          <TabsContent value="payments">
            <LeasePaymentsSection
              canManage={canManage}
              isPending={isPending}
              lease={lease}
              onRecordRent={handleRecordRent}
              rentSchedule={rentSchedule}
            />
          </TabsContent>

          <TabsContent value="terms">
            <LeaseTermsSection
              canManage={canManage}
              lease={lease}
              propertyId={propertyId}
              rentPeriods={rentPeriods}
              termsEditability={termsEditability}
            />
          </TabsContent>
        </Tabs>
      </div>

      {endLeaseOpen ? (
        <EndLeaseDialog
          lease={lease}
          onOpenChange={(open) => {
            setEndLeaseOpen(open);
            if (!open) {
              handleEndLeaseSuccess();
            }
          }}
          open={true}
          propertyId={propertyId}
          rentPeriods={rentPeriods}
        />
      ) : null}

      {extendLeaseOpen ? (
        <ExtendLeaseDialog
          lease={lease}
          onOpenChange={setExtendLeaseOpen}
          open={true}
          propertyId={propertyId}
        />
      ) : null}

      {recordRentPrefill && lease ? (
        <CreateIncomeLineDialog
          incomeLineTypes={incomeLineTypes}
          key={`${lease.id}-${recordRentPrefill.transactionDate ?? "today"}`}
          lockedLease={lease}
          onOpenChange={(open) => {
            if (!open) {
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
PropertyLeaseDetailPage.displayName = "PropertyLeaseDetailPage";
