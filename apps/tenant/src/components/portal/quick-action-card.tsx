import { type LucideIcon } from "lucide-react";
import { memo, type MouseEvent } from "react";
import { Link } from "react-router-dom";

import { Button, cn } from "@/packages/app-ui";

interface IQuickActionCardProps {
  disabled?: boolean;
  href?: string;
  icon: LucideIcon;
  label: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export const QuickActionCard = memo(function QuickActionCard({
  disabled = false,
  href,
  icon: Icon,
  label,
  onClick,
}: IQuickActionCardProps) {
  const className = cn(
    "flex h-auto w-full flex-col items-center justify-center gap-3 rounded-2xl border border-border/80 bg-card/85 px-4 py-6 text-center shadow-sm transition-colors",
    disabled
      ? "cursor-not-allowed opacity-60"
      : "hover:border-primary/40 hover:bg-card"
  );

  const content = (
    <>
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </>
  );

  if (href && !disabled) {
    return (
      <Button asChild className={className} type="button" variant="outline">
        <Link to={href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button
      className={className}
      disabled={disabled}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      {content}
    </Button>
  );
});
QuickActionCard.displayName = "QuickActionCard";
