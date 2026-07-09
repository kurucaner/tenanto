import { memo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { formatMoney } from "@/lib/format-money";
import { calculateStayNights } from "@/lib/reservation-date-utils";
import { getStayAverageDailyRate } from "@/packages/shared";

interface ReservationRoomTotalFieldProps {
  checkIn: string;
  checkOut: string;
  id: string;
  onChange: (value: string) => void;
  value: string;
}

export const ReservationRoomTotalField = memo(
  ({ checkIn, checkOut, id, onChange, value }: ReservationRoomTotalFieldProps) => {
    const nights = calculateStayNights(checkIn, checkOut);
    const roomTotal = Number(value) || 0;
    const avgDailyRate =
      nights > 0 && roomTotal > 0
        ? getStayAverageDailyRate({ nights, roomTotal })
        : null;

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Total room rate</Label>
        <Input
          id={id}
          inputMode="decimal"
          onChange={(e) => {
            if (isValidDecimalInput(e.target.value)) onChange(e.target.value);
          }}
          type="text"
          value={value}
        />
        {avgDailyRate !== null ? (
          <p className="text-muted-foreground text-xs">
            Avg {formatMoney(avgDailyRate)}/night · {nights} {nights === 1 ? "night" : "nights"}
          </p>
        ) : null}
      </div>
    );
  }
);
ReservationRoomTotalField.displayName = "ReservationRoomTotalField";
