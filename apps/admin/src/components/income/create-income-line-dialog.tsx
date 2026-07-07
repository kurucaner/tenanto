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
import {
  buildIncomeLineTypeOptions,
  formatIncomeLineTypeLabel,
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
import { incomeLinesApi } from "@/lib/api-client";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import {
  type IPropertyIncomeLineType,
  type IPropertyReservation,
  type IPropertyUnit,
  resolveDefaultIncomeLineTypeId,
} from "@/packages/shared";

export interface CreateIncomeLineDialogPrefill {
  guestName?: string;
  incomeLineTypeId?: string;
  reservationId?: string;
  transactionDate?: string;
  unitId?: string;
}

interface CreateIncomeLineDialogProps {
  incomeLineTypes: IPropertyIncomeLineType[];
  lockedStay?: IPropertyReservation | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  prefill?: CreateIncomeLineDialogPrefill | null;
  propertyId: string;
  units?: IPropertyUnit[];
}

const FIELD_ID_PREFIX = "income-line";

function buildFormState(
  incomeLineTypes: IPropertyIncomeLineType[],
  prefill?: CreateIncomeLineDialogPrefill | null,
  lockedStay?: IPropertyReservation | null
) {
  const defaultIncomeLineTypeId = resolveDefaultIncomeLineTypeId(incomeLineTypes);

  return {
    amount: "",
    description: "",
    guestName: prefill?.guestName ?? lockedStay?.guestName ?? "",
    incomeLineTypeId: prefill?.incomeLineTypeId ?? defaultIncomeLineTypeId,
    reservationId: prefill?.reservationId ?? lockedStay?.id ?? "",
    transactionDate: prefill?.transactionDate ?? lockedStay?.checkOut ?? "",
    unitId: prefill?.unitId ?? lockedStay?.unitId ?? "",
  };
}

interface CreateIncomeLineDialogFormProps {
  incomeLineTypes: IPropertyIncomeLineType[];
  lockedStay?: IPropertyReservation | null;
  onClose: () => void;
  prefill?: CreateIncomeLineDialogPrefill | null;
  propertyId: string;
  units?: IPropertyUnit[];
}

const CreateIncomeLineDialogForm = memo(
  ({
    incomeLineTypes,
    lockedStay,
    onClose,
    prefill,
    propertyId,
    units,
  }: CreateIncomeLineDialogFormProps) => {
    const initialFormState = buildFormState(incomeLineTypes, prefill, lockedStay);
    const queryClient = useQueryClient();
    const incomeLineTypeOptions = useMemo(
      () => buildIncomeLineTypeOptions(incomeLineTypes),
      [incomeLineTypes]
    );
    const [incomeLineTypeId, setIncomeLineTypeId] = useState(initialFormState.incomeLineTypeId);
    const [unitId, setUnitId] = useState(initialFormState.unitId);
    const [amount, setAmount] = useState(initialFormState.amount);
    const [transactionDate, setTransactionDate] = useState(initialFormState.transactionDate);
    const [reservationId, setReservationId] = useState(initialFormState.reservationId);
    const [description, setDescription] = useState(initialFormState.description);
    const [guestName, setGuestName] = useState(initialFormState.guestName);

    const handleUnitChange = useCallback(
      (nextUnitId: string) => {
        setUnitId(nextUnitId);
        if (!lockedStay) setReservationId("");
      },
      [lockedStay]
    );

    const mutation = useMutation({
      mutationFn: () =>
        incomeLinesApi.create(propertyId, {
          amount: Number(amount) || 0,
          description: description.trim() || undefined,
          guestName: guestName.trim() || undefined,
          incomeLineTypeId,
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
        onClose();
      },
    });

    const canSubmit =
      unitId !== "" &&
      transactionDate !== "" &&
      amount !== "" &&
      incomeLineTypeId !== "" &&
      !mutation.isPending;

    const showGuestField = !lockedStay && reservationId === "";

    return (
      <>
        <DialogHeader>
          <DialogTitle>Add Other Income</DialogTitle>
          <DialogDescription>
            {lockedStay
              ? `Add income linked to ${lockedStay.guestName}'s stay.`
              : "Record cleaning, extra services, or other non-stay revenue."}
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
            lockedStay={lockedStay}
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
            autoFocusAmount
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

          <p className="text-muted-foreground text-xs">
            {formatIncomeLineTypeLabel(incomeLineTypeId, incomeLineTypes)}: no taxes or channel
            commission applied.
          </p>
        </div>

        <DialogFooter>
          <Button disabled={mutation.isPending} onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => mutation.mutate()} type="button">
            {mutation.isPending ? "Creating…" : "Add Other Income"}
          </Button>
        </DialogFooter>
      </>
    );
  }
);
CreateIncomeLineDialogForm.displayName = "CreateIncomeLineDialogForm";

export const CreateIncomeLineDialog = memo(
  ({
    incomeLineTypes,
    lockedStay,
    onOpenChange,
    open,
    prefill,
    propertyId,
    units,
  }: CreateIncomeLineDialogProps) => {
    const handleClose = () => {
      onOpenChange(false);
    };

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          {open ? (
            <CreateIncomeLineDialogForm
              incomeLineTypes={incomeLineTypes}
              lockedStay={lockedStay}
              onClose={handleClose}
              prefill={prefill}
              propertyId={propertyId}
              units={units}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    );
  }
);
CreateIncomeLineDialog.displayName = "CreateIncomeLineDialog";
