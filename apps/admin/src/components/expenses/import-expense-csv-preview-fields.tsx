import { AlertCircle, Trash2 } from "lucide-react";
import { memo } from "react";

import {
  expenseSelectClassName,
} from "@/components/expenses/expense-form-options";
import {
  AMOUNT_INPUT_CLASS_NAME,
  getImportPreviewRowValidationError,
  STICKY_ACTIONS_CELL_CLASS_NAME,
  STICKY_AMOUNT_CELL_CLASS_NAME,
  TABLE_AMOUNT_INPUT_CLASS_NAME,
} from "@/components/expenses/import-expense-csv-preview-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { cn } from "@/lib/utils";
import { type IExpenseImportParsedRow, type IPropertyExpenseCategoryType } from "@/packages/shared";

const CATEGORY_SELECT_CLASS_NAME = cn(expenseSelectClassName, "min-w-[11rem]");

function formatAmountInputValue(amount: number): string {
  return Number.isFinite(amount) ? String(amount) : "";
}

function parseAmountInputValue(value: string): number {
  if (value === "") {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface PreviewFieldContext {
  categoryTypes: IPropertyExpenseCategoryType[];
  idPrefix: string;
  onChange: (next: IExpenseImportParsedRow) => void;
  row: IExpenseImportParsedRow;
}

function renderCategorySelect({ categoryTypes, idPrefix, onChange, row }: PreviewFieldContext) {
  return (
    <select
      className={CATEGORY_SELECT_CLASS_NAME}
      id={`${idPrefix}-category`}
      onChange={(e) => onChange({ ...row, categoryId: e.target.value })}
      value={row.categoryId}
    >
      {categoryTypes.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
    </select>
  );
}

function renderDateInput({ idPrefix, onChange, row }: PreviewFieldContext) {
  return (
    <Input
      id={`${idPrefix}-date`}
      onChange={(e) => onChange({ ...row, expenseDate: e.target.value })}
      type="date"
      value={row.expenseDate ?? ""}
    />
  );
}

function renderDescriptionInput({ idPrefix, onChange, row }: PreviewFieldContext) {
  return (
    <Input
      id={`${idPrefix}-description`}
      onChange={(e) => onChange({ ...row, description: e.target.value })}
      value={row.description ?? ""}
    />
  );
}

function renderTaxFreeInput(
  { idPrefix, onChange, row }: PreviewFieldContext,
  labelClassName = "text-sm"
) {
  return (
    <label className={cn("flex items-center gap-2", labelClassName)}>
      <input
        checked={row.taxFree ?? false}
        id={`${idPrefix}-tax-free`}
        onChange={(e) => onChange({ ...row, taxFree: e.target.checked })}
        type="checkbox"
      />{" "}
      Tax-free
    </label>
  );
}

function renderAmountInput(
  { idPrefix, onChange, row }: PreviewFieldContext,
  variant: "card" | "table" = "card"
) {
  return (
    <Input
      className={variant === "table" ? TABLE_AMOUNT_INPUT_CLASS_NAME : AMOUNT_INPUT_CLASS_NAME}
      id={`${idPrefix}-amount`}
      inputMode="decimal"
      onChange={(e) => {
        if (!isValidDecimalInput(e.target.value)) {
          return;
        }
        onChange({ ...row, amount: parseAmountInputValue(e.target.value) });
      }}
      type="text"
      value={formatAmountInputValue(row.amount)}
    />
  );
}

interface ImportExpenseCsvPreviewFieldsProps extends PreviewFieldContext {
  variant: "card";
}

export const ImportExpenseCsvPreviewFields = memo(
  ({ categoryTypes, idPrefix, onChange, row, variant }: ImportExpenseCsvPreviewFieldsProps) => {
    const context: PreviewFieldContext = { categoryTypes, idPrefix, onChange, row };

    if (variant !== "card") {
      return null;
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-category`}>Category</Label>
          {renderCategorySelect(context)}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${idPrefix}-date`} optional>
              Date
            </FieldLabel>
            {renderDateInput(context)}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-amount`}>Amount</Label>
            {renderAmountInput(context)}
          </div>
          <div className="flex flex-col justify-end gap-1.5">{renderTaxFreeInput(context)}</div>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-description`} optional>
            Description
          </FieldLabel>
          {renderDescriptionInput(context)}
        </div>
      </div>
    );
  }
);
ImportExpenseCsvPreviewFields.displayName = "ImportExpenseCsvPreviewFields";

interface ImportExpenseCsvPreviewRowActionsProps {
  onRemove: () => void;
  row: IExpenseImportParsedRow;
}

const ImportExpenseCsvPreviewRowActions = memo(
  ({ onRemove, row }: ImportExpenseCsvPreviewRowActionsProps) => {
    const validationError = getImportPreviewRowValidationError(row);

    return (
      <div className="flex items-center gap-2">
        {validationError ? (
          <Badge title={validationError} variant="destructive">
            <AlertCircle className="size-3" />
          </Badge>
        ) : null}
        <Button
          aria-label="Remove row"
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    );
  }
);
ImportExpenseCsvPreviewRowActions.displayName = "ImportExpenseCsvPreviewRowActions";

interface ImportExpenseCsvPreviewCardProps {
  categoryTypes: IPropertyExpenseCategoryType[];
  idPrefix: string;
  onChange: (next: IExpenseImportParsedRow) => void;
  onRemove: () => void;
  row: IExpenseImportParsedRow;
}

export const ImportExpenseCsvPreviewCard = memo(
  ({ categoryTypes, idPrefix, onChange, onRemove, row }: ImportExpenseCsvPreviewCardProps) => (
    <article className="space-y-3 rounded-lg border p-4">
      <p className="truncate text-sm font-medium" title={row.sourceFileName}>
        {row.sourceFileName}
      </p>
      <ImportExpenseCsvPreviewFields
        categoryTypes={categoryTypes}
        idPrefix={idPrefix}
        onChange={onChange}
        row={row}
        variant="card"
      />
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <ImportExpenseCsvPreviewRowActions onRemove={onRemove} row={row} />
      </div>
    </article>
  )
);
ImportExpenseCsvPreviewCard.displayName = "ImportExpenseCsvPreviewCard";

interface ImportExpenseCsvPreviewTableRowProps {
  categoryTypes: IPropertyExpenseCategoryType[];
  idPrefix: string;
  onChange: (next: IExpenseImportParsedRow) => void;
  onRemove: () => void;
  row: IExpenseImportParsedRow;
}

export const ImportExpenseCsvPreviewTableRow = memo(
  ({ categoryTypes, idPrefix, onChange, onRemove, row }: ImportExpenseCsvPreviewTableRowProps) => {
    const context: PreviewFieldContext = { categoryTypes, idPrefix, onChange, row };

    return (
      <TableRow>
        <TableCell className="max-w-[120px] truncate text-xs" title={row.sourceFileName}>
          {row.sourceFileName}
        </TableCell>
        <TableCell className="whitespace-normal">{renderCategorySelect(context)}</TableCell>
        <TableCell>{renderDateInput(context)}</TableCell>
        <TableCell className="whitespace-normal">{renderDescriptionInput(context)}</TableCell>
        <TableCell>{renderTaxFreeInput(context, "text-xs")}</TableCell>
        <TableCell className={STICKY_AMOUNT_CELL_CLASS_NAME}>
          <div className="min-w-0">{renderAmountInput(context, "table")}</div>
        </TableCell>
        <TableCell className={STICKY_ACTIONS_CELL_CLASS_NAME}>
          <ImportExpenseCsvPreviewRowActions onRemove={onRemove} row={row} />
        </TableCell>
      </TableRow>
    );
  }
);
ImportExpenseCsvPreviewTableRow.displayName = "ImportExpenseCsvPreviewTableRow";
