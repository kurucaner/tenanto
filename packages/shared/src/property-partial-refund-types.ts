import type { IPropertyIncomeLineComputedFields } from "./property-income-line-types";
import type { IPropertyTaxBreakdownItem } from "./property-settings-types";

/** Optional body for POST .../refund. Omit `amount` for a full refund. */
export interface IRefundLedgerEntryBody {
  amount?: number;
}

/** Amounts scaled for report aggregation after a partial or full refund. */
export interface IReportableStayAmounts {
  channelCommission: number;
  channelCommissionRate: number;
  cleaningFee: number;
  grossIncome: number;
  netIncome: number;
  roomTotal: number;
  taxBreakdown: IPropertyTaxBreakdownItem[];
}

export type TReportableIncomeLineAmounts = IPropertyIncomeLineComputedFields & {
  amount: number;
};
