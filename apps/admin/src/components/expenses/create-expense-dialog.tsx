import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ExpenseFormFields } from "@/components/expenses/expense-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { expensesApi } from "@/lib/api-client";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { requiredPositiveMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate, isDateOnOrBefore } from "@/lib/reservation-date-utils";
import {
  ExpenseCategory,
  type TExpenseCategory,
  validateExpenseCategoryFields,
} from "@/packages/shared";

const EXPENSE_CATEGORY_VALUES = Object.values(ExpenseCategory) as [
  TExpenseCategory,
  ...TExpenseCategory[],
];

const createExpenseSchema = z
  .object({
    amount: requiredPositiveMoneyField("Amount"),
    category: z.enum(EXPENSE_CATEGORY_VALUES),
    description: z.string(),
    expenseDate: z
      .string()
      .min(1, "Date is required")
      .refine((value) => isDateOnOrBefore(value, getTodayLocalIsoDate()), {
        message: "Date cannot be in the future",
      }),
    personName: z.string(),
    taxFree: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const categoryError = validateExpenseCategoryFields(values.category, {
      description: values.description,
    });
    if (categoryError) {
      ctx.addIssue({
        code: "custom",
        message: "Description is required for this category",
        path: ["description"],
      });
    }
  });

type TCreateExpenseFormValues = z.infer<typeof createExpenseSchema>;

function getDefaultValues(): TCreateExpenseFormValues {
  return {
    amount: "",
    category: ExpenseCategory.ELECTRICITY,
    description: "",
    expenseDate: getTodayLocalIsoDate(),
    personName: "",
    taxFree: false,
  };
}

interface CreateExpenseDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const CreateExpenseDialog = memo(
  ({ onOpenChange, open, propertyId }: CreateExpenseDialogProps) => {
    const queryClient = useQueryClient();
    const form = useForm<TCreateExpenseFormValues>({
      defaultValues: getDefaultValues(),
      resolver: zodResolver(createExpenseSchema),
    });

    const mutation = useMutation({
      mutationFn: (values: TCreateExpenseFormValues) =>
        expensesApi.create(propertyId, {
          amount: Number(values.amount) || 0,
          category: values.category,
          description: values.description.trim() || undefined,
          expenseDate: values.expenseDate,
          personName: values.personName.trim() || undefined,
          taxFree: values.taxFree,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create expense");
      },
      onSuccess: () => {
        toast.success("Expense created");
        invalidatePropertyExpenseCaches(queryClient, propertyId);
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
    const maxExpenseDate = getTodayLocalIsoDate();
    const { amount, category, description, expenseDate, personName, taxFree } = form.watch();

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>Record an operational cost for this property.</DialogDescription>
            </DialogHeader>

            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
              <ExpenseFormFields
                amount={amount}
                amountError={errors.amount?.message}
                category={category}
                description={description}
                descriptionError={errors.description?.message}
                expenseDate={expenseDate}
                expenseDateError={errors.expenseDate?.message}
                expenseDateRequired
                idPrefix="create-expense"
                maxDate={maxExpenseDate}
                onAmountChange={(value) => form.setValue("amount", value)}
                onCategoryChange={(value) => form.setValue("category", value)}
                onDescriptionChange={(value) => form.setValue("description", value)}
                onExpenseDateChange={(value) => form.setValue("expenseDate", value)}
                onPersonNameChange={(value) => form.setValue("personName", value)}
                onTaxFreeChange={(value) => form.setValue("taxFree", value)}
                personName={personName}
                taxFree={taxFree}
              />
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
                {mutation.isPending ? "Creating…" : "Add Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateExpenseDialog.displayName = "CreateExpenseDialog";
