import { cn } from "@/lib/utils";
import { ExpenseCategory, getExpenseCategoryMeta, type TExpenseCategory } from "@/packages/shared";

export const expenseSelectClassName = cn(
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30"
);

export const EXPENSE_CATEGORY_OPTIONS: { label: string; value: TExpenseCategory }[] = [
  { label: "Airbnb commission", value: ExpenseCategory.AIRBNB_COMMISSION },
  { label: "Booking commission", value: ExpenseCategory.BOOKING_COMMISSION },
  { label: "Expedia commission", value: ExpenseCategory.EXPEDIA_COMMISSION },
  { label: "Merchant commission", value: ExpenseCategory.MERCHANT_COMMISSION },
  { label: "Property tax", value: ExpenseCategory.PROPERTY_TAX },
  { label: "Insurance", value: ExpenseCategory.INSURANCE },
  { label: "Credit payment", value: ExpenseCategory.CREDIT_PAYMENT },
  { label: "Electricity", value: ExpenseCategory.ELECTRICITY },
  { label: "Water", value: ExpenseCategory.WATER },
  { label: "Internet", value: ExpenseCategory.INTERNET },
  { label: "Gas", value: ExpenseCategory.GAS },
  { label: "Fire alarm", value: ExpenseCategory.FIRE_ALARM },
  { label: "Sewerage", value: ExpenseCategory.SEWERAGE },
  { label: "Waste management", value: ExpenseCategory.WASTE_MANAGEMENT },
  { label: "Phone", value: ExpenseCategory.PHONE },
  { label: "Legal fee / permit", value: ExpenseCategory.LEGAL_FEE_PERMIT },
  { label: "Subscription", value: ExpenseCategory.SUBSCRIPTION },
  { label: "Cleaning", value: ExpenseCategory.CLEANING },
  { label: "Salary", value: ExpenseCategory.SALARY },
  { label: "Material", value: ExpenseCategory.MATERIAL },
  { label: "Maintenance", value: ExpenseCategory.MAINTENANCE },
  { label: "Other", value: ExpenseCategory.OTHER },
];

export const EXPENSE_CATEGORY_FILTER_OPTIONS = [
  { label: "All categories", value: "" },
  ...EXPENSE_CATEGORY_OPTIONS,
];

export function formatExpenseCategoryLabel(category: TExpenseCategory): string {
  return EXPENSE_CATEGORY_OPTIONS.find((opt) => opt.value === category)?.label ?? category;
}

export function getExpenseCategoryHint(category: TExpenseCategory): string | null {
  const meta = getExpenseCategoryMeta(category);
  if (meta.isAnnualAmount) {
    return "Enter the annual amount; monthly allocation will appear in reports.";
  }
  if (meta.isCommission) {
    return "Stay income already deducts channel commission; use only if recording separately.";
  }
  return null;
}
