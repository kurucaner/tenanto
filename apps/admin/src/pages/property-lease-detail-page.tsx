import { useQuery } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  CreateIncomeLineDialog,
  type CreateIncomeLineDialogPrefill,
} from "@/components/income/create-income-line-dialog";
import { EndLeaseDialog } from "@/components/leases/end-lease-dialog";
import { ExtendLeaseDialog } from "@/components/leases/extend-lease-dialog";
import { LeaseDepositCloseOutDialog } from "@/components/leases/lease-deposit-close-out-dialog";
import { LeaseDepositSection } from "@/components/leases/lease-deposit-section";
import { LeaseDetailActions, LeaseDetailHeader } from "@/components/leases/lease-detail-header";
import { LeaseOverviewSection } from "@/components/leases/lease-overview-section";
import { LeasePaymentsSection } from "@/components/leases/lease-payments-section";
import { LeaseTenantsSection } from "@/components/leases/lease-tenants-section";
import { LeaseTermsSection } from "@/components/leases/lease-terms-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UrlSyncedTabs, UrlSyncedTabsContent } from "@/components/url-synced-tabs";
import { usePropertyLongStayDetail } from "@/hooks/use-property-long-stay-detail";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { useUrlTabState } from "@/hooks/use-url-tab-state";
import { settingsApi, unitsApi } from "@/lib/api-client";
import { buildLeaseRecordDepositPrefill } from "@/lib/build-lease-record-deposit-prefill";
import { formatMoney } from "@/lib/format-money";
import { LEASE_DETAIL_TAB_DEFINITIONS, LEASE_DETAIL_TABS } from "@/lib/lease-detail-tab-schema";
import { buildLeaseRecordRentPrefill } from "@/lib/lease-record-rent-prefill";
import { queryKeys } from "@/lib/query-keys";
import {
  formatPropertyUnitSelectLabel,
  needsLeaseDepositCloseOut,
  PropertyLongStayStatus,
} from "@/packages/shared";

export const PropertyLeaseDetailPage = memo(() => {
  const { leaseId, propertyId: routePropertyId } = useParams<{
    leaseId: string;
    propertyId: string;
  }>();
  const { permissions, propertyId: shellPropertyId } = usePropertyShell();
  const propertyId = routePropertyId ?? shellPropertyId;
  const canManage = permissions.canManageLedger;

  const { activeTab, setActiveTab } = useUrlTabState(LEASE_DETAIL_TABS, "overview");

  const [endLeaseOpen, setEndLeaseOpen] = useState(false);
  const [extendLeaseOpen, setExtendLeaseOpen] = useState(false);
  const [depositCloseOutOpen, setDepositCloseOutOpen] = useState(false);
  const [recordIncomePrefill, setRecordIncomePrefill] =
    useState<CreateIncomeLineDialogPrefill | null>(null);

  const {
    currentRent,
    depositSummary,
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

  const incomeLineTypes = useMemo(
    () => settingsQuery.data?.settings.incomeLineTypes ?? [],
    [settingsQuery.data?.settings.incomeLineTypes]
  );

  const units = useMemo(() => unitsQuery.data?.units ?? [], [unitsQuery.data?.units]);

  const showDepositCloseOutCta = useMemo(() => {
    if (!lease || !depositSummary || !canManage) {
      return false;
    }
    return (
      lease.status === PropertyLongStayStatus.ENDED && needsLeaseDepositCloseOut(depositSummary)
    );
  }, [canManage, depositSummary, lease]);

  const handleRecordRent = useCallback(
    (periodKey?: string) => {
      if (!lease) {
        return;
      }
      setRecordIncomePrefill(
        buildLeaseRecordRentPrefill(lease, {
          periodKey,
          rentSchedule,
        })
      );
    },
    [lease, rentSchedule]
  );

  const handleRecordDeposit = useCallback(() => {
    if (!lease || !depositSummary) {
      return;
    }
    setRecordIncomePrefill(buildLeaseRecordDepositPrefill(lease, depositSummary));
  }, [depositSummary, lease]);

  const handleEndedWithDepositCloseOut = useCallback(() => {
    setDepositCloseOutOpen(true);
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

  if (isError || !lease || !primaryTenantContact || !depositSummary) {
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="text-muted-foreground w-fit text-sm hover:underline"
            to={`/properties/${propertyId}/leases`}
          >
            ← Back to leases
          </Link>
          <LeaseDetailActions
            canManage={canManage}
            lease={lease}
            onEndLease={() => setEndLeaseOpen(true)}
            onExtendLease={() => setExtendLeaseOpen(true)}
          />
        </div>

        <LeaseDetailHeader currentRent={currentRent} lease={lease} unitLabel={unitLabel} />

        {showDepositCloseOutCta ? (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Security deposit still needs settlement
                </p>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                  {formatMoney(depositSummary.collected)} collected — refund and/or withhold to
                  settle.
                </p>
              </div>
              <Button
                className="shrink-0"
                onClick={() => setDepositCloseOutOpen(true)}
                type="button"
                variant="outline"
              >
                Settle deposit
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <UrlSyncedTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={LEASE_DETAIL_TAB_DEFINITIONS}
        >
          <UrlSyncedTabsContent value="overview">
            <LeaseOverviewSection lease={lease} />
          </UrlSyncedTabsContent>

          <UrlSyncedTabsContent value="tenants">
            <LeaseTenantsSection
              canManage={canManage}
              lease={lease}
              primaryTenantContact={primaryTenantContact}
              propertyId={propertyId}
              secondaryTenantContacts={secondaryTenantContacts}
            />
          </UrlSyncedTabsContent>

          <UrlSyncedTabsContent value="payments">
            <div className="space-y-4">
              <LeaseDepositSection
                canManage={canManage}
                depositSummary={depositSummary}
                lease={lease}
                onRecordDeposit={handleRecordDeposit}
                propertyId={propertyId}
              />
              <LeasePaymentsSection
                canManage={canManage}
                isPending={isPending}
                lease={lease}
                onRecordRent={handleRecordRent}
                rentSchedule={rentSchedule}
              />
            </div>
          </UrlSyncedTabsContent>

          <UrlSyncedTabsContent value="terms">
            <LeaseTermsSection
              canManage={canManage}
              lease={lease}
              propertyId={propertyId}
              rentPeriods={rentPeriods}
              termsEditability={termsEditability}
            />
          </UrlSyncedTabsContent>
        </UrlSyncedTabs>
      </div>

      {endLeaseOpen ? (
        <EndLeaseDialog
          depositSummary={depositSummary}
          lease={lease}
          onEndedWithDepositCloseOut={handleEndedWithDepositCloseOut}
          onOpenChange={setEndLeaseOpen}
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

      {depositCloseOutOpen ? (
        <LeaseDepositCloseOutDialog
          depositSummary={depositSummary}
          longStayId={lease.id}
          onOpenChange={setDepositCloseOutOpen}
          open={true}
          propertyId={propertyId}
        />
      ) : null}

      {recordIncomePrefill && lease ? (
        <CreateIncomeLineDialog
          incomeLineTypes={incomeLineTypes}
          key={`${lease.id}-${recordIncomePrefill.isSecurityDeposit ? "deposit" : "rent"}-${recordIncomePrefill.rentPeriodKey ?? recordIncomePrefill.transactionDate ?? "today"}`}
          lockedLease={lease}
          onOpenChange={(open) => {
            if (!open) {
              setRecordIncomePrefill(null);
            }
          }}
          open={true}
          prefill={recordIncomePrefill}
          propertyId={propertyId}
          units={units}
        />
      ) : null}
    </>
  );
});
PropertyLeaseDetailPage.displayName = "PropertyLeaseDetailPage";
