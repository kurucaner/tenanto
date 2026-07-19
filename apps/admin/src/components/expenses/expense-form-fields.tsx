import { memo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/ui/field-label";
import { FormSelectField } from "@/components/ui/form-select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { type IPropertyExpenseCategoryType } from "@/packages/shared";

interface ExpenseFormFieldsProps {
  amount: string;
  amountError?: string;
  cashExpense: boolean;
  categoryId: string;
  categoryTypes: IPropertyExpenseCategoryType[];
  description: string;
  descriptionError?: string;
  expenseDate: string;
  expenseDateError?: string;
  expenseDateRequired?: boolean;
  idPrefix: string;
  maxDate?: string;
  onAmountChange: (value: string) => void;
  onCashExpenseChange: (value: boolean) => void;
  onCategoryChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onExpenseDateChange: (value: string) => void;
}

export const ExpenseFormFields = memo(
  ({
    amount,
    amountError,
    cashExpense,
    categoryId,
    categoryTypes,
    description,
    descriptionError,
    expenseDate,
    expenseDateError,
    expenseDateRequired = false,
    idPrefix,
    maxDate,
    onAmountChange,
    onCashExpenseChange,
    onCategoryChange,
    onDescriptionChange,
    onExpenseDateChange,
  }: ExpenseFormFieldsProps) => {
    const selectedCategory = categoryTypes.find((t) => t.id === categoryId);

    return (
      <>
        <FormSelectField
          id={`${idPrefix}-category`}
          label="Category"
          onChange={(e) => onCategoryChange(e.target.value)}
          options={categoryTypes.map((cat) => ({ label: cat.name, value: cat.id }))}
          value={categoryId}
        />

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

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-description`} optional>
            Description
          </FieldLabel>
          <Input
            id={`${idPrefix}-description`}
            onChange={(e) => onDescriptionChange(e.target.value)}
            value={description}
          />
          {descriptionError ? <p className="text-xs text-destructive">{descriptionError}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={cashExpense}
            id={`${idPrefix}-cash-expense`}
            onCheckedChange={(checked) => onCashExpenseChange(checked === true)}
          />
          <Label htmlFor={`${idPrefix}-cash-expense`}>Paid in cash</Label>
        </div>

        {selectedCategory?.isAnnualAmount ? (
          <p className="text-muted-foreground text-xs">
            This amount will be spread evenly across all months in reports.
          </p>
        ) : null}
      </>
    );
  }
);
ExpenseFormFields.displayName = "ExpenseFormFields";
