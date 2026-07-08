export const ExpenseCategory = {
  AIRBNB_COMMISSION: "airbnb_commission",
  BOOKING_COMMISSION: "booking_commission",
  CLEANING: "cleaning",
  CREDIT_PAYMENT: "credit_payment",
  ELECTRICITY: "electricity",
  EXPEDIA_COMMISSION: "expedia_commission",
  FIRE_ALARM: "fire_alarm",
  GAS: "gas",
  INSURANCE: "insurance",
  INTERNET: "internet",
  LEGAL_FEE_PERMIT: "legal_fee_permit",
  MAINTENANCE: "maintenance",
  MATERIAL: "material",
  MERCHANT_COMMISSION: "merchant_commission",
  OTHER: "other",
  PHONE: "phone",
  PROPERTY_TAX: "property_tax",
  SALARY: "salary",
  SEWERAGE: "sewerage",
  SUBSCRIPTION: "subscription",
  WASTE_MANAGEMENT: "waste_management",
  WATER: "water",
} as const;

export type TExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export interface IPropertyExpense {
  amount: number;
  category: TExpenseCategory;
  createdAt: string;
  description: string | null;
  expenseDate: string | null;
  id: string;
  personName: string | null;
  propertyId: string;
  taxFree: boolean;
  updatedAt: string;
}

export interface ICreatePropertyExpenseBody {
  amount: number;
  category: TExpenseCategory;
  description?: string;
  expenseDate?: string;
  personName?: string;
  taxFree?: boolean;
}

export interface IUpdatePropertyExpenseBody {
  amount?: number;
  category?: TExpenseCategory;
  description?: string | null;
  expenseDate?: string | null;
  personName?: string | null;
  taxFree?: boolean;
}

export interface IPropertyExpensesListQuery {
  category?: TExpenseCategory;
  from?: string;
  to?: string;
}

export interface IExpenseCategoryMeta {
  isAnnualAmount: boolean;
  isCommission: boolean;
  requiresDescription: boolean;
  showsPersonName: boolean;
}

const COMMISSION_CATEGORIES = new Set<TExpenseCategory>([
  ExpenseCategory.AIRBNB_COMMISSION,
  ExpenseCategory.BOOKING_COMMISSION,
  ExpenseCategory.EXPEDIA_COMMISSION,
  ExpenseCategory.MERCHANT_COMMISSION,
]);

export function getExpenseCategoryMeta(category: TExpenseCategory): IExpenseCategoryMeta {
  return {
    isAnnualAmount:
      category === ExpenseCategory.PROPERTY_TAX || category === ExpenseCategory.INSURANCE,
    isCommission: COMMISSION_CATEGORIES.has(category),
    requiresDescription:
      category === ExpenseCategory.MATERIAL ||
      category === ExpenseCategory.MAINTENANCE ||
      category === ExpenseCategory.OTHER,
    showsPersonName:
      category === ExpenseCategory.CLEANING || category === ExpenseCategory.SALARY,
  };
}

export function validateExpenseCategoryFields(
  category: TExpenseCategory,
  fields: { description?: string | null }
): string | null {
  const meta = getExpenseCategoryMeta(category);
  if (meta.requiresDescription && !fields.description?.trim()) {
    return "description is required for this category";
  }
  return null;
}
