import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ExpenseFormFields } from "@/components/expenses/expense-form-fields";
import {
  createExpenseFormSchema,
  emptyCreateExpenseFormValues,
  type TCreateExpenseFormValues,
} from "@/components/expenses/expense-form-schema";
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
import { expensesApi } from "@/lib/api-client";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { type IPropertyExpenseCategoryType } from "@/packages/shared";

interface CreateExpenseDialogProps {
  categoryTypes: IPropertyExpenseCategoryType[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const CreateExpenseDialog = memo(
  ({ categoryTypes, onOpenChange, open, propertyId }: CreateExpenseDialogProps) => {
    const queryClient = useQueryClient();
    const firstCategoryId = categoryTypes[0]?.id ?? "";
    const form = useForm<TCreateExpenseFormValues>({
      defaultValues: emptyCreateExpenseFormValues(firstCategoryId),
      resolver: zodResolver(createExpenseFormSchema),
    });

    const mutation = useMutation({
      mutationFn: (values: TCreateExpenseFormValues) =>
        expensesApi.create(propertyId, {
          amount: Number(values.amount) || 0,
          cashExpense: values.cashExpense,
          categoryId: values.categoryId,
          description: values.description.trim() || undefined,
          expenseDate: values.expenseDate,
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
          form.reset(emptyCreateExpenseFormValues(firstCategoryId));
        }
        onOpenChange(nextOpen);
      },
      [firstCategoryId, form, onOpenChange]
    );

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;
    const maxExpenseDate = getTodayLocalIsoDate();
    const { amount, cashExpense, categoryId, description, expenseDate } = form.watch();

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>Record an operational cost for this property.</DialogDescription>
            </DialogHeader>

            <DialogFormFields>
              <ExpenseFormFields
                amount={amount}
                amountError={errors.amount?.message}
                cashExpense={cashExpense}
                categoryId={categoryId}
                categoryTypes={categoryTypes}
                description={description}
                descriptionError={errors.description?.message}
                expenseDate={expenseDate}
                expenseDateError={errors.expenseDate?.message}
                expenseDateRequired
                idPrefix="create-expense"
                maxDate={maxExpenseDate}
                onAmountChange={(value) => form.setValue("amount", value)}
                onCashExpenseChange={(value) => form.setValue("cashExpense", value)}
                onCategoryChange={(value) => form.setValue("categoryId", value)}
                onDescriptionChange={(value) => form.setValue("description", value)}
                onExpenseDateChange={(value) => form.setValue("expenseDate", value)}
              />
            </DialogFormFields>

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
