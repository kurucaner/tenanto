import type { Appearance, StripeElementsOptions } from "@stripe/stripe-js";

function buildStripeAppearance(isDark: boolean): Appearance {
  return {
    theme: isDark ? "night" : "stripe",
    variables: {
      borderRadius: "0.5rem",
    },
  };
}

export function buildStripeElementsOptions(input: {
  clientSecret: string;
  isDark: boolean;
}): StripeElementsOptions {
  return {
    appearance: buildStripeAppearance(input.isDark),
    clientSecret: input.clientSecret,
  };
}
