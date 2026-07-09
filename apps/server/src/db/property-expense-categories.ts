import { EXPENSE_CATEGORY_LABELS, ExpenseCategory, type TExpenseCategory } from "@/packages/shared";

import { pool } from "./pool";

export interface IPropertyExpenseCategoryOption {
  label: string;
  value: TExpenseCategory;
}

let cachedCategories: IPropertyExpenseCategoryOption[] | null = null;

export function clearPropertyExpenseCategoryCache(): void {
  cachedCategories = null;
}

export function buildPropertyExpenseCategoryOptions(
  values: readonly string[]
): IPropertyExpenseCategoryOption[] {
  return values.map((value) => {
    const category = value as TExpenseCategory;
    return {
      label: EXPENSE_CATEGORY_LABELS[category] ?? value,
      value: category,
    };
  });
}

export const propertyExpenseCategoriesDb = {
  async list(): Promise<IPropertyExpenseCategoryOption[]> {
    if (cachedCategories !== null) {
      return cachedCategories;
    }

    const result = await pool.query<{ value: string }>(
      `SELECT unnest(enum_range(NULL::property_expense_category))::text AS value`
    );
    cachedCategories = buildPropertyExpenseCategoryOptions(result.rows.map((row) => row.value));
    return cachedCategories;
  },

  async listValues(): Promise<TExpenseCategory[]> {
    const categories = await this.list();
    return categories.map((category) => category.value);
  },
};

export function getFallbackExpenseCategoryValues(): TExpenseCategory[] {
  return Object.values(ExpenseCategory);
}
