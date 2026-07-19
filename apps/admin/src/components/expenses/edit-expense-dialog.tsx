import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { toast } from "sonner";

import { ExpenseFormFields } from "@/components/expenses/expense-form-fields";
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
    const [categoryId, setCategoryId] = useState<string>(expense.categoryId);
    const [amount, setAmount] = useState(String(expense.amount));
    const [expenseDate, setExpenseDate] = useState(expense.expenseDate ?? "");
    const [description, setDescription] = useState(expense.description ?? "");
    const [cashExpense, setCashExpense] = useState(expense.cashExpense);

    const mutation = useMutation({
      mutationFn: () =>
        expensesApi.update(propertyId, expense.id, {
          amount: Number(amount) || 0,
          cashExpense,
          categoryId,
          description: description.trim() || null,
          expenseDate: expenseDate || null,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update expense");
      },
      onSuccess: () => {
        toast.success("Expense updated");
        invalidatePropertyExpenseCaches(queryClient, propertyId);
        onOpenChange(false);
      },
    });

    const canSubmit = amount !== "" && !mutation.isPending;

    return (
      <Dialog onOpenChange={() => onOpenChange(false)} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update expense details and amount.</DialogDescription>
          </DialogHeader>

          <DialogFormFields>
            <ExpenseFormFields
              amount={amount}
              categoryId={categoryId}
              categoryTypes={categoryTypes}
              description={description}
              expenseDate={expenseDate}
              idPrefix="edit-expense"
              onAmountChange={setAmount}
              onCategoryChange={setCategoryId}
              onDescriptionChange={setDescription}
              onExpenseDateChange={setExpenseDate}
              onCashExpenseChange={setCashExpense}
              cashExpense={cashExpense}
            />

            <p className="text-muted-foreground text-xs">
              Current amount: {formatMoney(expense.amount)}
            </p>
          </DialogFormFields>

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
EditExpenseDialog.displayName = "EditExpenseDialog";
