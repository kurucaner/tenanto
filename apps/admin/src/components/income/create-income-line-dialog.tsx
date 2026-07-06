import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  formatIncomeLineTypeLabel,
  INCOME_LINE_TYPE_OPTIONS,
  incomeLineSelectClassName,
} from "@/components/income/income-line-form-options";
import { LinkToStayField, LockedStaySummary } from "@/components/income/link-to-stay-field";
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
import { buildStayLinkPickerFilters } from "@/lib/stay-link-picker-filters";
import {
  IncomeLineType,
  type IPropertyReservation,
  type TIncomeLineType,
} from "@/packages/shared";

export interface CreateIncomeLineDialogPrefill {
  guestName?: string;
  lineType?: TIncomeLineType;
  reservationId?: string;
  transactionDate?: string;
  unitId?: string;
}

interface CreateIncomeLineDialogProps {
  lockedStay?: IPropertyReservation | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  prefill?: CreateIncomeLineDialogPrefill | null;
  propertyId: string;
}

const defaultFormState = {
  amount: "",
  description: "",
  guestName: "",
  lineType: IncomeLineType.EXTRA_CLEANING as TIncomeLineType,
  reservationId: "",
  transactionDate: "",
  unitId: "",
};

export const CreateIncomeLineDialog = memo(
  ({ lockedStay, onOpenChange, open, prefill, propertyId }: CreateIncomeLineDialogProps) => {
    const queryClient = useQueryClient();
    const [lineType, setLineType] = useState<TIncomeLineType>(defaultFormState.lineType);
    const [unitId, setUnitId] = useState(defaultFormState.unitId);
    const [amount, setAmount] = useState(defaultFormState.amount);
    const [transactionDate, setTransactionDate] = useState(defaultFormState.transactionDate);
    const [reservationId, setReservationId] = useState(defaultFormState.reservationId);
    const [description, setDescription] = useState(defaultFormState.description);
    const [guestName, setGuestName] = useState(defaultFormState.guestName);

    useEffect(() => {
      if (!open) return;
      setLineType(prefill?.lineType ?? defaultFormState.lineType);
      setUnitId(prefill?.unitId ?? lockedStay?.unitId ?? defaultFormState.unitId);
      setAmount(defaultFormState.amount);
      setTransactionDate(
        prefill?.transactionDate ?? lockedStay?.checkOut ?? defaultFormState.transactionDate
      );
      setReservationId(
        prefill?.reservationId ?? lockedStay?.id ?? defaultFormState.reservationId
      );
      setDescription(defaultFormState.description);
      setGuestName(prefill?.guestName ?? lockedStay?.guestName ?? defaultFormState.guestName);
    }, [lockedStay, open, prefill]);

    const unitsQuery = useQuery({
      enabled: open,
      queryFn: () => unitsApi.list(propertyId),
      queryKey: adminQueryKeys.propertyUnits(propertyId),
    });

    const pickerFilters = useMemo(
      () =>
        buildStayLinkPickerFilters({
          includeReservationId: reservationId || undefined,
          transactionDate: transactionDate || undefined,
          unitId,
        }),
      [reservationId, transactionDate, unitId]
    );

    const reservationsQuery = useQuery({
      enabled: open && unitId !== "" && !lockedStay,
      queryFn: () => reservationsApi.list(propertyId, pickerFilters),
      queryKey: adminQueryKeys.propertyReservations(propertyId, pickerFilters),
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
    };

    const units = unitsQuery.data?.units ?? [];
    const linkedReservation = useMemo(() => {
      if (lockedStay) return lockedStay;
      if (!reservationId) return null;
      return reservationsQuery.data?.reservations.find((r) => r.id === reservationId) ?? null;
    }, [lockedStay, reservationId, reservationsQuery.data?.reservations]);

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
              {lockedStay
                ? `Add income linked to ${lockedStay.guestName}'s stay.`
                : "Record cleaning, extra services, or other non-stay revenue."}
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
                disabled={Boolean(lockedStay)}
                id="income-line-unit"
                onChange={(e) => {
                  setUnitId(e.target.value);
                  if (!lockedStay) setReservationId("");
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

            {lockedStay ? (
              <LockedStaySummary stay={lockedStay} />
            ) : (
              <LinkToStayField
                id="income-line-reservation"
                onReservationIdChange={setReservationId}
                propertyId={propertyId}
                reservationId={reservationId}
                transactionDate={transactionDate}
                unitId={unitId}
              />
            )}

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
