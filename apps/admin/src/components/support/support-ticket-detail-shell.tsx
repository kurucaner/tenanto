import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SupportTicketDetailShellProps {
  children: ReactNode;
}

export const SupportTicketDetailShell = memo(({ children }: SupportTicketDetailShellProps) => (
  <div
    className={cn(
      "mx-auto flex w-full max-w-5xl flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500",
      "min-h-[calc(100dvh-3.5rem-5.5rem-env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-3.5rem)]"
    )}
  >
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
      {children}
    </div>
  </div>
));
SupportTicketDetailShell.displayName = "SupportTicketDetailShell";

export const SupportChatPanel = memo(({ children }: Readonly<{ children: ReactNode }>) => (
  <section className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-[calc(100dvh-8rem)]">
    {children}
  </section>
));
SupportChatPanel.displayName = "SupportChatPanel";
