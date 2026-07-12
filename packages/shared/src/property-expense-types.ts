import type { IPropertyExpensesListMeta } from "./list-meta-types";

export interface IPropertyExpense {
  amount: number;
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
  taxFree: boolean;
  updatedAt: string;
}

export interface ICreatePropertyExpenseBody {
  amount: number;
  categoryId: string;
  description?: string;
  expenseDate?: string;
  taxFree?: boolean;
}

export interface IUpdatePropertyExpenseBody {
  amount?: number;
  categoryId?: string;
  description?: string | null;
  expenseDate?: string | null;
  taxFree?: boolean;
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
