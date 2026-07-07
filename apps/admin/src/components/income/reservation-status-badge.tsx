import { memo } from "react";

import { ColoredPill } from "@/components/income/colored-pill";
import { formatStatusLabel } from "@/components/income/reservation-form-options";
import { ReservationStatus, type TReservationStatus } from "@/packages/shared";

const STATUS_CLASS_NAMES: Record<TReservationStatus, string> = {
  [ReservationStatus.ACTIVE]:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  [ReservationStatus.CANCELED]:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  [ReservationStatus.NO_SHOW]:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  [ReservationStatus.STAYED]:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

interface ReservationStatusBadgeProps {
  status: TReservationStatus;
}

export const ReservationStatusBadge = memo(({ status }: ReservationStatusBadgeProps) => (
  <ColoredPill className={STATUS_CLASS_NAMES[status]}>{formatStatusLabel(status)}</ColoredPill>
));
ReservationStatusBadge.displayName = "ReservationStatusBadge";
