import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MoreHorizontal, Pencil, Plus, Sparkles } from "lucide-react";
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
import { DeletedBadge, RestoreEntityButton } from "@/components/deleted-badge";
import { CreateExpenseDialog } from "@/components/expenses/create-expense-dialog";
import { EditExpenseDialog } from "@/components/expenses/edit-expense-dialog";
import { type TExpenseFilterKey } from "@/components/expenses/expense-filter-panel";
import { ImportExpenseCsvDialog } from "@/components/expenses/import-expense-csv-dialog";
import { PropertyExpenseToolbar } from "@/components/expenses/property-expense-toolbar";
import { PropertyTableExportDialog } from "@/components/exports/property-table-export-dialog";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { TableIconButton } from "@/components/table/table-icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { useLedgerUrlSearch } from "@/hooks/use-ledger-url-search";
import {
  type TPropertyExpensesListFilters,
  usePropertyExpensesInfiniteList,
} from "@/hooks/use-property-expenses-infinite-list";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useQuickDelete } from "@/hooks/use-quick-delete";
import { useUrlDateRangeFilter } from "@/hooks/use-url-date-range-filter";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { expensesApi, settingsApi } from "@/lib/api-client";
import { getDateRangeSummary } from "@/lib/date-range-presets";
import {
  buildExpenseToolbarClearAllPatch,
  buildExpenseToolbarClearOnePatch,
  buildExpenseToolbarFilterItems,
  countExpenseSecondaryFilters,
  type TExpenseToolbarFilterId,
} from "@/lib/expense-toolbar-filters";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyExpenseCaches } from "@/lib/invalidate-property-expense-caches";
import { deletedRowClassName } from "@/lib/ledger-entry-row-styles";
import { formatExpenseExportFilterSummary } from "@/lib/property-export-utils";
import { queryKeys } from "@/lib/query-keys";
import { getDefaultReportDateRange } from "@/lib/report-date-defaults";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  ExportResourceType,
  type IPropertyExpense,
  type IPropertyExpenseCategoryType,
} from "@/packages/shared";

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
                <TableIconButton
                  ariaLabel="Edit expense"
                  onClick={() => onEdit(expense)}
                  tooltip="Edit expense"
                >
                  <Pencil className="size-3.5" />
                </TableIconButton>
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

function buildExpenseFilters(
  categoryId: string,
  effectiveFrom: string,
  effectiveTo: string,
  q: string
): TPropertyExpensesListFilters {
  const next: TPropertyExpensesListFilters = {};
  if (effectiveFrom) next.from = effectiveFrom;
  if (effectiveTo) next.to = effectiveTo;
  if (categoryId) next.categoryId = categoryId;
  const qTrim = q.trim();
  if (qTrim) next.q = qTrim;
  return next;
}

function handleEditDialogOpenChange(open: boolean, clearSelection: () => void): void {
  if (!open) {
    clearSelection();
  }
}

const PropertyExpensesTable = memo(
  ({
    canManage,
    expenses,
    hasNextPage,
    isDeletePending,
    isFetchingNextPage,
    isPending,
    isQuickDeleteActive,
    onDelete,
    onEdit,
    onRestore,
    scrollSentinelRef,
    toolbar,
  }: {
    canManage: boolean;
    expenses: IPropertyExpense[];
    hasNextPage: boolean;
    isDeletePending: boolean;
    isFetchingNextPage: boolean;
    isPending: boolean;
    isQuickDeleteActive: boolean;
    onDelete: (expense: IPropertyExpense, event?: MouseEvent<HTMLButtonElement>) => void;
    onEdit: (expense: IPropertyExpense) => void;
    onRestore: (expense: IPropertyExpense) => void;
    scrollSentinelRef: RefObject<HTMLDivElement | null>;
    toolbar: ReactNode;
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
        getItemKey={getExpenseKey}
        infiniteScroll={{ hasNextPage, isFetchingNextPage }}
        infiniteScrollSentinelRef={scrollSentinelRef}
        isPending={isPending}
        items={expenses}
        renderRow={renderExpenseRow}
        toolbar={toolbar}
        virtualization={{ estimateRowHeight: EXPENSE_ROW_ESTIMATED_HEIGHT }}
      />
    );
  }
);
PropertyExpensesTable.displayName = "PropertyExpensesTable";

const PropertyExpensesPageActions = memo(
  ({
    canManage,
    onExportTable,
    onImportCsv,
    onOpenCreate,
  }: {
    canManage: boolean;
    onExportTable: () => void;
    onImportCsv: () => void;
    onOpenCreate: () => void;
  }) => (
    <div className="flex items-center gap-2">
      {canManage ? (
        <Button className="gap-1.5" onClick={onOpenCreate} size="sm" type="button">
          <Plus className="size-3.5" />
          Add Expense
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="More expense actions"
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onExportTable}>
            <Download />
            Export table
          </DropdownMenuItem>
          {canManage ? (
            <DropdownMenuItem onSelect={onImportCsv}>
              <Sparkles />
              Import CSV
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
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
  onExportTable: () => void,
  onImportCsv: () => void,
  onOpenCreate: () => void
) {
  const pageActions = useMemo(
    () => (
      <PropertyExpensesPageActions
        canManage={canManage}
        onExportTable={onExportTable}
        onImportCsv={onImportCsv}
        onOpenCreate={onOpenCreate}
      />
    ),
    [canManage, onExportTable, onImportCsv, onOpenCreate]
  );

  usePropertyShellActions(pageActions);
}

export const PropertyExpensesPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [exportTableOpen, setExportTableOpen] = useState(false);
  const [importCsvOpen, setImportCsvOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<IPropertyExpense | null>(null);

  const defaultDateRange = useMemo(() => getDefaultReportDateRange(), []);
  const expenseFilterSchema = useMemo(
    () =>
      defineUrlFilterSchema<{
        allTime: string;
        categoryId: string;
        from: string;
        q: string;
        to: string;
      }>({
        allTime: { defaultValue: "" },
        categoryId: { defaultValue: "" },
        from: { defaultValue: defaultDateRange.from },
        q: { defaultValue: "" },
        to: { defaultValue: defaultDateRange.to },
      }),
    [defaultDateRange.from, defaultDateRange.to]
  );

  const { filters, setFilter, setFilters } = useUrlFilterState(expenseFilterSchema);
  const { allTime: allTimeParam, categoryId, from, q, to } = filters;
  const allTime = allTimeParam === "true";
  const {
    activePreset,
    displayFrom,
    displayTo,
    effectiveFrom,
    effectiveTo,
    onFromChange,
    onPresetChange,
    onToChange,
  } = useUrlDateRangeFilter({
    allTime,
    dateFilterSchema: expenseFilterSchema,
    from,
    to,
  });
  const { onSearchInputChange: handleSearchInputChange, searchInput } = useLedgerUrlSearch(
    q,
    setFilter
  );

  const settingsQuery = useQuery({
    queryFn: () => settingsApi.get(propertyId),
    queryKey: queryKeys.propertySettings(propertyId),
  });

  const categoryTypes = useMemo(
    () => settingsQuery.data?.settings.expenseCategoryTypes ?? [],
    [settingsQuery.data?.settings.expenseCategoryTypes]
  );

  const categoryFilterOptions = useMemo(
    () => categoryTypes.map((category) => ({ label: category.name, value: category.id })),
    [categoryTypes]
  );

  const activeSecondaryFilterCount = useMemo(
    () => countExpenseSecondaryFilters({ categoryId }),
    [categoryId]
  );

  const dateSummary = getDateRangeSummary(activePreset, displayFrom, displayTo);
  const activeFilterItems = useMemo(
    () =>
      buildExpenseToolbarFilterItems({
        activePreset,
        categoryId,
        categoryOptions: categoryFilterOptions,
        dateSummary,
        isDefaultDateRange:
          !allTime && from === defaultDateRange.from && to === defaultDateRange.to,
      }),
    [
      activePreset,
      allTime,
      categoryFilterOptions,
      categoryId,
      dateSummary,
      defaultDateRange.from,
      defaultDateRange.to,
      from,
      to,
    ]
  );

  const handleExpenseFilterChange = useCallback(
    (key: TExpenseFilterKey, value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  const handleClearSecondaryFilters = useCallback(() => {
    setFilters({ categoryId: "" });
  }, [setFilters]);

  const handleRemoveToolbarFilter = useCallback(
    (id: TExpenseToolbarFilterId) => {
      setFilters(buildExpenseToolbarClearOnePatch(id, defaultDateRange));
    },
    [defaultDateRange, setFilters]
  );

  const handleClearAllToolbarFilters = useCallback(() => {
    handleSearchInputChange("");
    setFilters(buildExpenseToolbarClearAllPatch(defaultDateRange));
  }, [defaultDateRange, handleSearchInputChange, setFilters]);

  const expenseListFilters = useMemo(
    () => buildExpenseFilters(categoryId, effectiveFrom, effectiveTo, q),
    [categoryId, effectiveFrom, effectiveTo, q]
  );

  const { expenses, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, meta } =
    usePropertyExpensesInfiniteList(propertyId, expenseListFilters);

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

  const handleOpenExportTable = useCallback(() => {
    setExportTableOpen(true);
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

  useRegisterExpensePageActions(
    canManage,
    handleOpenExportTable,
    handleOpenImportCsv,
    handleOpenCreate
  );

  return (
    <>
      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <PropertyExpensesTable
            canManage={canManage}
            expenses={expenses}
            hasNextPage={hasNextPage}
            isDeletePending={deleteMutation.isPending}
            isFetchingNextPage={isFetchingNextPage}
            isPending={isPending}
            isQuickDeleteActive={isQuickDeleteActive}
            onDelete={handleDelete}
            onEdit={setEditExpense}
            onRestore={handleRestoreExpense}
            scrollSentinelRef={scrollSentinelRef}
            toolbar={
              <PropertyExpenseToolbar
                activeFilterCount={activeSecondaryFilterCount}
                activeFilterItems={activeFilterItems}
                activePreset={activePreset}
                categoryFilterOptions={categoryFilterOptions}
                categoryId={categoryId}
                countLabel={meta ? `${meta.totalCount} entries` : undefined}
                from={displayFrom}
                onClearAll={handleClearAllToolbarFilters}
                onClearSecondaryFilters={handleClearSecondaryFilters}
                onFilterChange={handleExpenseFilterChange}
                onFromChange={onFromChange}
                onPresetChange={onPresetChange}
                onRemoveFilter={handleRemoveToolbarFilter}
                onSearchInputChange={handleSearchInputChange}
                onToChange={onToChange}
                searchInput={searchInput}
                to={displayTo}
              />
            }
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

      <PropertyTableExportDialog
        config={{ filters: expenseListFilters, resourceType: ExportResourceType.EXPENSES }}
        filterSummary={formatExpenseExportFilterSummary(expenseListFilters, categoryFilterOptions)}
        onOpenChange={setExportTableOpen}
        open={exportTableOpen}
        propertyId={propertyId}
      />
    </>
  );
});
PropertyExpensesPage.displayName = "PropertyExpensesPage";
