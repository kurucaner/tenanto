import type { IPropertyExpensesListMeta } from "./list-meta-types";

export interface IPropertyExpense {
  amount: number;
  cashExpense: boolean;
  categoryId: string;
  categoryIsAnnualAmount: boolean;
  categoryName: string;
  createdAt: string;
  deletedAt: string | null;
  description: string | null;
  expenseDate: string | null;
  id: string;
  isDeleted: boolean;
  propertyId: string;
  /** Set for Stripe auto-booked processing-fee expenses; null for manual/import rows. */
  stripeBalanceTransactionId: string | null;
  updatedAt: string;
}

export interface ICreatePropertyExpenseBody {
  amount: number;
  cashExpense?: boolean;
  categoryId: string;
  description?: string;
  expenseDate?: string;
}

export interface IUpdatePropertyExpenseBody {
  amount?: number;
  cashExpense?: boolean;
  categoryId?: string;
  description?: string | null;
  expenseDate?: string | null;
}

export interface IPropertyExpensesListQuery {
  categoryId?: string;
  cursor?: string;
  from?: string;
  limit?: number;
  q?: string;
  to?: string;
}

export type TPropertyExpensesListFilters = Pick<
  IPropertyExpensesListQuery,
  "categoryId" | "from" | "q" | "to"
>;

export interface IPropertyExpensesListResponse {
  expenses: IPropertyExpense[];
  meta?: IPropertyExpensesListMeta;
  nextCursor: string | null;
}
