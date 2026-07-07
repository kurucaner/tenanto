import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type AdminPageIntroProps = {
  actions?: ReactNode;
  className?: string;
  description?: string;
  eyebrow: string;
  title?: string;
};

export const AdminPageIntro = memo(
  ({ actions, className, description, eyebrow, title }: AdminPageIntroProps) => (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
        {title ? (
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
        ) : null}
        {description ? (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="ml-auto flex min-h-8 shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
);
AdminPageIntro.displayName = "AdminPageIntro";
