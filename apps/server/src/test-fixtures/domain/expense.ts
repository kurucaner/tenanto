import { type IPropertyExpense } from "@/packages/shared";

export function makeExpense(overrides: Partial<IPropertyExpense> = {}): IPropertyExpense {
  return {
    amount: 125.5,
    cashExpense: false,
    categoryId: "cat-1",
    categoryIsAnnualAmount: false,
    categoryName: "Maintenance",
    createdAt: "2026-03-15T10:00:00.000Z",
    deletedAt: null,
    description: 'Pipe repair, 1" fitting',
    expenseDate: "2026-03-10",
    id: "expense-1",
    isDeleted: false,
    propertyId: "property-1",
    stripeBalanceTransactionId: null,
    updatedAt: "2026-03-15T10:00:00.000Z",
    ...overrides,
  };
}
