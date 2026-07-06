import { memo } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { type ISupportMessage } from "@/packages/shared";

const SupportMessageBubble = memo(
  ({
    message,
    showAuthorEmail,
  }: Readonly<{ message: ISupportMessage; showAuthorEmail?: boolean }>) => (
    <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{message.authorName}</span>
        {showAuthorEmail ? <span>{message.authorEmail}</span> : null}
        <span>{new Date(message.createdAt).toLocaleString()}</span>
      </div>
      <pre className="text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">
        {message.body}
      </pre>
    </div>
  )
);
SupportMessageBubble.displayName = "SupportMessageBubble";

export const SupportMessageThread = memo(
  ({
    errorMessage,
    isError,
    isPending,
    messages,
    showAuthorEmail = false,
  }: Readonly<{
    errorMessage?: string;
    isError: boolean;
    isPending: boolean;
    messages: ISupportMessage[] | undefined;
    showAuthorEmail?: boolean;
  }>) => {
    if (isPending) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }

    if (isError) {
      return <p className="text-destructive text-sm">{errorMessage ?? "Could not load conversation."}</p>;
    }

    return (
      <div className="space-y-3">
        {messages?.map((message) => (
          <SupportMessageBubble
            key={message.id}
            message={message}
            showAuthorEmail={showAuthorEmail}
          />
        ))}
      </div>
    );
  }
);
SupportMessageThread.displayName = "SupportMessageThread";
