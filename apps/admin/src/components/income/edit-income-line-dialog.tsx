import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  INCOME_LINE_TYPE_OPTIONS,
  incomeLineSelectClassName,
} from "@/components/income/income-line-form-options";
import { LinkToStayField } from "@/components/income/link-to-stay-field";
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
import { IncomeUnitSelectOptions } from "@/components/units/income-unit-select-options";
import { incomeLinesApi, reservationsApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import { buildStayLinkPickerFilters } from "@/lib/stay-link-picker-filters";
import {
  type IPropertyIncomeLine,
  type IPropertyUnit,
  isAmenityUnit,
  type TIncomeLineType,
} from "@/packages/shared";

interface EditIncomeLineDialogProps {
  incomeLine: IPropertyIncomeLine;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
  units: IPropertyUnit[];
}

export const EditIncomeLineDialog = memo(
  ({ incomeLine, onOpenChange, open, propertyId, units }: EditIncomeLineDialogProps) => {
    const queryClient = useQueryClient();
    const [lineType, setLineType] = useState<TIncomeLineType>(incomeLine.lineType);
    const [unitId, setUnitId] = useState(incomeLine.unitId);
    const [amount, setAmount] = useState(String(incomeLine.amount));
    const [transactionDate, setTransactionDate] = useState(incomeLine.transactionDate);
    const [reservationId, setReservationId] = useState(incomeLine.reservationId ?? "");
    const [description, setDescription] = useState(incomeLine.description ?? "");
    const [guestName, setGuestName] = useState(incomeLine.guestName ?? "");

    const selectedUnit = units.find((unit) => unit.id === unitId);
    const forAmenityUnit = selectedUnit != null && isAmenityUnit(selectedUnit);

    const pickerFilters = useMemo(
      () =>
        buildStayLinkPickerFilters({
          forAmenityUnit,
          includeReservationId: reservationId || undefined,
          transactionDate: transactionDate || undefined,
          unitId,
        }),
      [forAmenityUnit, reservationId, transactionDate, unitId]
    );

    const reservationsQuery = useQuery({
      enabled: open && unitId !== "",
      queryFn: () => reservationsApi.list(propertyId, pickerFilters),
      queryKey: adminQueryKeys.propertyReservations(propertyId, pickerFilters),
    });

    const mutation = useMutation({
      mutationFn: () =>
        incomeLinesApi.update(propertyId, incomeLine.id, {
          amount: Number(amount) || 0,
          description: description.trim() || null,
          guestName: guestName.trim() || null,
          lineType,
          reservationId: reservationId || null,
          transactionDate,
          unitId,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update other income");
      },
      onSuccess: () => {
        toast.success("Other income updated");
        invalidatePropertyIncomeCaches(queryClient, propertyId);
        onOpenChange(false);
      },
    });

    const linkedReservation = useMemo(() => {
      if (!reservationId) return null;
      return reservationsQuery.data?.reservations.find((r) => r.id === reservationId) ?? null;
    }, [reservationId, reservationsQuery.data?.reservations]);

    const canSubmit =
      unitId !== "" &&
      transactionDate !== "" &&
      amount !== "" &&
      !mutation.isPending;

    return (
      <Dialog onOpenChange={() => onOpenChange(false)} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Other Income</DialogTitle>
            <DialogDescription>Update misc income details and amount.</DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-income-line-type">Income type</Label>
              <select
                className={incomeLineSelectClassName}
                id="edit-income-line-type"
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
              <Label htmlFor="edit-income-line-unit">Unit</Label>
              <select
                className={incomeLineSelectClassName}
                id="edit-income-line-unit"
                onChange={(e) => {
                  setUnitId(e.target.value);
                  setReservationId("");
                }}
                value={unitId}
              >
                <IncomeUnitSelectOptions units={units} />
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-income-line-amount">Amount</Label>
                <Input
                  autoFocus
                  id="edit-income-line-amount"
                  inputMode="decimal"
                  onChange={(e) => setAmount(e.target.value)}
                  type="text"
                  value={amount}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-income-line-date">Date</Label>
                <Input
                  id="edit-income-line-date"
                  onChange={(e) => setTransactionDate(e.target.value)}
                  type="date"
                  value={transactionDate}
                />
              </div>
            </div>

            <LinkToStayField
              forAmenityUnit={forAmenityUnit}
              id="edit-income-line-reservation"
              includeReservationId={incomeLine.reservationId ?? undefined}
              onReservationIdChange={setReservationId}
              propertyId={propertyId}
              reservationId={reservationId}
              transactionDate={transactionDate}
              unitId={unitId}
            />

            {!linkedReservation ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-income-line-guest">Guest name (optional)</Label>
                <Input
                  id="edit-income-line-guest"
                  onChange={(e) => setGuestName(e.target.value)}
                  value={guestName}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-income-line-description">Description (optional)</Label>
              <Input
                id="edit-income-line-description"
                onChange={(e) => setDescription(e.target.value)}
                value={description}
              />
            </div>

            <p className="text-muted-foreground text-xs">
              Current net: {formatMoney(incomeLine.netIncome)} (recalculated on save)
            </p>
          </div>

          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()} type="button">
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
EditIncomeLineDialog.displayName = "EditIncomeLineDialog";
