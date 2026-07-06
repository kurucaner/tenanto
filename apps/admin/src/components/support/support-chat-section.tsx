import { memo, useCallback, useState } from "react";

import { SupportChatComposer } from "@/components/support/support-chat-composer";
import { SupportChatThread } from "@/components/support/support-chat-thread";
import { SupportChatPanel } from "@/components/support/support-ticket-detail-shell";
import { type ISupportMessageViewer } from "@/lib/support-message-ownership";
import { type ISupportMessage, type SupportRequestStatus } from "@/packages/shared";

export interface SupportChatSectionProps {
  idPrefix: string;
  isAdmin: boolean;
  messages: ISupportMessage[];
  onListsInvalidate: () => void;
  placeholder: string;
  status: SupportRequestStatus;
  supportRequestId: string;
  ticketUserId: string;
  viewer: ISupportMessageViewer;
}

export const SupportChatSection = memo(
  ({
    idPrefix,
    isAdmin,
    messages,
    onListsInvalidate,
    placeholder,
    status,
    supportRequestId,
    ticketUserId,
    viewer,
  }: SupportChatSectionProps) => {
    const [forceScrollMessageId, setForceScrollMessageId] = useState<string | null>(null);

    const handleMessageSent = useCallback((messageId: string) => {
      setForceScrollMessageId(messageId);
    }, []);

    return (
      <SupportChatPanel>
        <SupportChatThread
          forceScrollMessageId={forceScrollMessageId}
          isError={false}
          isPending={false}
          key={supportRequestId}
          messages={messages}
          showAuthorEmail={isAdmin}
          ticketUserId={ticketUserId}
          viewer={viewer}
        />
        <SupportChatComposer
          idPrefix={idPrefix}
          isAdmin={isAdmin}
          onListsInvalidate={onListsInvalidate}
          onMessageSent={handleMessageSent}
          placeholder={placeholder}
          status={status}
          supportRequestId={supportRequestId}
        />
      </SupportChatPanel>
    );
  }
);
SupportChatSection.displayName = "SupportChatSection";
