import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
  DialogFormFields,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { incomeLinesApi } from "@/lib/api-client";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { requiredNonNegativeMoneyField } from "@/lib/money-field-validation";
import { PROPERTY_AMENITY_UNIT_VALUE } from "@/lib/property-amenity-unit";
import {
  clampToMaxLocalIsoDate,
  getTodayLocalIsoDate,
  isDateOnOrBefore,
} from "@/lib/reservation-date-utils";
import {
  formatRentPeriodLabel,
  getLeaseRentAmount,
  type IPropertyIncomeLineType,
  type IPropertyLongStay,
  type IPropertyReservation,
  type IPropertyUnit,
  resolveDefaultIncomeLineTypeId,
} from "@/packages/shared";

export interface CreateIncomeLineDialogPrefill {
  amount?: string;
  guestName?: string;
  incomeLineTypeId?: string;
  /** When true with a locked lease, records system Security deposit (no rent period). */
  isSecurityDeposit?: boolean;
  longStayId?: string;
  rentPeriodKey?: string;
  reservationId?: string;
  transactionDate?: string;
  unitId?: string;
}

interface CreateIncomeLineDialogProps {
  incomeLineTypes: IPropertyIncomeLineType[];
  lockedLease?: IPropertyLongStay | null;
  lockedStay?: IPropertyReservation | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  prefill?: CreateIncomeLineDialogPrefill | null;
  propertyId: string;
  units?: IPropertyUnit[];
}

const FIELD_ID_PREFIX = "income-line";

const createIncomeLineSchema = z
  .object({
    amount: requiredNonNegativeMoneyField("Amount"),
    description: z.string(),
    guestName: z.string(),
    incomeLineTypeId: z.string(),
    longStayId: z.string(),
    reservationId: z.string(),
    transactionDate: z
      .string()
      .min(1, "Date is required")
      .refine((value) => isDateOnOrBefore(value, getTodayLocalIsoDate()), {
        message: "Date cannot be in the future",
      }),
    unitId: z.string().min(1, "Unit is required"),
  })
  .superRefine((data, ctx) => {
    if (data.longStayId === "" && data.incomeLineTypeId.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Income type is required",
        path: ["incomeLineTypeId"],
      });
    }
  });

type TCreateIncomeLineFormValues = z.infer<typeof createIncomeLineSchema>;

function getDefaultValues(
  incomeLineTypes: IPropertyIncomeLineType[],
  prefill?: CreateIncomeLineDialogPrefill | null,
  lockedStay?: IPropertyReservation | null,
  lockedLease?: IPropertyLongStay | null
): TCreateIncomeLineFormValues {
  const defaultIncomeLineTypeId = resolveDefaultIncomeLineTypeId(incomeLineTypes);
  const maxTransactionDate = getTodayLocalIsoDate();
  const rawTransactionDate = prefill?.transactionDate ?? maxTransactionDate;

  return {
    amount: prefill?.amount ?? (lockedLease ? String(getLeaseRentAmount(lockedLease)) : ""),
    description: "",
    guestName: prefill?.guestName ?? lockedLease?.guestName ?? lockedStay?.guestName ?? "",
    incomeLineTypeId: lockedLease ? "" : (prefill?.incomeLineTypeId ?? defaultIncomeLineTypeId),
    longStayId: prefill?.longStayId ?? lockedLease?.id ?? "",
    reservationId: prefill?.reservationId ?? lockedStay?.id ?? "",
    transactionDate: clampToMaxLocalIsoDate(rawTransactionDate, maxTransactionDate),
    unitId:
      prefill?.unitId ?? lockedLease?.unitId ?? lockedStay?.unitId ?? PROPERTY_AMENITY_UNIT_VALUE,
  };
}

interface CreateIncomeLineDialogFormProps {
  incomeLineTypes: IPropertyIncomeLineType[];
  lockedLease?: IPropertyLongStay | null;
  lockedStay?: IPropertyReservation | null;
  onClose: () => void;
  prefill?: CreateIncomeLineDialogPrefill | null;
  propertyId: string;
  units?: IPropertyUnit[];
}

const CreateIncomeLineDialogForm = memo(
  ({
    incomeLineTypes,
    lockedLease,
    lockedStay,
    onClose,
    prefill,
    propertyId,
    units,
  }: CreateIncomeLineDialogFormProps) => {
    const queryClient = useQueryClient();
    const isDepositRecording = Boolean(lockedLease && prefill?.isSecurityDeposit);
    const isRentRecording = Boolean(lockedLease) && !isDepositRecording;
    const isSystemAssignedLeaseIncome = isRentRecording || isDepositRecording;

    const form = useForm<TCreateIncomeLineFormValues>({
      defaultValues: getDefaultValues(incomeLineTypes, prefill, lockedStay, lockedLease),
      resolver: zodResolver(createIncomeLineSchema),
    });

    const incomeLineTypeOptions = useMemo(
      () => buildIncomeLineTypeOptions(incomeLineTypes),
      [incomeLineTypes]
    );

    const incomeLineTypeId = form.watch("incomeLineTypeId");
    const reservationId = form.watch("reservationId");
    const longStayId = form.watch("longStayId");
    const transactionDate = form.watch("transactionDate");
    const maxTransactionDate = getTodayLocalIsoDate();

    const mutation = useMutation({
      mutationFn: (values: TCreateIncomeLineFormValues) => {
        const body = {
          amount: Number(values.amount) || 0,
          description: values.description.trim() || undefined,
          guestName: values.guestName.trim() || undefined,
          isSecurityDeposit: isDepositRecording ? true : undefined,
          longStayId: values.longStayId || undefined,
          rentPeriodKey: isDepositRecording ? undefined : prefill?.rentPeriodKey,
          reservationId: values.reservationId || undefined,
          transactionDate: values.transactionDate,
          unitId: values.unitId === PROPERTY_AMENITY_UNIT_VALUE ? null : values.unitId,
        };

        if (!values.longStayId) {
          return incomeLinesApi.create(propertyId, {
            ...body,
            incomeLineTypeId: values.incomeLineTypeId,
          });
        }

        return incomeLinesApi.create(propertyId, body);
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create income entry");
      },
      onSuccess: (_data, values) => {
        toast.success(getSuccessToast(isRentRecording, isDepositRecording));
        invalidatePropertyIncomeCaches(queryClient, propertyId, {
          longStayId: values.longStayId || undefined,
        });
        onClose();
      },
    });

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;
    const showGuestField = !lockedStay && !lockedLease && reservationId === "" && longStayId === "";

    return (
      <form onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle>{getDialogTitle(isRentRecording, isDepositRecording)}</DialogTitle>
          <DialogDescription>
            {getDialogDescription(lockedLease, lockedStay, isDepositRecording)}
          </DialogDescription>
        </DialogHeader>

        <DialogFormFields>
          {!isSystemAssignedLeaseIncome ? (
            <Controller
              control={form.control}
              name="incomeLineTypeId"
              render={({ field }) => (
                <div className="flex flex-col gap-1.5">
                  <IncomeLineTypeField
                    fieldIdPrefix={FIELD_ID_PREFIX}
                    onChange={field.onChange}
                    options={incomeLineTypeOptions}
                    value={field.value}
                  />
                  {errors.incomeLineTypeId ? (
                    <p className="text-xs text-destructive">{errors.incomeLineTypeId.message}</p>
                  ) : null}
                </div>
              )}
            />
          ) : null}

          <Controller
            control={form.control}
            name="unitId"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <IncomeLineUnitSection
                  fieldIdPrefix={FIELD_ID_PREFIX}
                  includePropertyAmenityOption={!lockedStay && !lockedLease}
                  lockedLease={lockedLease}
                  lockedStay={lockedStay}
                  onReservationIdChange={(nextReservationId) => {
                    form.setValue("reservationId", nextReservationId);
                  }}
                  onUnitChange={(nextUnitId) => {
                    field.onChange(nextUnitId);
                    if (!lockedStay && !lockedLease) {
                      form.setValue("reservationId", "");
                      form.setValue("longStayId", "");
                    }
                  }}
                  propertyId={propertyId}
                  reservationId={reservationId}
                  transactionDate={transactionDate}
                  unitId={field.value}
                  units={units}
                />
                {errors.unitId ? (
                  <p className="text-xs text-destructive">{errors.unitId.message}</p>
                ) : null}
              </div>
            )}
          />

          {isRentRecording && prefill?.rentPeriodKey ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${FIELD_ID_PREFIX}-rent-period`}>Rent period</Label>
              <Input
                disabled
                id={`${FIELD_ID_PREFIX}-rent-period`}
                readOnly
                value={formatRentPeriodLabel(prefill.rentPeriodKey)}
              />
            </div>
          ) : null}

          <Controller
            control={form.control}
            name="amount"
            render={({ field: amountField }) => (
              <Controller
                control={form.control}
                name="transactionDate"
                render={({ field: dateField }) => (
                  <div className="flex flex-col gap-1.5">
                    <IncomeLineAmountDateFields
                      amount={amountField.value}
                      autoFocusAmount
                      fieldIdPrefix={FIELD_ID_PREFIX}
                      maxDate={maxTransactionDate}
                      onAmountChange={amountField.onChange}
                      onDateChange={dateField.onChange}
                      transactionDate={dateField.value}
                      transactionDateLabel={
                        isRentRecording || isDepositRecording ? "Payment date" : "Date"
                      }
                    />
                    {errors.amount ? (
                      <p className="text-xs text-destructive">{errors.amount.message}</p>
                    ) : null}
                    {errors.transactionDate ? (
                      <p className="text-xs text-destructive">{errors.transactionDate.message}</p>
                    ) : null}
                  </div>
                )}
              />
            )}
          />

          {showGuestField ? (
            <Controller
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <IncomeLineGuestField
                  fieldIdPrefix={FIELD_ID_PREFIX}
                  onChange={field.onChange}
                  value={field.value}
                />
              )}
            />
          ) : null}

          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <IncomeLineDescriptionField
                fieldIdPrefix={FIELD_ID_PREFIX}
                onChange={field.onChange}
                value={field.value}
              />
            )}
          />

          {!isSystemAssignedLeaseIncome ? (
            <p className="text-muted-foreground text-xs">
              {formatIncomeLineTypeLabel(incomeLineTypeId, incomeLineTypes)}: no taxes or channel
              commission applied.
            </p>
          ) : null}
        </DialogFormFields>

        <DialogFooter>
          <Button disabled={mutation.isPending} onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={mutation.isPending || isSubmitting} type="submit">
            {getSubmitLabel(mutation.isPending, isRentRecording, isDepositRecording)}
          </Button>
        </DialogFooter>
      </form>
    );
  }
);
CreateIncomeLineDialogForm.displayName = "CreateIncomeLineDialogForm";

function getDialogTitle(isRentRecording: boolean, isDepositRecording: boolean): string {
  if (isDepositRecording) {
    return "Record Deposit";
  }
  if (isRentRecording) {
    return "Record Rent";
  }
  return "Add Other Income";
}

function getSubmitLabel(
  isPending: boolean,
  isRentRecording: boolean,
  isDepositRecording: boolean
): string {
  if (isPending) {
    return isRentRecording || isDepositRecording ? "Recording…" : "Creating…";
  }
  return getDialogTitle(isRentRecording, isDepositRecording);
}

function getSuccessToast(isRentRecording: boolean, isDepositRecording: boolean): string {
  if (isDepositRecording) {
    return "Deposit recorded";
  }
  if (isRentRecording) {
    return "Rent recorded";
  }
  return "Other income created";
}

function getDialogDescription(
  lockedLease: IPropertyLongStay | null | undefined,
  lockedStay: IPropertyReservation | null | undefined,
  isDepositRecording: boolean
): string {
  if (lockedLease && isDepositRecording) {
    return `Record security deposit for ${lockedLease.guestName}'s lease.`;
  }
  if (lockedLease) {
    return `Record rent for ${lockedLease.guestName}'s lease.`;
  }
  if (lockedStay) {
    return `Add income linked to ${lockedStay.guestName}'s stay.`;
  }
  return "Record cleaning, extra services, or other non-stay revenue.";
}

export const CreateIncomeLineDialog = memo(
  ({
    incomeLineTypes,
    lockedLease,
    lockedStay,
    onOpenChange,
    open,
    prefill,
    propertyId,
    units,
  }: CreateIncomeLineDialogProps) => {
    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        onOpenChange(nextOpen);
      },
      [onOpenChange]
    );

    const handleClose = useCallback(() => {
      handleOpenChange(false);
    }, [handleOpenChange]);

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          {open ? (
            <CreateIncomeLineDialogForm
              incomeLineTypes={incomeLineTypes}
              key={`${lockedLease?.id ?? lockedStay?.id ?? "standalone"}-${prefill?.longStayId ?? prefill?.reservationId ?? "new"}`}
              lockedLease={lockedLease}
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
