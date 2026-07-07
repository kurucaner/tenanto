import { memo } from "react";

import { ColoredPill } from "@/components/income/colored-pill";
import { formatChannelLabel } from "@/components/income/reservation-form-options";
import { ReservationChannel, type TReservationChannel } from "@/packages/shared";

const CHANNEL_CLASS_NAMES: Record<TReservationChannel, string> = {
  [ReservationChannel.AIRBNB]: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  [ReservationChannel.BOOKING]: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  [ReservationChannel.DIRECT]:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  [ReservationChannel.EXPEDIA]:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

interface ReservationChannelBadgeProps {
  channel: TReservationChannel;
}

export const ReservationChannelBadge = memo(({ channel }: ReservationChannelBadgeProps) => (
  <ColoredPill className={CHANNEL_CLASS_NAMES[channel]}>{formatChannelLabel(channel)}</ColoredPill>
));
ReservationChannelBadge.displayName = "ReservationChannelBadge";
