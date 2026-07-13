export const IncomeRefundFilter = {
  NOT_REFUNDED: "not_refunded",
  REFUNDED: "refunded",
} as const;

export type TIncomeRefundFilter = (typeof IncomeRefundFilter)[keyof typeof IncomeRefundFilter];

export const INCOME_REFUND_FILTER_VALUES = Object.values(IncomeRefundFilter);
