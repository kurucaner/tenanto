import { memo, type ReactNode } from "react";

export interface SupportTicketDetailShellProps {
  children: ReactNode;
}

export const SupportTicketDetailShell = memo(({ children }: SupportTicketDetailShellProps) => (
  <div className="flex min-h-0 flex-1 flex-col overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
    {children}
  </div>
));
SupportTicketDetailShell.displayName = "SupportTicketDetailShell";

export const SupportChatPanel = memo(({ children }: Readonly<{ children: ReactNode }>) => (
  <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    {children}
  </section>
));
SupportChatPanel.displayName = "SupportChatPanel";
