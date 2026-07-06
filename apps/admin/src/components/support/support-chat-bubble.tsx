import { memo, type CSSProperties } from "react";

import { getAuthorInitials } from "@/lib/support-message-ownership";
import { cn } from "@/lib/utils";
import { type ISupportMessage } from "@/packages/shared";

export interface SupportChatBubbleProps {
  animationIndex?: number;
  isOwn: boolean;
  message: ISupportMessage;
  showAuthorEmail?: boolean;
}

export const SupportChatBubble = memo(
  ({ animationIndex = 0, isOwn, message, showAuthorEmail = false }: SupportChatBubbleProps) => {
    const timeLabel = new Date(message.createdAt).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    return (
      <div
        className={cn(
          "flex max-w-[85%] gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
          isOwn ? "ms-auto flex-row-reverse" : "me-auto"
        )}
        style={
          {
            animationDelay: `${animationIndex * 40}ms`,
          } satisfies CSSProperties
        }
      >
        <div
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
            isOwn
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border/80 bg-muted/50 text-muted-foreground"
          )}
        >
          {getAuthorInitials(message.authorName)}
        </div>

        <div className={cn("min-w-0 space-y-1", isOwn ? "items-end text-right" : "items-start")}>
          <div
            className={cn(
              "inline-block rounded-2xl px-3.5 py-2.5 text-left shadow-sm",
              isOwn
                ? "rounded-tr-md border border-primary/20 bg-primary/10 text-foreground"
                : "rounded-tl-md border border-border/80 bg-muted/40 text-foreground"
            )}
          >
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{message.authorName}</span>
              {showAuthorEmail && !isOwn ? <span>{message.authorEmail}</span> : null}
            </div>
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.body}
            </pre>
          </div>
          <time className="block px-1 text-[11px] text-muted-foreground" dateTime={message.createdAt}>
            {timeLabel}
          </time>
        </div>
      </div>
    );
  }
);
SupportChatBubble.displayName = "SupportChatBubble";
