import { z } from "zod";

import { optionalNonNegativeMoneyField } from "@/lib/money-field-validation";
import { isValidStayDateRange } from "@/lib/reservation-date-utils";
import { createPersonNameSchema } from "@/packages/app-ui";
import { type IPropertyReservation, ReservationStatus } from "@/packages/shared";

export const reservationFormSchema = z
  .object({
    channelCommissionId: z.uuid("Channel is required"),
    checkIn: z.string().min(1, "Check-in is required"),
    checkOut: z.string().min(1, "Check-out is required"),
    cleaningFee: optionalNonNegativeMoneyField("Cleaning fee must be a non-negative number"),
    guestName: createPersonNameSchema({ requiredMessage: "Guest name is required" }),
    reservationNumber: z.string(),
    roomTotal: optionalNonNegativeMoneyField("Room total must be a non-negative number"),
    status: z.enum([
      ReservationStatus.ACTIVE,
      ReservationStatus.CANCELED,
      ReservationStatus.NO_SHOW,
      ReservationStatus.STAYED,
    ]),
    unitId: z.string().min(1, "Unit is required"),
  })
  .superRefine((values, ctx) => {
    if (!isValidStayDateRange(values.checkIn, values.checkOut)) {
      ctx.addIssue({
        code: "custom",
        message: "Check-out must be after check-in",
        path: ["checkOut"],
      });
    }
  });

export type TReservationFormValues = z.infer<typeof reservationFormSchema>;

export function emptyReservationFormValues(
  defaultChannelCommissionId = ""
): TReservationFormValues {
  return {
    channelCommissionId: defaultChannelCommissionId,
    checkIn: "",
    checkOut: "",
    cleaningFee: "",
    guestName: "",
    reservationNumber: "",
    roomTotal: "",
    status: ReservationStatus.ACTIVE,
    unitId: "",
  };
}

export function reservationToFormValues(reservation: IPropertyReservation): TReservationFormValues {
  return {
    channelCommissionId: reservation.channelCommissionId,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    cleaningFee: String(reservation.cleaningFee),
    guestName: reservation.guestName,
    reservationNumber: reservation.reservationNumber ?? "",
    roomTotal: String(reservation.roomTotal),
    status: reservation.status,
    unitId: reservation.unitId,
  };
}
