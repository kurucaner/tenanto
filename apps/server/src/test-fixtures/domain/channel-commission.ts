import {
  DEFAULT_PROPERTY_CHANNEL_COMMISSIONS,
  type IPropertyChannelCommission,
} from "@/packages/shared";

export function makeChannelCommission(
  defaults: (typeof DEFAULT_PROPERTY_CHANNEL_COMMISSIONS)[number],
  id: string,
  overrides: Partial<IPropertyChannelCommission> = {}
): IPropertyChannelCommission {
  return {
    excludeCleaningFromCommissionBase: defaults.excludeCleaningFromCommissionBase ?? false,
    excludeResortTaxFromPayout: defaults.excludeResortTaxFromPayout ?? false,
    id,
    name: defaults.name,
    propertyId: "prop-1",
    rate: defaults.rate,
    sortOrder: 1,
    ...overrides,
  };
}

export const makeChannel = makeChannelCommission;
