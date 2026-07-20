import { ChevronRight } from "lucide-react";
import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

interface HomeColumnPanelProps {
  children?: ReactNode;
  className?: string;
  emptyMessage?: string;
  headerHref?: string;
  title: string;
}

export const HomeColumnPanel = memo(
  ({ children, className, emptyMessage, headerHref, title }: HomeColumnPanelProps) => (
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
        {emptyMessage && children == null ? (
          <p className="px-3 py-4 text-muted-foreground text-xs">{emptyMessage}</p>
        ) : null}
      </div>
    </section>
  )
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
