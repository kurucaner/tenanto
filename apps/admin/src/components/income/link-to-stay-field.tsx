import { useQuery } from "@tanstack/react-query";
import { memo, useMemo } from "react";

import { FieldLabel } from "@/components/ui/field-label";
import { NativeSelect } from "@/components/ui/native-select";
import { reservationsApi } from "@/lib/api-client";
import { isPropertyAmenityUnit } from "@/lib/property-amenity-unit";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  buildStayLinkPickerFilters,
  RECENT_STAY_PICKER_DAYS,
  STAY_PICKER_DATE_WINDOW_DAYS,
} from "@/lib/stay-link-picker-filters";
import type { IPropertyLongStay, IPropertyReservation } from "@/packages/shared";

import { Label } from "../ui/label";

interface LinkToStayFieldProps {
  disabled?: boolean;
  id: string;
  includeReservationId?: string;
  onReservationIdChange: (reservationId: string) => void;
  propertyId: string;
  reservationId: string;
  transactionDate: string;
  unitId: string;
}

function formatStayOptionLabel(reservation: IPropertyReservation): string {
  const numberSuffix = reservation.reservationNumber ? ` · #${reservation.reservationNumber}` : "";
  return `${reservation.guestName}${numberSuffix} · ${reservation.checkIn} → ${reservation.checkOut}`;
}

function getLinkToStayHelperMessage(
  unitId: string,
  isPending: boolean,
  reservationCount: number,
  helperText: string
): string {
  if (unitId === "") {
    return "Select a unit to see matching stays.";
  }
  if (isPropertyAmenityUnit(unitId)) {
    return "Property amenity income is not linked to a unit or stay.";
  }
  if (isPending) {
    return "Loading stays…";
  }
  if (reservationCount === 0) {
    return "No matching stays found. Adjust the date or leave unlinked.";
  }
  return `Showing stays for this unit. ${helperText}`;
}

export const LinkToStayField = memo(
  ({
    disabled = false,
    id,
    includeReservationId,
    onReservationIdChange,
    propertyId,
    reservationId,
    transactionDate,
    unitId,
  }: LinkToStayFieldProps) => {
    const pickerFilters = useMemo(
      () =>
        buildStayLinkPickerFilters({
          includeReservationId: includeReservationId || reservationId || undefined,
          transactionDate: transactionDate || undefined,
          unitId,
        }),
      [includeReservationId, reservationId, transactionDate, unitId]
    );

    const reservationsQuery = useQuery({
      enabled: unitId !== "" && !isPropertyAmenityUnit(unitId),
      queryFn: () => reservationsApi.list(propertyId, pickerFilters),
      queryKey: adminQueryKeys.propertyReservationPicker(propertyId, pickerFilters),
    });

    const reservations = reservationsQuery.data?.reservations ?? [];
    const helperText = transactionDate
      ? `Showing stays within ±${STAY_PICKER_DATE_WINDOW_DAYS} days of the selected date.`
      : `Showing stays from the last ${RECENT_STAY_PICKER_DAYS} days.`;
    const statusMessage = getLinkToStayHelperMessage(
      unitId,
      reservationsQuery.isPending,
      reservations.length,
      helperText
    );

    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={id} optional>
          Link to stay
        </FieldLabel>
        <NativeSelect
          disabled={
            disabled ||
            unitId === "" ||
            isPropertyAmenityUnit(unitId) ||
            reservationsQuery.isPending
          }
          emptyOptionLabel="No linked stay"
          id={id}
          onChange={(e) => onReservationIdChange(e.target.value)}
          options={reservations.map((reservation) => ({
            label: formatStayOptionLabel(reservation),
            value: reservation.id,
          }))}
          value={reservationId}
        />
        <p className="text-muted-foreground text-xs">{statusMessage}</p>
      </div>
    );
  }
);
LinkToStayField.displayName = "LinkToStayField";

interface LockedLeaseSummaryProps {
  lease: IPropertyLongStay;
}

export const LockedLeaseSummary = memo(({ lease }: LockedLeaseSummaryProps) => (
  <div className="flex flex-col gap-1.5">
    <Label>Linked lease</Label>
    <div className="bg-muted/50 rounded-md border px-3 py-2 text-sm">
      <p className="font-medium">{lease.guestName}</p>
      <p className="text-muted-foreground text-xs">
        {lease.leaseStartDate} → {lease.actualEndDate ?? lease.leaseEndDate}
      </p>
    </div>
  </div>
));
LockedLeaseSummary.displayName = "LockedLeaseSummary";

interface LockedStaySummaryProps {
  stay: IPropertyReservation;
}

export const LockedStaySummary = memo(({ stay }: LockedStaySummaryProps) => (
  <div className="flex flex-col gap-1.5">
    <Label>Linked stay</Label>
    <div className="bg-muted/50 rounded-md border px-3 py-2 text-sm">
      <p className="font-medium">{stay.guestName}</p>
      <p className="text-muted-foreground text-xs">
        {stay.checkIn} → {stay.checkOut}
        {stay.reservationNumber ? ` · #${stay.reservationNumber}` : ""}
      </p>
    </div>
  </div>
));
LockedStaySummary.displayName = "LockedStaySummary";
