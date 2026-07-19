import { z } from "zod";

import { requiredPositiveMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate, isDateOnOrBefore } from "@/lib/reservation-date-utils";
import { type IPropertyExpense } from "@/packages/shared";

const expenseFormFields = {
  amount: requiredPositiveMoneyField("Amount"),
  cashExpense: z.boolean(),
  categoryId: z.string().min(1, "Category is required"),
  description: z.string(),
};

export const createExpenseFormSchema = z.object({
  ...expenseFormFields,
  expenseDate: z
    .string()
    .min(1, "Date is required")
    .refine((value) => isDateOnOrBefore(value, getTodayLocalIsoDate()), {
      message: "Date cannot be in the future",
    }),
});

export const editExpenseFormSchema = z.object({
  ...expenseFormFields,
  expenseDate: z.string().refine((value) => value === "" || isDateOnOrBefore(value, getTodayLocalIsoDate()), {
    message: "Date cannot be in the future",
  }),
});

export type TCreateExpenseFormValues = z.infer<typeof createExpenseFormSchema>;
export type TEditExpenseFormValues = z.infer<typeof editExpenseFormSchema>;

export function emptyCreateExpenseFormValues(firstCategoryId: string): TCreateExpenseFormValues {
  return {
    amount: "",
    cashExpense: false,
    categoryId: firstCategoryId,
    description: "",
    expenseDate: getTodayLocalIsoDate(),
  };
}

export function expenseToFormValues(expense: IPropertyExpense): TEditExpenseFormValues {
  return {
    amount: String(expense.amount),
    cashExpense: expense.cashExpense,
    categoryId: expense.categoryId,
    description: expense.description ?? "",
    expenseDate: expense.expenseDate ?? "",
  };
}
