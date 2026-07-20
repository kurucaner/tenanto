import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ExpenseFormFields } from "@/components/expenses/expense-form-fields";
import {
  editExpenseFormSchema,
  expenseToFormValues,
  type TEditExpenseFormValues,
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
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { type IPropertyExpense, type IPropertyExpenseCategoryType } from "@/packages/shared";

interface EditExpenseDialogProps {
  categoryTypes: IPropertyExpenseCategoryType[];
  expense: IPropertyExpense;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const EditExpenseDialog = memo(
  ({ categoryTypes, expense, onOpenChange, open, propertyId }: EditExpenseDialogProps) => {
    const queryClient = useQueryClient();
    const form = useForm<TEditExpenseFormValues>({
      defaultValues: expenseToFormValues(expense),
      resolver: zodResolver(editExpenseFormSchema),
    });

    const mutation = useMutation({
      mutationFn: (values: TEditExpenseFormValues) =>
        expensesApi.update(propertyId, expense.id, {
          amount: Number(values.amount) || 0,
          cashExpense: values.cashExpense,
          categoryId: values.categoryId,
          description: values.description.trim() || null,
          expenseDate: values.expenseDate || null,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update expense");
      },
      onSuccess: () => {
        toast.success("Expense updated");
        invalidatePropertyExpenseCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(expenseToFormValues(expense));
        }
        onOpenChange(nextOpen);
      },
      [expense, form, onOpenChange]
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
              <DialogTitle>Edit Expense</DialogTitle>
              <DialogDescription>Update expense details and amount.</DialogDescription>
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
                idPrefix="edit-expense"
                maxDate={maxExpenseDate}
                onAmountChange={(value) => form.setValue("amount", value)}
                onCashExpenseChange={(value) => form.setValue("cashExpense", value)}
                onCategoryChange={(value) => form.setValue("categoryId", value)}
                onDescriptionChange={(value) => form.setValue("description", value)}
                onExpenseDateChange={(value) => form.setValue("expenseDate", value)}
              />

              <p className="text-muted-foreground text-xs">
                Current amount: {formatMoney(expense.amount)}
              </p>
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
                {mutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
EditExpenseDialog.displayName = "EditExpenseDialog";
