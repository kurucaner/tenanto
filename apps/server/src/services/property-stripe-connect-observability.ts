import type { TStripeConnectOAuthCallbackReason } from "@/lib/stripe-connect-oauth-callback";
import {
  PropertyStripeAccountType,
  type TPropertyStripeAccountType,
} from "@/packages/shared";

import { WinstonLogger } from "./winston";

export interface IPropertyStripeConnectOAuthLogContext {
  accountType: TPropertyStripeAccountType;
  propertyId: string;
}

export function buildPropertyStripeConnectOAuthLogContext(input: {
  accountType: TPropertyStripeAccountType;
  propertyId: string;
}): IPropertyStripeConnectOAuthLogContext {
  return {
    accountType: input.accountType,
    propertyId: input.propertyId,
  };
}

export function logPropertyStripeConnectOAuthStarted(input: {
  propertyId: string;
  userId: string;
}): void {
  WinstonLogger.info({
    ...buildPropertyStripeConnectOAuthLogContext({
      accountType: PropertyStripeAccountType.STANDARD,
      propertyId: input.propertyId,
    }),
    msg: "tenant_payments.connect_oauth_started",
    userId: input.userId,
  });
}

export function logPropertyStripeConnectOAuthCompleted(input: {
  accountType: TPropertyStripeAccountType;
  propertyId: string;
  stripeAccountId: string;
}): void {
  WinstonLogger.info({
    ...buildPropertyStripeConnectOAuthLogContext(input),
    msg: "tenant_payments.connect_oauth_completed",
    stripeAccountId: input.stripeAccountId,
  });
}

export function logPropertyStripeConnectOAuthFailed(input: {
  accountType: TPropertyStripeAccountType;
  err?: unknown;
  propertyId?: string;
  reason: TStripeConnectOAuthCallbackReason;
}): void {
  WinstonLogger.error({
    ...(input.err != null ? { err: input.err } : {}),
    accountType: input.accountType,
    msg: "tenant_payments.connect_oauth_failed",
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    reason: input.reason,
  });
}

export function logPropertyStripeConnectOAuthCallbackUnhandledError(error: unknown): void {
  WinstonLogger.error({
    err: error,
    msg: "tenant_payments.connect_oauth_callback_failed",
  });
}
