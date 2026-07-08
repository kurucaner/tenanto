import { cn } from "@/lib/utils";
import {
  ReservationChannel,
  ReservationStatus,
  type TReservationChannel,
  type TReservationStatus,
} from "@/packages/shared";

export const reservationSelectClassName = cn(
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30"
);

export const STATUS_OPTIONS: { label: string; value: TReservationStatus }[] = [
  { label: "Active", value: ReservationStatus.ACTIVE },
  { label: "Stayed", value: ReservationStatus.STAYED },
  { label: "Canceled", value: ReservationStatus.CANCELED },
  { label: "No Show", value: ReservationStatus.NO_SHOW },
];

export const CHANNEL_OPTIONS: { label: string; value: TReservationChannel }[] = [
  { label: "Airbnb", value: ReservationChannel.AIRBNB },
  { label: "Booking.com", value: ReservationChannel.BOOKING },
  { label: "Expedia", value: ReservationChannel.EXPEDIA },
  { label: "Direct", value: ReservationChannel.DIRECT },
];

export function formatChannelLabel(channel: TReservationChannel): string {
  return CHANNEL_OPTIONS.find((opt) => opt.value === channel)?.label ?? channel;
}

export function formatStatusLabel(status: TReservationStatus): string {
  return STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}
