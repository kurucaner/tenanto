/** Active expense category in property settings. Archived categories are omitted server-side and are not exposed on the API. */
export interface IPropertyExpenseCategoryType {
  id: string;
  isAnnualAmount: boolean;
  name: string;
  propertyId: string;
  sortOrder: number;
}

export interface IPropertyExpenseCategoryTypeInput {
  id?: string;
  isAnnualAmount?: boolean;
  name: string;
  sortOrder: number;
}

/**
 * Fixed name for the server-managed Stripe processing-fee expense category.
 * Ensured per property (like system income types) — not in {@link DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES}
 * so replaceAll cannot wipe it as a normal default.
 */
export const SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME = "Payment processing";

export function isSystemPaymentProcessingExpenseCategoryName(name: string): boolean {
  return name.toLowerCase() === SYSTEM_PAYMENT_PROCESSING_EXPENSE_CATEGORY_NAME.toLowerCase();
}

/** User-managed expense categories seeded for new properties (excludes system types). */
export const DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES: Pick<
  IPropertyExpenseCategoryTypeInput,
  "isAnnualAmount" | "name"
>[] = [
  { isAnnualAmount: false, name: "Cleaning" },
  { isAnnualAmount: false, name: "Credit payment" },
  { isAnnualAmount: false, name: "Electricity" },
  { isAnnualAmount: false, name: "Fire alarm" },
  { isAnnualAmount: false, name: "Gas" },
  { isAnnualAmount: true, name: "Insurance" },
  { isAnnualAmount: false, name: "Internet" },
  { isAnnualAmount: false, name: "Legal fee / permit" },
  { isAnnualAmount: false, name: "Maintenance" },
  { isAnnualAmount: false, name: "Material" },
  { isAnnualAmount: false, name: "Other" },
  { isAnnualAmount: false, name: "Phone" },
  { isAnnualAmount: true, name: "Property tax" },
  { isAnnualAmount: false, name: "Salary" },
  { isAnnualAmount: false, name: "Sewerage" },
  { isAnnualAmount: false, name: "Subscription" },
  { isAnnualAmount: false, name: "Waste management" },
  { isAnnualAmount: false, name: "Water" },
];
