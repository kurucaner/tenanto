import { Check } from "lucide-react";
import { memo } from "react";

import { cn } from "@/lib/utils";

const STEPS = [
  { id: "connected", label: "Connected" },
  { id: "details", label: "Finish Stripe details" },
  { id: "payments", label: "Accept payments" },
] as const;

/** Current incomplete setup is always step index 1 (Finish Stripe details). */
const CURRENT_STEP_INDEX = 1;

export const StripeConnectProgressSteps = memo(function StripeConnectProgressSteps() {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
      {STEPS.map((step, index) => {
        const isComplete = index < CURRENT_STEP_INDEX;
        const isCurrent = index === CURRENT_STEP_INDEX;

        return (
          <li
            className={cn(
              "flex items-center gap-2 text-sm",
              isCurrent ? "text-foreground font-medium" : "text-muted-foreground",
              index < STEPS.length - 1 && "sm:flex-1"
            )}
            key={step.id}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                isComplete && "border-primary bg-primary text-primary-foreground",
                isCurrent && "border-primary text-primary",
                !isComplete && !isCurrent && "border-border"
              )}
            >
              {isComplete ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span>{step.label}</span>
            {index < STEPS.length - 1 ? (
              <span aria-hidden className="bg-border mx-1 hidden h-px flex-1 sm:block" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
});
StripeConnectProgressSteps.displayName = "StripeConnectProgressSteps";
