import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { longStaysApi } from "@/lib/api-client";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { calculateLeaseEndDate } from "@/lib/lease-date-utils";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import type { IPropertyUnit } from "@/packages/shared";

const DEFAULT_TERM_MONTHS = "12";
const MAX_TERM_MONTHS = 60;

const createLongStaySchema = z.object({
  guestName: z.string().trim().min(1, "Guest name is required"),
  leaseStartDate: z
    .string()
    .min(1, "Lease start date is required")
    .refine((value) => value >= getTodayLocalIsoDate(), {
      message: "Lease start date cannot be in the past",
    }),
  monthlyRent: z
    .string()
    .min(1, "Monthly rent is required")
    .refine(
      (value) => {
        if (!isValidDecimalInput(value)) {
          return false;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0;
      },
      { message: "Monthly rent must be greater than 0" }
    ),
  termMonths: z
    .string()
    .min(1, "Term is required")
    .refine(
      (value) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_TERM_MONTHS;
      },
      { message: `Term must be a whole number between 1 and ${MAX_TERM_MONTHS}` }
    ),
});

type TCreateLongStayFormValues = z.infer<typeof createLongStaySchema>;

function getDefaultValues(): TCreateLongStayFormValues {
  return {
    guestName: "",
    leaseStartDate: getTodayLocalIsoDate(),
    monthlyRent: "",
    termMonths: DEFAULT_TERM_MONTHS,
  };
}

interface CreateLongStayDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
  unit: IPropertyUnit;
}

export const CreateLongStayDialog = memo(
  ({ onOpenChange, open, propertyId, unit }: CreateLongStayDialogProps) => {
    const form = useForm<TCreateLongStayFormValues>({
      defaultValues: getDefaultValues(),
      resolver: zodResolver(createLongStaySchema),
    });

    const leaseStartDate = form.watch("leaseStartDate");
    const termMonths = form.watch("termMonths");

    const leaseEndDate = useMemo(() => {
      const parsedTermMonths = Number.parseInt(termMonths, 10);
      if (leaseStartDate === "" || !Number.isInteger(parsedTermMonths) || parsedTermMonths < 1) {
        return null;
      }
      return calculateLeaseEndDate(leaseStartDate, parsedTermMonths);
    }, [leaseStartDate, termMonths]);

    const mutation = useMutation({
      mutationFn: (values: TCreateLongStayFormValues) =>
        longStaysApi.create(propertyId, {
          guestName: values.guestName.trim(),
          leaseStartDate: values.leaseStartDate,
          monthlyRent: Number(values.monthlyRent),
          termMonths: Number.parseInt(values.termMonths, 10),
          unitId: unit.id,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create long stay");
      },
      onSuccess: () => {
        toast.success("Long stay created");
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(getDefaultValues());
        }
        onOpenChange(nextOpen);
      },
      [form, onOpenChange]
    );

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Long Stay</DialogTitle>
            <DialogDescription>Add a lease for unit {unit.unitNumber}.</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="long-stay-guest-name">Guest Name</Label>
                <Input
                  autoFocus
                  id="long-stay-guest-name"
                  {...form.register("guestName")}
                />
                {errors.guestName ? (
                  <p className="text-xs text-destructive">{errors.guestName.message}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="long-stay-start-date">Lease Start Date</Label>
                  <Input
                    id="long-stay-start-date"
                    min={getTodayLocalIsoDate()}
                    type="date"
                    {...form.register("leaseStartDate")}
                  />
                  {errors.leaseStartDate ? (
                    <p className="text-xs text-destructive">{errors.leaseStartDate.message}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="long-stay-term-months">Term (Months)</Label>
                  <Input
                    id="long-stay-term-months"
                    max={MAX_TERM_MONTHS}
                    min={1}
                    type="number"
                    {...form.register("termMonths")}
                  />
                  {errors.termMonths ? (
                    <p className="text-xs text-destructive">{errors.termMonths.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="long-stay-monthly-rent">Monthly Rent</Label>
                <Controller
                  control={form.control}
                  name="monthlyRent"
                  render={({ field }) => (
                    <Input
                      id="long-stay-monthly-rent"
                      inputMode="decimal"
                      onChange={(e) => {
                        if (isValidDecimalInput(e.target.value)) {
                          field.onChange(e.target.value);
                        }
                      }}
                      type="text"
                      value={field.value}
                    />
                  )}
                />
                {errors.monthlyRent ? (
                  <p className="text-xs text-destructive">{errors.monthlyRent.message}</p>
                ) : null}
              </div>

              {leaseEndDate ? (
                <p className="text-muted-foreground text-xs">
                  Lease ends: {new Date(`${leaseEndDate}T00:00:00`).toLocaleDateString()}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                disabled={mutation.isPending}
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={mutation.isPending || isSubmitting} type="submit">
                {mutation.isPending ? "Creating…" : "Add Long Stay"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateLongStayDialog.displayName = "CreateLongStayDialog";
