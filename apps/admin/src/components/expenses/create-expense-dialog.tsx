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
import { expensesApi } from "@/lib/api-client";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { ExpenseCategory, getExpenseCategoryMeta, type TExpenseCategory } from "@/packages/shared";

interface CreateExpenseDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const CreateExpenseDialog = memo(
  ({ onOpenChange, open, propertyId }: CreateExpenseDialogProps) => {
    const queryClient = useQueryClient();
    const [category, setCategory] = useState<TExpenseCategory>(ExpenseCategory.ELECTRICITY);
    const [amount, setAmount] = useState("");
    const [expenseDate, setExpenseDate] = useState("");
    const [personName, setPersonName] = useState("");
    const [description, setDescription] = useState("");

    const mutation = useMutation({
      mutationFn: () =>
        expensesApi.create(propertyId, {
          amount: Number(amount) || 0,
          category,
          description: description.trim() || undefined,
          expenseDate: expenseDate || undefined,
          personName: personName.trim() || undefined,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create expense");
      },
      onSuccess: () => {
        toast.success("Expense created");
        invalidatePropertyExpenseCaches(queryClient, propertyId);
        handleClose();
      },
    });

    const handleClose = () => {
      onOpenChange(false);
      setCategory(ExpenseCategory.ELECTRICITY);
      setAmount("");
      setExpenseDate("");
      setPersonName("");
      setDescription("");
    };

    const meta = getExpenseCategoryMeta(category);
    const canSubmit =
      amount !== "" &&
      !mutation.isPending &&
      (!meta.requiresDescription || description.trim() !== "");

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record an operational cost for this property.</DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            <ExpenseFormFields
              amount={amount}
              category={category}
              description={description}
              expenseDate={expenseDate}
              idPrefix="create-expense"
              onAmountChange={setAmount}
              onCategoryChange={setCategory}
              onDescriptionChange={setDescription}
              onExpenseDateChange={setExpenseDate}
              onPersonNameChange={setPersonName}
              personName={personName}
            />
          </div>

          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={handleClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()} type="button">
              {mutation.isPending ? "Creating…" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateExpenseDialog.displayName = "CreateExpenseDialog";
