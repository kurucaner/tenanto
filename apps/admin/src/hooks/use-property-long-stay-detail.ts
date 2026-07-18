import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { longStaysApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { resolveSecondaryTenantContactsForDisplay } from "@/lib/resolve-secondary-tenant-contacts-for-display";
import { getCurrentLeaseRent } from "@/packages/shared";

export function usePropertyLongStayDetail(propertyId: string, leaseId: string | undefined) {
  const detailQuery = useQuery({
    enabled: Boolean(propertyId && leaseId),
    queryFn: () => longStaysApi.get(propertyId, leaseId!),
    queryKey: queryKeys.propertyLongStay(propertyId, leaseId ?? ""),
  });

  const detail = detailQuery.data;
  const lease = detail?.longStay;
  const primaryTenantContact = detail?.primaryTenantContact;
  const rentSchedule = detail?.rentSchedule ?? [];
  const rentPeriods = useMemo(() => detail?.rentPeriods ?? [], [detail?.rentPeriods]);
  const secondaryTenantContacts = useMemo(
    () => resolveSecondaryTenantContactsForDisplay(detail?.secondaryTenantContacts),
    [detail?.secondaryTenantContacts]
  );
  const termsEditability = detail?.termsEditability ?? { editable: false };

  const currentRent = useMemo(() => {
    if (!lease) {
      return 0;
    }
    return getCurrentLeaseRent(lease.monthlyRent, rentPeriods, getTodayLocalIsoDate());
  }, [lease, rentPeriods]);

  return {
    currentRent,
    detail,
    isError: detailQuery.isError,
    isPending: detailQuery.isPending,
    lease,
    primaryTenantContact,
    rentPeriods,
    rentSchedule,
    secondaryTenantContacts,
    termsEditability,
  };
}
