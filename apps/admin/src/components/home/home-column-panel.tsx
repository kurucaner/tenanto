import { ChevronRight, type LucideIcon, Rocket } from "lucide-react";
import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HomeColumnEmptyStateProps {
  href?: string;
  icon?: LucideIcon;
  message: string;
  onClick?: () => void;
}

export const HomeColumnEmptyState = memo(
  ({ href, icon: Icon = Rocket, message, onClick }: HomeColumnEmptyStateProps) => {
    const isInteractive = Boolean(href ?? onClick);
    const className = cn(
      "flex w-full items-center justify-center gap-2 bg-muted/50 px-3 py-3 text-muted-foreground",
      isInteractive &&
        "cursor-pointer transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    );
    const content = (
      <>
        <Icon aria-hidden className="size-4 shrink-0" />
        <p className="text-sm">{message}</p>
      </>
    );

    if (href) {
      return (
        <Link className={className} to={href}>
          {content}
        </Link>
      );
    }

    if (onClick) {
      return (
        <button className={className} onClick={onClick} type="button">
          {content}
        </button>
      );
    }

    return <div className={className}>{content}</div>;
  }
);
HomeColumnEmptyState.displayName = "HomeColumnEmptyState";

interface HomeColumnPanelProps {
  children?: ReactNode;
  className?: string;
  emptyHref?: string;
  emptyIcon?: LucideIcon;
  emptyMessage?: string;
  emptyOnClick?: () => void;
  emptyTooltip?: string;
  headerHref?: string;
  title: string;
}

export const HomeColumnPanel = memo(
  ({
    children,
    className,
    emptyHref,
    emptyIcon,
    emptyMessage,
    emptyOnClick,
    emptyTooltip,
    headerHref,
    title,
  }: HomeColumnPanelProps) => {
    const emptyState =
      emptyMessage && children == null ? (
        <HomeColumnEmptyState
          href={emptyHref}
          icon={emptyIcon}
          message={emptyMessage}
          onClick={emptyOnClick}
        />
      ) : null;

    return (
      <section className={cn("flex min-w-0 flex-col", className)}>
        {headerHref ? (
          <Link
            className="group mb-2 inline-flex items-center gap-0.5 text-sm font-medium text-foreground"
            to={headerHref}
          >
            {title}
            <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <h2 className="mb-2 text-sm font-medium text-foreground">{title}</h2>
        )}
        <div className="overflow-hidden rounded-lg border border-border/80 bg-card/30 divide-y divide-border/60">
          {children}
          {emptyState && emptyTooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex w-full">{emptyState}</span>
              </TooltipTrigger>
              <TooltipContent side="top">{emptyTooltip}</TooltipContent>
            </Tooltip>
          ) : (
            emptyState
          )}
        </div>
      </section>
    );
  }
);
HomeColumnPanel.displayName = "HomeColumnPanel";

interface HomeColumnRowProps {
  children: ReactNode;
  className?: string;
  href: string;
}

export const HomeColumnRow = memo(({ children, className, href }: HomeColumnRowProps) => {
  const rowClassName = cn(
    "group flex min-h-11 items-center gap-2.5 px-3 py-2 text-sm transition-colors",
    "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    className
  );

  return (
    <Link className={rowClassName} to={href}>
      {children}
    </Link>
  );
});
HomeColumnRow.displayName = "HomeColumnRow";
