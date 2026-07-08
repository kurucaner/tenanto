import { memo } from "react";

import {
  EXPENSE_CATEGORY_OPTIONS,
  expenseSelectClassName,
  getExpenseCategoryHint,
} from "@/components/expenses/expense-form-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getExpenseCategoryMeta, type TExpenseCategory } from "@/packages/shared";

interface ExpenseFormFieldsProps {
  amount: string;
  category: TExpenseCategory;
  description: string;
  expenseDate: string;
  idPrefix: string;
  maxDate?: string;
  onAmountChange: (value: string) => void;
  onCategoryChange: (value: TExpenseCategory) => void;
  onDescriptionChange: (value: string) => void;
  onExpenseDateChange: (value: string) => void;
  onPersonNameChange: (value: string) => void;
  personName: string;
}

export const ExpenseFormFields = memo(
  ({
    amount,
    category,
    description,
    expenseDate,
    idPrefix,
    maxDate,
    onAmountChange,
    onCategoryChange,
    onDescriptionChange,
    onExpenseDateChange,
    onPersonNameChange,
    personName,
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
              onChange={(e) => onAmountChange(e.target.value)}
              type="text"
              value={amount}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-date`}>Date (optional)</Label>
            <Input
              id={`${idPrefix}-date`}
              max={maxDate}
              onChange={(e) => onExpenseDateChange(e.target.value)}
              type="date"
              value={expenseDate}
            />
          </div>
        </div>

        {meta.showsPersonName ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-person`}>Person name (optional)</Label>
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
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-description`}>Description (optional)</Label>
            <Input
              id={`${idPrefix}-description`}
              onChange={(e) => onDescriptionChange(e.target.value)}
              value={description}
            />
          </div>
        )}

        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </>
    );
  }
);
ExpenseFormFields.displayName = "ExpenseFormFields";
