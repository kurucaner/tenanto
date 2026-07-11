import {
  ReservationChannel,
  ReservationStatus,
  type TReservationChannel,
  type TReservationStatus,
} from "@/packages/shared";

export { nativeSelectClassName as reservationSelectClassName } from "@/lib/native-select-class-name";

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
