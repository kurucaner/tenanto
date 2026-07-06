import { memo, useLayoutEffect, useMemo, useRef } from "react";

import { SupportChatBubble } from "@/components/support/support-chat-bubble";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { groupSupportMessagesByDay } from "@/lib/group-support-messages";
import {
  isOwnSupportMessage,
  type ISupportMessageViewer,
} from "@/lib/support-message-ownership";
import { cn } from "@/lib/utils";
import { type ISupportMessage } from "@/packages/shared";

export interface SupportChatThreadProps {
  isError: boolean;
  isPending: boolean;
  messages: ISupportMessage[] | undefined;
  onRetry?: () => void;
  showAuthorEmail?: boolean;
  ticketUserId: string;
  viewer: ISupportMessageViewer;
}

const ThreadSkeleton = memo(() => (
  <div className="space-y-4 px-1 py-2">
    <div className="flex gap-2">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <Skeleton className="h-20 w-[min(75%,18rem)] rounded-2xl" />
    </div>
    <div className="flex flex-row-reverse gap-2">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <Skeleton className="h-16 w-[min(70%,16rem)] rounded-2xl" />
    </div>
    <div className="flex gap-2">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <Skeleton className="h-14 w-[min(65%,14rem)] rounded-2xl" />
    </div>
  </div>
));
ThreadSkeleton.displayName = "SupportChatThreadSkeleton";

const DateDivider = memo(({ label }: Readonly<{ label: string }>) => (
  <div className="relative py-2" role="separator">
    <div className="absolute inset-x-0 top-1/2 border-t border-border/60" />
    <p className="relative mx-auto w-fit rounded-full border border-border/80 bg-card/90 px-3 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
      {label}
    </p>
  </div>
));
DateDivider.displayName = "SupportChatDateDivider";

function getMessageIdsKey(messages: ISupportMessage[] | undefined): string {
  if (messages == null || messages.length === 0) return "";
  return messages.map((message) => message.id).join(",");
}

export const SupportChatThread = memo(
  ({
    isError,
    isPending,
    messages,
    onRetry,
    showAuthorEmail = false,
    ticketUserId,
    viewer,
  }: SupportChatThreadProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const seenIdsRef = useRef<Set<string>>(new Set());
    const isInitialMountRef = useRef(true);
    const lastScrolledMessageIdRef = useRef<string | null>(null);

    const messageIdsKey = getMessageIdsKey(messages);
    const lastMessageId = messages?.at(-1)?.id ?? null;

    if (messages != null && isInitialMountRef.current) {
      for (const message of messages) {
        seenIdsRef.current.add(message.id);
      }
      isInitialMountRef.current = false;
    }

    const groups = useMemo(
      () => groupSupportMessagesByDay(messages ?? []),
      [messageIdsKey, messages]
    );

    useLayoutEffect(() => {
      if (messages == null) return;
      for (const message of messages) {
        seenIdsRef.current.add(message.id);
      }
    }, [messageIdsKey, messages]);

    useLayoutEffect(() => {
      if (lastMessageId == null || lastMessageId === lastScrolledMessageIdRef.current) return;
      lastScrolledMessageIdRef.current = lastMessageId;

      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
      });
    }, [lastMessageId]);

    if (isPending) {
      return (
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4")}>
          <ThreadSkeleton />
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <p className="text-destructive text-sm">Could not load conversation.</p>
          {onRetry ? (
            <Button onClick={onRetry} size="sm" type="button" variant="outline">
              Retry
            </Button>
          ) : null}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-3 py-3 [overflow-anchor:auto] md:px-4"
        )}
        ref={scrollRef}
      >
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div className="space-y-3" key={group.dateKey}>
              <DateDivider label={group.label} />
              {group.messages.map((message) => (
                <SupportChatBubble
                  isOwn={isOwnSupportMessage(message, viewer, ticketUserId)}
                  key={message.id}
                  message={message}
                  shouldAnimate={!seenIdsRef.current.has(message.id)}
                  showAuthorEmail={showAuthorEmail}
                />
              ))}
            </div>
          ))}
          <div aria-hidden ref={bottomRef} />
        </div>
      </div>
    );
  }
);
SupportChatThread.displayName = "SupportChatThread";
