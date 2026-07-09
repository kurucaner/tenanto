import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { DeletedBadge, deletedRowClassName, RestoreEntityButton } from "@/components/deleted-badge";
import { CreateExpenseDialog } from "@/components/expenses/create-expense-dialog";
import { EditExpenseDialog } from "@/components/expenses/edit-expense-dialog";
import {
  EXPENSE_CATEGORY_FILTER_OPTIONS,
  expenseSelectClassName,
  formatExpenseCategoryLabel,
} from "@/components/expenses/expense-form-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { expensesApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  type IPropertyExpense,
  type IPropertyExpensesListQuery,
  type TExpenseCategory,
} from "@/packages/shared";

const ExpenseRow = memo(
  ({
    canManage,
    expense,
    onDelete,
    onEdit,
    onRestore,
  }: {
    canManage: boolean;
    expense: IPropertyExpense;
    onDelete: (expense: IPropertyExpense) => void;
    onEdit: (expense: IPropertyExpense) => void;
    onRestore: (expense: IPropertyExpense) => void;
  }) => (
    <TableRow className={expense.isDeleted ? deletedRowClassName : undefined}>
      <TableCell>
        <div className="flex items-center gap-2">
          {formatExpenseCategoryLabel(expense.category)}
          {expense.isDeleted ? <DeletedBadge /> : null}
        </div>
      </TableCell>
      <TableCell>{expense.expenseDate ?? "—"}</TableCell>
      <TableCell>{expense.personName ?? "—"}</TableCell>
      <TableCell className="max-w-[240px] truncate">{expense.description ?? "—"}</TableCell>
      <TableCell>{expense.taxFree ? <Badge variant="secondary">Tax-free</Badge> : "—"}</TableCell>
      <TableCell className="text-right font-medium">{formatMoney(expense.amount)}</TableCell>
      {canManage ? (
        <TableCell>
          <div className="flex items-center gap-1">
            {expense.isDeleted ? (
              <RestoreEntityButton ariaLabel="Restore expense" onClick={() => onRestore(expense)} />
            ) : (
              <>
                <Button
                  aria-label="Edit expense"
                  onClick={() => onEdit(expense)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  aria-label="Delete expense"
                  onClick={() => onDelete(expense)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  )
);
ExpenseRow.displayName = "ExpenseRow";

const EXPENSE_URL_FILTER_SCHEMA = defineUrlFilterSchema<{
  category: string;
  from: string;
  to: string;
}>({
  category: { defaultValue: "" },
  from: { defaultValue: "" },
  to: { defaultValue: "" },
});

export const PropertyExpensesPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<IPropertyExpense | null>(null);
  const { filters: urlFilters, setFilter } = useUrlFilterState(EXPENSE_URL_FILTER_SCHEMA);
  const { category, from, to } = urlFilters;

  const filters = useMemo<IPropertyExpensesListQuery>(() => {
    const next: IPropertyExpensesListQuery = {};
    if (from) next.from = from;
    if (to) next.to = to;
    if (category) next.category = category as TExpenseCategory;
    return next;
  }, [category, from, to]);

  const expensesQuery = useQuery({
    queryFn: () => expensesApi.list(propertyId, filters),
    queryKey: adminQueryKeys.propertyExpenses(propertyId, filters),
  });

  const deleteMutation = useMutation({
    mutationFn: (expense: IPropertyExpense) => expensesApi.delete(propertyId, expense.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to delete expense");
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      invalidatePropertyExpenseCaches(queryClient, propertyId);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (expense: IPropertyExpense) => expensesApi.restore(propertyId, expense.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to restore expense");
    },
    onSuccess: () => {
      toast.success("Expense restored");
      invalidatePropertyExpenseCaches(queryClient, propertyId);
    },
  });

  const expenses = expensesQuery.data?.expenses ?? [];

  const handleOpenCreate = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const pageActions = useMemo(
    () =>
      canManage ? (
        <Button className="gap-1.5" onClick={handleOpenCreate} size="sm" type="button">
          <Plus className="size-3.5" />
          Add Expense
        </Button>
      ) : null,
    [canManage, handleOpenCreate]
  );

  usePropertyShellActions(pageActions);

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense-filter-from">From</Label>
              <Input
                id="expense-filter-from"
                onChange={(e) => setFilter("from", e.target.value)}
                type="date"
                value={from}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-filter-to">To</Label>
              <Input
                id="expense-filter-to"
                onChange={(e) => setFilter("to", e.target.value)}
                type="date"
                value={to}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-filter-category">Category</Label>
              <select
                className={expenseSelectClassName}
                id="expense-filter-category"
                onChange={(e) => setFilter("category", e.target.value)}
                value={category}
              >
                {EXPENSE_CATEGORY_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {expensesQuery.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {canManage ? <TableHead>Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={canManage ? 7 : 6}>
                        No expenses yet.
                        {canManage ? " Add an expense to get started." : ""}
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses.map((expense) => (
                      <ExpenseRow
                        canManage={canManage}
                        expense={expense}
                        key={expense.id}
                        onDelete={(item) => {
                          if (
                            !globalThis.confirm(
                              `Delete ${formatExpenseCategoryLabel(item.category)} expense? It will be hidden from reports. Platform admins can restore it.`
                            )
                          ) {
                            return;
                          }
                          deleteMutation.mutate(item);
                        }}
                        onEdit={setEditExpense}
                        onRestore={(item) => restoreMutation.mutate(item)}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateExpenseDialog onOpenChange={setCreateOpen} open={createOpen} propertyId={propertyId} />
      {editExpense ? (
        <EditExpenseDialog
          expense={editExpense}
          key={editExpense.id}
          onOpenChange={(open) => {
            if (!open) setEditExpense(null);
          }}
          open={true}
          propertyId={propertyId}
        />
      ) : null}
    </>
  );
});
PropertyExpensesPage.displayName = "PropertyExpensesPage";
