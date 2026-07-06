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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format-money";
import { expensesApi } from "@/lib/api-client";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import {
  getExpenseCategoryMeta,
  type IPropertyExpense,
  type TExpenseCategory,
} from "@/packages/shared";

interface EditExpenseDialogProps {
  expense: IPropertyExpense;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const EditExpenseDialog = memo(
  ({ expense, onOpenChange, open, propertyId }: EditExpenseDialogProps) => {
    const queryClient = useQueryClient();
    const [category, setCategory] = useState<TExpenseCategory>(expense.category);
    const [amount, setAmount] = useState(String(expense.amount));
    const [expenseDate, setExpenseDate] = useState(expense.expenseDate ?? "");
    const [personName, setPersonName] = useState(expense.personName ?? "");
    const [description, setDescription] = useState(expense.description ?? "");

    const mutation = useMutation({
      mutationFn: () =>
        expensesApi.update(propertyId, expense.id, {
          amount: Number(amount) || 0,
          category,
          description: description.trim() || null,
          expenseDate: expenseDate || null,
          personName: personName.trim() || null,
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

    const meta = getExpenseCategoryMeta(category);
    const canSubmit =
      amount !== "" &&
      !mutation.isPending &&
      (!meta.requiresDescription || description.trim() !== "");

    return (
      <Dialog onOpenChange={() => onOpenChange(false)} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update expense details and amount.</DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            <ExpenseFormFields
              amount={amount}
              category={category}
              description={description}
              expenseDate={expenseDate}
              idPrefix="edit-expense"
              onAmountChange={setAmount}
              onCategoryChange={setCategory}
              onDescriptionChange={setDescription}
              onExpenseDateChange={setExpenseDate}
              onPersonNameChange={setPersonName}
              personName={personName}
            />

            <p className="text-muted-foreground text-xs">
              Current amount: {formatMoney(expense.amount)}
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
EditExpenseDialog.displayName = "EditExpenseDialog";
