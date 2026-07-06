import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  formatIncomeLineTypeLabel,
  INCOME_LINE_TYPE_OPTIONS,
  incomeLineSelectClassName,
} from "@/components/income/income-line-form-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { incomeLinesApi, reservationsApi, unitsApi } from "@/lib/api-client";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import { IncomeLineType, type TIncomeLineType } from "@/packages/shared";

interface CreateIncomeLineDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const CreateIncomeLineDialog = memo(
  ({ onOpenChange, open, propertyId }: CreateIncomeLineDialogProps) => {
    const queryClient = useQueryClient();
    const [lineType, setLineType] = useState<TIncomeLineType>(IncomeLineType.EXTRA_CLEANING);
    const [unitId, setUnitId] = useState("");
    const [amount, setAmount] = useState("");
    const [transactionDate, setTransactionDate] = useState("");
    const [reservationId, setReservationId] = useState("");
    const [description, setDescription] = useState("");
    const [guestName, setGuestName] = useState("");

    const unitsQuery = useQuery({
      enabled: open,
      queryFn: () => unitsApi.list(propertyId),
      queryKey: adminQueryKeys.propertyUnits(propertyId),
    });

    const reservationsQuery = useQuery({
      enabled: open && unitId !== "",
      queryFn: () => reservationsApi.list(propertyId, { unitId }),
      queryKey: adminQueryKeys.propertyReservations(propertyId, { unitId }),
    });

    const mutation = useMutation({
      mutationFn: () =>
        incomeLinesApi.create(propertyId, {
          amount: Number(amount) || 0,
          description: description.trim() || undefined,
          guestName: guestName.trim() || undefined,
          lineType,
          reservationId: reservationId || undefined,
          transactionDate,
          unitId,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create other income");
      },
      onSuccess: () => {
        toast.success("Other income created");
        invalidatePropertyIncomeCaches(queryClient, propertyId);
        handleClose();
      },
    });

    const handleClose = () => {
      onOpenChange(false);
      setLineType(IncomeLineType.EXTRA_CLEANING);
      setUnitId("");
      setAmount("");
      setTransactionDate("");
      setReservationId("");
      setDescription("");
      setGuestName("");
    };

    const units = unitsQuery.data?.units ?? [];
    const reservations = reservationsQuery.data?.reservations ?? [];
    const linkedReservation = useMemo(
      () => reservations.find((r) => r.id === reservationId),
      [reservationId, reservations]
    );

    const canSubmit =
      unitId !== "" &&
      transactionDate !== "" &&
      amount !== "" &&
      !mutation.isPending;

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add Other Income</DialogTitle>
            <DialogDescription>
              Record cleaning, extra services, or other non-stay revenue.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="income-line-type">Income type</Label>
              <select
                className={incomeLineSelectClassName}
                id="income-line-type"
                onChange={(e) => setLineType(e.target.value as TIncomeLineType)}
                value={lineType}
              >
                {INCOME_LINE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="income-line-unit">Unit</Label>
              <select
                className={incomeLineSelectClassName}
                id="income-line-unit"
                onChange={(e) => {
                  setUnitId(e.target.value);
                  setReservationId("");
                }}
                value={unitId}
              >
                <option value="">Select unit…</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitNumber} ({unit.layout})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="income-line-amount">Amount</Label>
                <Input
                  autoFocus
                  id="income-line-amount"
                  inputMode="decimal"
                  onChange={(e) => setAmount(e.target.value)}
                  type="text"
                  value={amount}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="income-line-date">Date</Label>
                <Input
                  id="income-line-date"
                  onChange={(e) => setTransactionDate(e.target.value)}
                  type="date"
                  value={transactionDate}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="income-line-reservation">Link to stay (optional)</Label>
              <select
                className={incomeLineSelectClassName}
                disabled={unitId === ""}
                id="income-line-reservation"
                onChange={(e) => setReservationId(e.target.value)}
                value={reservationId}
              >
                <option value="">No linked stay</option>
                {reservations.map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>
                    {reservation.guestName} · {reservation.checkIn} → {reservation.checkOut}
                  </option>
                ))}
              </select>
            </div>

            {!linkedReservation ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="income-line-guest">Guest name (optional)</Label>
                <Input
                  id="income-line-guest"
                  onChange={(e) => setGuestName(e.target.value)}
                  value={guestName}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="income-line-description">Description (optional)</Label>
              <Input
                id="income-line-description"
                onChange={(e) => setDescription(e.target.value)}
                value={description}
              />
            </div>

            <p className="text-muted-foreground text-xs">
              {formatIncomeLineTypeLabel(lineType)}: no taxes or channel commission applied.
            </p>
          </div>

          <DialogFooter>
            <Button disabled={mutation.isPending} onClick={handleClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()} type="button">
              {mutation.isPending ? "Creating…" : "Add Other Income"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateIncomeLineDialog.displayName = "CreateIncomeLineDialog";
