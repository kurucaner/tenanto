import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { memo, type RefObject, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { DeletedBadge, deletedRowClassName, RestoreEntityButton } from "@/components/deleted-badge";
import { CreateExpenseDialog } from "@/components/expenses/create-expense-dialog";
import { EditExpenseDialog } from "@/components/expenses/edit-expense-dialog";
import {
  EXPENSE_CATEGORY_FILTER_OPTIONS,
  expenseSelectClassName,
  formatExpenseCategoryLabel,
} from "@/components/expenses/expense-form-options";
import { ImportExpenseCsvDialog } from "@/components/expenses/import-expense-csv-dialog";
import { FilterField } from "@/components/filters/filter-field";
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
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import {
  type TPropertyExpensesListFilters,
  usePropertyExpensesInfiniteList,
} from "@/hooks/use-property-expenses-infinite-list";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { expensesApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { getInfiniteListLoadMoreLabel } from "@/lib/infinite-list-label";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { getLedgerFiltersGridClass } from "@/lib/ledger-filter-grid";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import { type IPropertyExpense, type TExpenseCategory } from "@/packages/shared";

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

function buildExpenseFilters(
  category: string,
  from: string,
  to: string
): TPropertyExpensesListFilters {
  const next: TPropertyExpensesListFilters = {};
  if (from) next.from = from;
  if (to) next.to = to;
  if (category) next.category = category as TExpenseCategory;
  return next;
}

function handleEditDialogOpenChange(open: boolean, clearSelection: () => void): void {
  if (!open) {
    clearSelection();
  }
}

const PropertyExpensesFilters = memo(
  ({
    category,
    from,
    onCategoryChange,
    onFromChange,
    onToChange,
    to,
  }: {
    category: string;
    from: string;
    onCategoryChange: (value: string) => void;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
    to: string;
  }) => (
    <div className={getLedgerFiltersGridClass(3)}>
      <FilterField>
        <Label htmlFor="expense-filter-from">From</Label>
        <Input
          id="expense-filter-from"
          onChange={(e) => onFromChange(e.target.value)}
          type="date"
          value={from}
        />
      </FilterField>
      <FilterField>
        <Label htmlFor="expense-filter-to">To</Label>
        <Input
          id="expense-filter-to"
          onChange={(e) => onToChange(e.target.value)}
          type="date"
          value={to}
        />
      </FilterField>
      <FilterField>
        <Label htmlFor="expense-filter-category">Category</Label>
        <select
          className={expenseSelectClassName}
          id="expense-filter-category"
          onChange={(e) => onCategoryChange(e.target.value)}
          value={category}
        >
          {EXPENSE_CATEGORY_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FilterField>
    </div>
  )
);
PropertyExpensesFilters.displayName = "PropertyExpensesFilters";

const PropertyExpensesTable = memo(
  ({
    canManage,
    expenses,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    onDelete,
    onEdit,
    onRestore,
    scrollSentinelRef,
  }: {
    canManage: boolean;
    expenses: IPropertyExpense[];
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isPending: boolean;
    onDelete: (expense: IPropertyExpense) => void;
    onEdit: (expense: IPropertyExpense) => void;
    onRestore: (expense: IPropertyExpense) => void;
    scrollSentinelRef: RefObject<HTMLDivElement | null>;
  }) => {
    if (isPending) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      );
    }

    const columnCount = canManage ? 6 : 5;

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {canManage ? <TableHead>Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={columnCount}>
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
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onRestore={onRestore}
                />
              ))
            )}
            {isFetchingNextPage ? (
              <TableRow>
                <TableCell colSpan={columnCount}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <div aria-hidden className="h-px w-full" ref={scrollSentinelRef} />
        {expenses.length > 0 && !hasNextPage && !isFetchingNextPage ? (
          <p className="text-muted-foreground pt-3 text-center text-sm">
            {getInfiniteListLoadMoreLabel({
              hasNextPage: false,
              isFetchingNextPage: false,
            })}
          </p>
        ) : null}
      </div>
    );
  }
);
PropertyExpensesTable.displayName = "PropertyExpensesTable";

const PropertyExpensesPageActions = memo(
  ({ onImportCsv, onOpenCreate }: { onImportCsv: () => void; onOpenCreate: () => void }) => (
    <div className="flex items-center gap-2">
      <Button className="gap-1.5" onClick={onImportCsv} size="sm" type="button" variant="outline">
        <Sparkles className="size-3.5" />
        Import CSV
      </Button>
      <Button className="gap-1.5" onClick={onOpenCreate} size="sm" type="button">
        <Plus className="size-3.5" />
        Add Expense
      </Button>
    </div>
  )
);
PropertyExpensesPageActions.displayName = "PropertyExpensesPageActions";

const PropertyExpensesPageDialogs = memo(
  ({
    createOpen,
    editExpense,
    importCsvOpen,
    onCreateOpenChange,
    onEditOpenChange,
    onImportCsvOpenChange,
    propertyId,
  }: {
    createOpen: boolean;
    editExpense: IPropertyExpense | null;
    importCsvOpen: boolean;
    onCreateOpenChange: (open: boolean) => void;
    onEditOpenChange: (open: boolean) => void;
    onImportCsvOpenChange: (open: boolean) => void;
    propertyId: string;
  }) => (
    <>
      <CreateExpenseDialog
        onOpenChange={onCreateOpenChange}
        open={createOpen}
        propertyId={propertyId}
      />
      <ImportExpenseCsvDialog
        onOpenChange={onImportCsvOpenChange}
        open={importCsvOpen}
        propertyId={propertyId}
      />
      {editExpense ? (
        <EditExpenseDialog
          expense={editExpense}
          key={editExpense.id}
          onOpenChange={onEditOpenChange}
          open={true}
          propertyId={propertyId}
        />
      ) : null}
    </>
  )
);
PropertyExpensesPageDialogs.displayName = "PropertyExpensesPageDialogs";

function useRegisterExpensePageActions(
  canManage: boolean,
  onImportCsv: () => void,
  onOpenCreate: () => void
) {
  const pageActions = useMemo(
    () =>
      canManage ? (
        <PropertyExpensesPageActions onImportCsv={onImportCsv} onOpenCreate={onOpenCreate} />
      ) : null,
    [canManage, onImportCsv, onOpenCreate]
  );

  usePropertyShellActions(pageActions);
}

export const PropertyExpensesPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [importCsvOpen, setImportCsvOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<IPropertyExpense | null>(null);
  const { filters: urlFilters, setFilter } = useUrlFilterState(EXPENSE_URL_FILTER_SCHEMA);
  const { category, from, to } = urlFilters;

  const filters = useMemo(() => buildExpenseFilters(category, from, to), [category, from, to]);

  const { expenses, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    usePropertyExpensesInfiniteList(propertyId, filters);

  const scrollSentinelRef = useInfiniteScrollTrigger({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
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

  const { deleteConfirmationDialog, requestDelete } = useDeleteConfirmation<IPropertyExpense>(
    deleteMutation.isPending,
    (expense, onDeleted) => deleteMutation.mutate(expense, { onSuccess: onDeleted })
  );

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

  const handleOpenCreate = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleOpenImportCsv = useCallback(() => {
    setImportCsvOpen(true);
  }, []);

  const handleDeleteExpense = useCallback(
    (expense: IPropertyExpense) => {
      requestDelete({
        description: `Delete ${formatExpenseCategoryLabel(expense.category)} expense? It will be hidden from reports.`,
        target: expense,
        title: "Delete expense",
      });
    },
    [requestDelete]
  );

  const handleRestoreExpense = useCallback(
    (expense: IPropertyExpense) => {
      restoreMutation.mutate(expense);
    },
    [restoreMutation]
  );

  useRegisterExpensePageActions(canManage, handleOpenImportCsv, handleOpenCreate);

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <PropertyExpensesFilters
            category={category}
            from={from}
            onCategoryChange={(value) => setFilter("category", value)}
            onFromChange={(value) => setFilter("from", value)}
            onToChange={(value) => setFilter("to", value)}
            to={to}
          />

          <PropertyExpensesTable
            canManage={canManage}
            expenses={expenses}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isPending={isPending}
            onDelete={handleDeleteExpense}
            onEdit={setEditExpense}
            onRestore={handleRestoreExpense}
            scrollSentinelRef={scrollSentinelRef}
          />
        </CardContent>
      </Card>

      {deleteConfirmationDialog}

      <PropertyExpensesPageDialogs
        createOpen={createOpen}
        editExpense={editExpense}
        importCsvOpen={importCsvOpen}
        onCreateOpenChange={setCreateOpen}
        onEditOpenChange={(open) => handleEditDialogOpenChange(open, () => setEditExpense(null))}
        onImportCsvOpenChange={setImportCsvOpen}
        propertyId={propertyId}
      />
    </>
  );
});
PropertyExpensesPage.displayName = "PropertyExpensesPage";
