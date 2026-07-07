import { memo } from "react";

import { getAuthorInitials } from "@/lib/support-message-ownership";
import { cn } from "@/lib/utils";
import { type ISupportAttachment, type ISupportMessage } from "@/packages/shared";

export interface SupportChatBubbleProps {
  isOwn: boolean;
  message: ISupportMessage;
  shouldAnimate?: boolean;
  showAuthorEmail?: boolean;
}

function areAttachmentsEqual(prev: ISupportAttachment[], next: ISupportAttachment[]): boolean {
  if (prev.length !== next.length) return false;
  return prev.every((attachment, index) => attachment.id === next[index]?.id);
}

function areBubblePropsEqual(prev: SupportChatBubbleProps, next: SupportChatBubbleProps): boolean {
  return (
    prev.isOwn === next.isOwn &&
    prev.shouldAnimate === next.shouldAnimate &&
    prev.showAuthorEmail === next.showAuthorEmail &&
    prev.message.id === next.message.id &&
    prev.message.body === next.message.body &&
    prev.message.createdAt === next.message.createdAt &&
    prev.message.authorName === next.message.authorName &&
    prev.message.authorEmail === next.message.authorEmail &&
    areAttachmentsEqual(prev.message.attachments, next.message.attachments)
  );
}

const SupportAttachmentThumbnail = memo(({ attachment }: { attachment: ISupportAttachment }) => {
  return (
    <a
      className="block overflow-hidden rounded-lg ring-1 ring-border/20"
      href={attachment.downloadUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      <img
        alt={attachment.filename}
        className="max-h-40 w-full object-cover"
        loading="lazy"
        src={attachment.downloadUrl}
      />
    </a>
  );
});
SupportAttachmentThumbnail.displayName = "SupportAttachmentThumbnail";

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
            <span
              className={cn("font-medium", isOwn ? "text-primary-foreground" : "text-foreground")}
            >
              {message.authorName}
            </span>
            {showAuthorEmail && !isOwn ? <span>{message.authorEmail}</span> : null}
          </div>
          {message.body.length > 0 ? (
            <pre
              className={cn(
                "whitespace-pre-wrap break-words text-sm leading-relaxed",
                isOwn ? "text-primary-foreground" : null
              )}
            >
              {message.body}
            </pre>
          ) : null}
          {message.attachments.length > 0 ? (
            <div className={cn("grid grid-cols-2 gap-2", message.body.length > 0 && "mt-3")}>
              {message.attachments.map((attachment) => (
                <SupportAttachmentThumbnail attachment={attachment} key={attachment.id} />
              ))}
            </div>
          ) : null}
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
