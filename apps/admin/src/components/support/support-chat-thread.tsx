import { ArrowDown } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { SupportChatBubble } from "@/components/support/support-chat-bubble";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatStickToBottom } from "@/hooks/use-chat-stick-to-bottom";
import { groupSupportMessagesByDay } from "@/lib/group-support-messages";
import {
  isOwnSupportMessage,
  type ISupportMessageViewer,
} from "@/lib/support-message-ownership";
import { cn } from "@/lib/utils";
import { type ISupportMessage } from "@/packages/shared";

export interface SupportChatThreadProps {
  forceScrollMessageId?: string | null;
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

interface JumpToLatestButtonProps {
  count: number;
  onClick: () => void;
}

const JumpToLatestButton = memo(({ count, onClick }: JumpToLatestButtonProps) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
    <Button
      className="pointer-events-auto h-8 gap-1.5 rounded-full border border-border/80 bg-card/95 px-3 text-xs shadow-md backdrop-blur-sm"
      onClick={onClick}
      size="sm"
      type="button"
      variant="secondary"
    >
      <ArrowDown className="size-3.5" />
      {count === 1 ? "New message" : `${count} new messages`}
    </Button>
  </div>
));
JumpToLatestButton.displayName = "SupportChatJumpToLatestButton";

function getMessageIdsKey(messages: ISupportMessage[] | undefined): string {
  if (messages == null || messages.length === 0) return "";
  return messages.map((message) => message.id).join(",");
}

export const SupportChatThread = memo(
  ({
    forceScrollMessageId,
    isError,
    isPending,
    messages,
    onRetry,
    showAuthorEmail = false,
    ticketUserId,
    viewer,
  }: SupportChatThreadProps) => {
    const [baselineMessageIdsKey, setBaselineMessageIdsKey] = useState("");

    const messageIdsKey = getMessageIdsKey(messages);
    const lastMessageId = messages?.at(-1)?.id ?? null;
    const scrollEnabled = !isPending && !isError && messages != null;

    const { handleScroll, pendingBelowCount, scrollRef, scrollToBottom } = useChatStickToBottom({
      enabled: scrollEnabled,
      forceScrollMessageId,
      lastMessageId,
    });

    const animateMessageIds = useMemo(() => {
      if (messages == null || baselineMessageIdsKey === "") return new Set<string>();
      if (messageIdsKey === baselineMessageIdsKey) return new Set<string>();

      const baselineIds = new Set(baselineMessageIdsKey.split(",").filter(Boolean));
      return new Set(
        messages.filter((message) => !baselineIds.has(message.id)).map((message) => message.id)
      );
    }, [baselineMessageIdsKey, messageIdsKey, messages]);

    if (messages != null && messageIdsKey !== baselineMessageIdsKey) {
      setBaselineMessageIdsKey(messageIdsKey);
    }

    const groups = useMemo(() => groupSupportMessagesByDay(messages ?? []), [messages]);

    const handleJumpToLatest = () => {
      scrollToBottom("smooth");
    };

    if (isPending) {
      return (
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-6 lg:px-8")}>
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
      <div className="relative min-h-0 flex-1">
        <div
          className={cn(
            "h-full min-h-0 overflow-y-auto overscroll-y-contain px-3 py-3 md:px-6 lg:px-8"
          )}
          onScroll={handleScroll}
          ref={scrollRef}
        >
          <div className="flex flex-col gap-3 pb-1">
            {groups.map((group) => (
              <div className="space-y-3" key={group.dateKey}>
                <DateDivider label={group.label} />
                {group.messages.map((message) => {
                  const isOwn = isOwnSupportMessage(message, viewer, ticketUserId);

                  return (
                    <div
                      className={cn("flex w-full", isOwn ? "justify-end" : "justify-start")}
                      key={message.id}
                    >
                      <SupportChatBubble
                        isOwn={isOwn}
                        message={message}
                        shouldAnimate={animateMessageIds.has(message.id)}
                        showAuthorEmail={showAuthorEmail}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {pendingBelowCount > 0 ? (
          <JumpToLatestButton count={pendingBelowCount} onClick={handleJumpToLatest} />
        ) : null}
      </div>
    );
  }
);
SupportChatThread.displayName = "SupportChatThread";
