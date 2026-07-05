import { memo } from "react";

import { cn } from "@/lib/utils";

export type AdminPageIntroProps = {
  className?: string;
  description?: string;
  eyebrow: string;
  title: string;
};

export const AdminPageIntro = memo(
  ({ className, description, eyebrow, title }: AdminPageIntroProps) => (
    <header className={cn("flex flex-col gap-2", className)}>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </header>
  ),
);
AdminPageIntro.displayName = "AdminPageIntro";
