import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  IncomeLineAmountDateFields,
  IncomeLineDescriptionField,
  IncomeLineGuestField,
  IncomeLineTypeField,
  IncomeLineUnitSection,
} from "@/components/income/income-line-form-fields";
import { buildIncomeLineTypeOptions } from "@/components/income/income-line-form-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PROPERTY_AMENITY_UNIT_VALUE } from "@/components/units/income-unit-select-options";
import { incomeLinesApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import {
  type IPropertyIncomeLine,
  type IPropertyIncomeLineType,
  type IPropertyUnit,
} from "@/packages/shared";

interface EditIncomeLineDialogProps {
  incomeLine: IPropertyIncomeLine;
  incomeLineTypes: IPropertyIncomeLineType[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
  units: IPropertyUnit[];
}

const FIELD_ID_PREFIX = "edit-income-line";

export const EditIncomeLineDialog = memo(
  ({
    incomeLine,
    incomeLineTypes,
    onOpenChange,
    open,
    propertyId,
    units,
  }: EditIncomeLineDialogProps) => {
    const queryClient = useQueryClient();
    const incomeLineTypeOptions = useMemo(
      () => buildIncomeLineTypeOptions(incomeLineTypes),
      [incomeLineTypes]
    );
    const [incomeLineTypeId, setIncomeLineTypeId] = useState(incomeLine.incomeLineTypeId);
    const [unitId, setUnitId] = useState(incomeLine.unitId ?? PROPERTY_AMENITY_UNIT_VALUE);
    const [amount, setAmount] = useState(String(incomeLine.amount));
    const [transactionDate, setTransactionDate] = useState(incomeLine.transactionDate);
    const [reservationId, setReservationId] = useState(incomeLine.reservationId ?? "");
    const [description, setDescription] = useState(incomeLine.description ?? "");
    const [guestName, setGuestName] = useState(incomeLine.guestName ?? "");

    const handleUnitChange = useCallback((nextUnitId: string) => {
      setUnitId(nextUnitId);
      setReservationId("");
    }, []);

    const mutation = useMutation({
      mutationFn: () =>
        incomeLinesApi.update(propertyId, incomeLine.id, {
          amount: Number(amount) || 0,
          description: description.trim() || null,
          guestName: guestName.trim() || null,
          incomeLineTypeId,
          reservationId: reservationId || null,
          transactionDate,
          unitId: unitId === PROPERTY_AMENITY_UNIT_VALUE ? null : unitId,
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

    const canSubmit =
      unitId !== "" &&
      transactionDate !== "" &&
      amount !== "" &&
      incomeLineTypeId !== "" &&
      !mutation.isPending;

    const showGuestField = reservationId === "";

    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Other Income</DialogTitle>
            <DialogDescription>
              Current amount: {formatMoney(incomeLine.amount)} on {incomeLine.transactionDate}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            <IncomeLineTypeField
              fieldIdPrefix={FIELD_ID_PREFIX}
              onChange={setIncomeLineTypeId}
              options={incomeLineTypeOptions}
              value={incomeLineTypeId}
            />

            <IncomeLineUnitSection
              fieldIdPrefix={FIELD_ID_PREFIX}
              includePropertyAmenityOption
              onReservationIdChange={setReservationId}
              onUnitChange={handleUnitChange}
              propertyId={propertyId}
              reservationId={reservationId}
              transactionDate={transactionDate}
              unitId={unitId}
              units={units}
            />

            <IncomeLineAmountDateFields
              amount={amount}
              fieldIdPrefix={FIELD_ID_PREFIX}
              onAmountChange={setAmount}
              onDateChange={setTransactionDate}
              transactionDate={transactionDate}
            />

            {showGuestField ? (
              <IncomeLineGuestField
                fieldIdPrefix={FIELD_ID_PREFIX}
                onChange={setGuestName}
                value={guestName}
              />
            ) : null}

            <IncomeLineDescriptionField
              fieldIdPrefix={FIELD_ID_PREFIX}
              onChange={setDescription}
              value={description}
            />
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
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
EditIncomeLineDialog.displayName = "EditIncomeLineDialog";
