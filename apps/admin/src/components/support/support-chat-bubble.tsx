import { memo } from "react";

import { getAuthorInitials } from "@/lib/support-message-ownership";
import { cn } from "@/lib/utils";
import { type ISupportMessage } from "@/packages/shared";

export interface SupportChatBubbleProps {
  isOwn: boolean;
  message: ISupportMessage;
  shouldAnimate?: boolean;
  showAuthorEmail?: boolean;
}

function areBubblePropsEqual(
  prev: SupportChatBubbleProps,
  next: SupportChatBubbleProps
): boolean {
  return (
    prev.isOwn === next.isOwn &&
    prev.shouldAnimate === next.shouldAnimate &&
    prev.showAuthorEmail === next.showAuthorEmail &&
    prev.message.id === next.message.id &&
    prev.message.body === next.message.body &&
    prev.message.createdAt === next.message.createdAt &&
    prev.message.authorName === next.message.authorName &&
    prev.message.authorEmail === next.message.authorEmail
  );
}

const SupportChatBubbleInner = ({
  isOwn,
  message,
  shouldAnimate = false,
  showAuthorEmail = false,
}: SupportChatBubbleProps) => {
  const timeLabel = new Date(message.createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex w-fit max-w-[min(85vw,20rem)] gap-2 sm:max-w-[min(85%,24rem)] lg:max-w-[28rem]",
        shouldAnimate
          ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
          : null,
        isOwn ? "flex-row-reverse" : null
      )}
    >
      <div
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isOwn ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {getAuthorInitials(message.authorName)}
      </div>

      <div className={cn("min-w-0 space-y-1", isOwn ? "items-end text-right" : "items-start")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-3.5 py-2.5 text-left",
            isOwn
              ? "rounded-tr-md bg-primary text-primary-foreground"
              : "rounded-tl-md bg-muted/60 text-foreground"
          )}
        >
          <div
            className={cn(
              "mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs",
              isOwn ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            <span className={cn("font-medium", isOwn ? "text-primary-foreground" : "text-foreground")}>
              {message.authorName}
            </span>
            {showAuthorEmail && !isOwn ? <span>{message.authorEmail}</span> : null}
          </div>
          <pre
            className={cn(
              "whitespace-pre-wrap break-words text-sm leading-relaxed",
              isOwn ? "text-primary-foreground" : null
            )}
          >
            {message.body}
          </pre>
        </div>
        <time className="block px-1 text-[11px] text-muted-foreground" dateTime={message.createdAt}>
          {timeLabel}
        </time>
      </div>
    </div>
  );
};

export const SupportChatBubble = memo(SupportChatBubbleInner, areBubblePropsEqual);
SupportChatBubble.displayName = "SupportChatBubble";
