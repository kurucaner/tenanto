import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";

import {
  IncomeLineAmountDateFields,
  IncomeLineDescriptionField,
  IncomeLineGuestField,
  IncomeLineTypeField,
  IncomeLineUnitSection,
} from "@/components/income/income-line-form-fields";
import { formatIncomeLineTypeLabel } from "@/components/income/income-line-form-options";
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
  IncomeLineType,
  type IPropertyReservation,
  type IPropertyUnit,
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
  units?: IPropertyUnit[];
}

const FIELD_ID_PREFIX = "income-line";

const defaultFormState = {
  amount: "",
  description: "",
  guestName: "",
  lineType: IncomeLineType.EXTRA_CLEANING as TIncomeLineType,
  reservationId: "",
  transactionDate: "",
  unitId: "",
};

function buildFormState(
  prefill?: CreateIncomeLineDialogPrefill | null,
  lockedStay?: IPropertyReservation | null
) {
  return {
    amount: defaultFormState.amount,
    description: defaultFormState.description,
    guestName: prefill?.guestName ?? lockedStay?.guestName ?? defaultFormState.guestName,
    lineType: prefill?.lineType ?? defaultFormState.lineType,
    reservationId: prefill?.reservationId ?? lockedStay?.id ?? defaultFormState.reservationId,
    transactionDate:
      prefill?.transactionDate ?? lockedStay?.checkOut ?? defaultFormState.transactionDate,
    unitId: prefill?.unitId ?? lockedStay?.unitId ?? defaultFormState.unitId,
  };
}

interface CreateIncomeLineDialogFormProps {
  lockedStay?: IPropertyReservation | null;
  onClose: () => void;
  prefill?: CreateIncomeLineDialogPrefill | null;
  propertyId: string;
  units?: IPropertyUnit[];
}

const CreateIncomeLineDialogForm = memo(
  ({ lockedStay, onClose, prefill, propertyId, units }: CreateIncomeLineDialogFormProps) => {
    const initialFormState = buildFormState(prefill, lockedStay);
    const queryClient = useQueryClient();
    const [lineType, setLineType] = useState<TIncomeLineType>(initialFormState.lineType);
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
        onClose();
      },
    });

    const canSubmit =
      unitId !== "" &&
      transactionDate !== "" &&
      amount !== "" &&
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
            onChange={setLineType}
            value={lineType}
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
            {formatIncomeLineTypeLabel(lineType)}: no taxes or channel commission applied.
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
  ({ lockedStay, onOpenChange, open, prefill, propertyId, units }: CreateIncomeLineDialogProps) => {
    const handleClose = () => {
      onOpenChange(false);
    };

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          {open ? (
            <CreateIncomeLineDialogForm
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
