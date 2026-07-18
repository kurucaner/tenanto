import { type LucideIcon } from "lucide-react";
import { type ComponentProps, memo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TStripeConnectChoiceCardProps = {
  bullets: string[];
  className?: string;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  loadingLabel: string;
  onClick: () => void;
  pending: boolean;
  title: string;
  variant: ComponentProps<typeof Button>["variant"];
  footer?: ReactNode;
};

export const StripeConnectChoiceCard = memo(function StripeConnectChoiceCard({
  bullets,
  className,
  disabled,
  footer,
  icon: Icon,
  label,
  loadingLabel,
  onClick,
  pending,
  title,
  variant,
}: TStripeConnectChoiceCardProps) {
  return (
    <div
      className={cn(
        "border-border flex flex-col gap-4 rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="bg-background text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="font-medium leading-snug">{title}</h3>
          <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-sm">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      </div>
      <Button
        className="w-full"
        disabled={disabled}
        onClick={onClick}
        type="button"
        variant={variant}
      >
        {pending ? loadingLabel : label}
      </Button>
      {footer}
    </div>
  );
});
StripeConnectChoiceCard.displayName = "StripeConnectChoiceCard";
