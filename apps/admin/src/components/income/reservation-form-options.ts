import { type IPropertyChannelCommission, ReservationStatus, type TReservationStatus } from "@/packages/shared";

export const STATUS_OPTIONS: { label: string; value: TReservationStatus }[] = [
  { label: "Active", value: ReservationStatus.ACTIVE },
  { label: "Stayed", value: ReservationStatus.STAYED },
  { label: "Canceled", value: ReservationStatus.CANCELED },
  { label: "No Show", value: ReservationStatus.NO_SHOW },
];

export function buildChannelOptions(
  channelCommissions: IPropertyChannelCommission[]
): { label: string; value: string }[] {
  return channelCommissions.map((channel) => ({
    label: channel.name,
    value: channel.id,
  }));
}

export function formatStatusLabel(status: TReservationStatus): string {
  return STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}
