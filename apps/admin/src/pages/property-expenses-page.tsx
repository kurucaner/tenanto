import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Sparkles } from "lucide-react";
import {
  memo,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { type DataTableColumn } from "@/components/data-table/data-table-types";
import { DeletedBadge, deletedRowClassName, RestoreEntityButton } from "@/components/deleted-badge";
import { CreateExpenseDialog } from "@/components/expenses/create-expense-dialog";
import { EditExpenseDialog } from "@/components/expenses/edit-expense-dialog";
import { ImportExpenseCsvDialog } from "@/components/expenses/import-expense-csv-dialog";
import { DateFilterField } from "@/components/filters/date-filter-field";
import { FilterSelectField } from "@/components/filters/filter-select-field";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import {
  type TPropertyExpensesListFilters,
  usePropertyExpensesInfiniteList,
} from "@/hooks/use-property-expenses-infinite-list";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useQuickDelete } from "@/hooks/use-quick-delete";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { expensesApi, settingsApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { getLedgerFiltersGridClass } from "@/lib/ledger-filter-grid";
import { adminQueryKeys } from "@/lib/query-keys";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import { type IPropertyExpense, type IPropertyExpenseCategoryType } from "@/packages/shared";

const ExpenseRow = memo(
  ({
    canManage,
    expense,
    isDeletePending,
    isQuickDeleteActive,
    onDelete,
    onEdit,
    onRestore,
  }: {
    canManage: boolean;
    expense: IPropertyExpense;
    isDeletePending: boolean;
    isQuickDeleteActive: boolean;
    onDelete: (expense: IPropertyExpense, event?: MouseEvent<HTMLButtonElement>) => void;
    onEdit: (expense: IPropertyExpense) => void;
    onRestore: (expense: IPropertyExpense) => void;
  }) => (
    <TableRow className={expense.isDeleted ? deletedRowClassName : undefined}>
      <TableCell>
        <div className="flex items-center gap-2">
          {expense.categoryName}
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
                <QuickDeleteButton
                  ariaLabel="Delete expense"
                  disabled={isDeletePending}
                  onClick={(event) => onDelete(expense, event)}
                  quickDeleteActive={isQuickDeleteActive}
                />
              </>
            )}
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  )
);
ExpenseRow.displayName = "ExpenseRow";

const EXPENSE_ROW_ESTIMATED_HEIGHT = 44;

function getExpenseKey(expense: IPropertyExpense): string {
  return expense.id;
}

function getExpenseColumns(canManage: boolean): DataTableColumn[] {
  return [
    { id: "category", label: "Category" },
    { id: "date", label: "Date" },
    { id: "description", label: "Description" },
    { id: "tax", label: "Tax" },
    { align: "right", id: "amount", label: "Amount" },
    { hidden: !canManage, id: "actions", label: "Actions" },
  ];
}

const EXPENSE_URL_FILTER_SCHEMA = defineUrlFilterSchema<{
  categoryId: string;
  from: string;
  to: string;
}>({
  categoryId: { defaultValue: "" },
  from: { defaultValue: "" },
  to: { defaultValue: "" },
});

function buildExpenseFilters(
  categoryId: string,
  from: string,
  to: string
): TPropertyExpensesListFilters {
  const next: TPropertyExpensesListFilters = {};
  if (from) next.from = from;
  if (to) next.to = to;
  if (categoryId) next.categoryId = categoryId;
  return next;
}

function handleEditDialogOpenChange(open: boolean, clearSelection: () => void): void {
  if (!open) {
    clearSelection();
  }
}

const PropertyExpensesFilters = memo(
  ({
    categoryId,
    categoryTypes,
    from,
    onCategoryIdChange,
    onFromChange,
    onToChange,
    to,
  }: {
    categoryId: string;
    categoryTypes: IPropertyExpenseCategoryType[];
    from: string;
    onCategoryIdChange: (value: string) => void;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
    to: string;
  }) => (
    <div className={getLedgerFiltersGridClass(3)}>
      <DateFilterField
        id="expense-filter-from"
        label="From"
        onChange={(e) => onFromChange(e.target.value)}
        value={from}
      />
      <DateFilterField
        id="expense-filter-to"
        label="To"
        onChange={(e) => onToChange(e.target.value)}
        value={to}
      />
      <FilterSelectField
        emptyOptionLabel="All categories"
        id="expense-filter-category"
        label="Category"
        onChange={(e) => onCategoryIdChange(e.target.value)}
        options={categoryTypes.map((cat) => ({ label: cat.name, value: cat.id }))}
        value={categoryId}
      />
    </div>
  )
);
PropertyExpensesFilters.displayName = "PropertyExpensesFilters";

const PropertyExpensesTable = memo(
  ({
    canManage,
    expenses,
    filters,
    hasNextPage,
    isDeletePending,
    isFetchingNextPage,
    isPending,
    isQuickDeleteActive,
    onDelete,
    onEdit,
    onRestore,
    scrollSentinelRef,
  }: {
    canManage: boolean;
    expenses: IPropertyExpense[];
    filters: ReactNode;
    hasNextPage: boolean;
    isDeletePending: boolean;
    isFetchingNextPage: boolean;
    isPending: boolean;
    isQuickDeleteActive: boolean;
    onDelete: (expense: IPropertyExpense, event?: MouseEvent<HTMLButtonElement>) => void;
    onEdit: (expense: IPropertyExpense) => void;
    onRestore: (expense: IPropertyExpense) => void;
    scrollSentinelRef: RefObject<HTMLDivElement | null>;
  }) => {
    const renderExpenseRow = useCallback(
      (expense: IPropertyExpense) => (
        <ExpenseRow
          canManage={canManage}
          expense={expense}
          isDeletePending={isDeletePending}
          isQuickDeleteActive={isQuickDeleteActive}
          key={expense.id}
          onDelete={onDelete}
          onEdit={onEdit}
          onRestore={onRestore}
        />
      ),
      [canManage, isDeletePending, isQuickDeleteActive, onDelete, onEdit, onRestore]
    );

    const columns = useMemo(() => getExpenseColumns(canManage), [canManage]);

    return (
      <DataTable
        columns={columns}
        emptyMessage={`No expenses yet.${canManage ? " Add an expense to get started." : ""}`}
        filters={filters}
        getItemKey={getExpenseKey}
        infiniteScroll={{ hasNextPage, isFetchingNextPage }}
        infiniteScrollSentinelRef={scrollSentinelRef}
        isPending={isPending}
        items={expenses}
        renderRow={renderExpenseRow}
        virtualization={{ estimateRowHeight: EXPENSE_ROW_ESTIMATED_HEIGHT }}
      />
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
    categoryTypes,
    createOpen,
    editExpense,
    importCsvOpen,
    onCreateOpenChange,
    onEditOpenChange,
    onImportCsvOpenChange,
    propertyId,
  }: {
    categoryTypes: IPropertyExpenseCategoryType[];
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
        categoryTypes={categoryTypes}
        onOpenChange={onCreateOpenChange}
        open={createOpen}
        propertyId={propertyId}
      />
      <ImportExpenseCsvDialog
        categoryTypes={categoryTypes}
        onOpenChange={onImportCsvOpenChange}
        open={importCsvOpen}
        propertyId={propertyId}
      />
      {editExpense ? (
        <EditExpenseDialog
          categoryTypes={categoryTypes}
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
  const { categoryId, from, to } = urlFilters;

  const settingsQuery = useQuery({
    queryFn: () => settingsApi.get(propertyId),
    queryKey: adminQueryKeys.propertySettings(propertyId),
  });

  const categoryTypes = useMemo(
    () => settingsQuery.data?.settings.expenseCategoryTypes ?? [],
    [settingsQuery.data?.settings.expenseCategoryTypes]
  );

  const filters = useMemo(() => buildExpenseFilters(categoryId, from, to), [categoryId, from, to]);

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

  const { deleteConfirmationDialog, handleDelete, isQuickDeleteActive } =
    useQuickDelete<IPropertyExpense>({
      deleteFn: (expense, onDeleted) => deleteMutation.mutate(expense, { onSuccess: onDeleted }),
      getConfirmationOptions: (expense) => ({
        description: `Delete "${expense.categoryName}" expense? It will be hidden from reports.`,
        target: expense,
        title: "Delete expense",
      }),
      isPending: deleteMutation.isPending,
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

  const handleOpenCreate = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleOpenImportCsv = useCallback(() => {
    setImportCsvOpen(true);
  }, []);

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
        <CardContent className="space-y-4 p-0">
          <PropertyExpensesTable
            canManage={canManage}
            expenses={expenses}
            filters={
              <PropertyExpensesFilters
                categoryId={categoryId}
                categoryTypes={categoryTypes}
                from={from}
                onCategoryIdChange={(value) => setFilter("categoryId", value)}
                onFromChange={(value) => setFilter("from", value)}
                onToChange={(value) => setFilter("to", value)}
                to={to}
              />
            }
            hasNextPage={hasNextPage}
            isDeletePending={deleteMutation.isPending}
            isFetchingNextPage={isFetchingNextPage}
            isPending={isPending}
            isQuickDeleteActive={isQuickDeleteActive}
            onDelete={handleDelete}
            onEdit={setEditExpense}
            onRestore={handleRestoreExpense}
            scrollSentinelRef={scrollSentinelRef}
          />
        </CardContent>
      </Card>

      {deleteConfirmationDialog}

      <PropertyExpensesPageDialogs
        categoryTypes={categoryTypes}
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
