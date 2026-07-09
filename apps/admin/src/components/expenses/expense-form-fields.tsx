import { memo } from "react";

import {
  EXPENSE_CATEGORY_OPTIONS,
  expenseSelectClassName,
  getExpenseCategoryHint,
} from "@/components/expenses/expense-form-options";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { getExpenseCategoryMeta, type TExpenseCategory } from "@/packages/shared";

interface ExpenseFormFieldsProps {
  amount: string;
  amountError?: string;
  category: TExpenseCategory;
  description: string;
  descriptionError?: string;
  expenseDate: string;
  expenseDateError?: string;
  expenseDateRequired?: boolean;
  idPrefix: string;
  maxDate?: string;
  onAmountChange: (value: string) => void;
  onCategoryChange: (value: TExpenseCategory) => void;
  onDescriptionChange: (value: string) => void;
  onExpenseDateChange: (value: string) => void;
  onPersonNameChange: (value: string) => void;
  onTaxFreeChange: (value: boolean) => void;
  personName: string;
  taxFree: boolean;
}

export const ExpenseFormFields = memo(
  ({
    amount,
    amountError,
    category,
    description,
    descriptionError,
    expenseDate,
    expenseDateError,
    expenseDateRequired = false,
    idPrefix,
    maxDate,
    onAmountChange,
    onCategoryChange,
    onDescriptionChange,
    onExpenseDateChange,
    onPersonNameChange,
    onTaxFreeChange,
    personName,
    taxFree,
  }: ExpenseFormFieldsProps) => {
    const meta = getExpenseCategoryMeta(category);
    const hint = getExpenseCategoryHint(category);

    return (
      <>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-category`}>Category</Label>
          <select
            className={expenseSelectClassName}
            id={`${idPrefix}-category`}
            onChange={(e) => onCategoryChange(e.target.value as TExpenseCategory)}
            value={category}
          >
            {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-amount`}>Amount</Label>
            <Input
              autoFocus
              id={`${idPrefix}-amount`}
              inputMode="decimal"
              onChange={(e) => {
                if (isValidDecimalInput(e.target.value)) onAmountChange(e.target.value);
              }}
              type="text"
              value={amount}
            />
            {amountError ? <p className="text-xs text-destructive">{amountError}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${idPrefix}-date`} optional={!expenseDateRequired}>
              Date
            </FieldLabel>
            <Input
              id={`${idPrefix}-date`}
              max={maxDate}
              onChange={(e) => onExpenseDateChange(e.target.value)}
              type="date"
              value={expenseDate}
            />
            {expenseDateError ? (
              <p className="text-xs text-destructive">{expenseDateError}</p>
            ) : null}
          </div>
        </div>

        {meta.showsPersonName ? (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${idPrefix}-person`} optional>
              Person name
            </FieldLabel>
            <Input
              id={`${idPrefix}-person`}
              onChange={(e) => onPersonNameChange(e.target.value)}
              value={personName}
            />
          </div>
        ) : null}

        {meta.requiresDescription ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-description`}>Description</Label>
            <Input
              id={`${idPrefix}-description`}
              onChange={(e) => onDescriptionChange(e.target.value)}
              required
              value={description}
            />
            {descriptionError ? (
              <p className="text-xs text-destructive">{descriptionError}</p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${idPrefix}-description`} optional>
              Description
            </FieldLabel>
            <Input
              id={`${idPrefix}-description`}
              onChange={(e) => onDescriptionChange(e.target.value)}
              value={description}
            />
            {descriptionError ? (
              <p className="text-xs text-destructive">{descriptionError}</p>
            ) : null}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            checked={taxFree}
            id={`${idPrefix}-tax-free`}
            onCheckedChange={(checked) => onTaxFreeChange(checked === true)}
          />
          <Label htmlFor={`${idPrefix}-tax-free`}>Tax-free expense</Label>
        </div>

        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </>
    );
  }
);
ExpenseFormFields.displayName = "ExpenseFormFields";
