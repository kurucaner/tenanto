export interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatEvent;
}

interface DisplayName {
  updated_at_ms: number;
  value: string;
}

interface Subscriberattributes {
  $displayName: DisplayName;
  $email: DisplayName;
  $phoneNumber: DisplayName;
  my_custom_attribute_1: DisplayName;
}

export interface RevenueCatEvent {
  aliases: string[];
  app_id: string;
  app_user_id: string;
  commission_percentage: null;
  country_code: string;
  currency: null;
  entitlement_id: null;
  entitlement_ids: null;
  environment: string;
  event_timestamp_ms: number;
  expiration_at_ms: number;
  id: string;
  is_family_share: null;
  metadata: null;
  offer_code: null;
  original_app_user_id: string;
  original_transaction_id: null;
  period_type: string;
  presented_offering_id: null;
  price: null;
  price_in_purchased_currency: null;
  product_id: string;
  purchased_at_ms: number;
  renewal_number: null;
  store: string;
  subscriber_attributes: Subscriberattributes;
  takehome_percentage: null;
  tax_percentage: null;
  transaction_id: null;
  type: string;
}
