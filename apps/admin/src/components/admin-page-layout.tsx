import { memo, type ReactNode } from "react";

import { AdminPageIntro, type AdminPageIntroProps } from "@/components/admin-page-intro";
import { cn } from "@/lib/utils";

const maxWidthClass = {
  "3xl": "max-w-3xl",
  "6xl": "max-w-6xl",
} as const;

const gapClass = {
  6: "gap-6",
  8: "gap-8",
} as const;

export type AdminPageLayoutProps = {
  children: ReactNode;
  gap?: keyof typeof gapClass;
  intro?: AdminPageIntroProps;
  maxWidth?: keyof typeof maxWidthClass;
};

export const AdminPageLayout = memo(
  ({ children, gap = 8, intro, maxWidth = "6xl" }: AdminPageLayoutProps) => (
    <div
      className={cn(
        "mx-auto flex w-full flex-col animate-in fade-in slide-in-from-bottom-2 duration-500",
        maxWidthClass[maxWidth],
        gapClass[gap]
      )}
    >
      {intro ? <AdminPageIntro {...intro} /> : null}
      {children}
    </div>
  )
);
AdminPageLayout.displayName = "AdminPageLayout";
