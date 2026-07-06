import { memo } from "react";

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
  }: SupportChatSectionProps) => (
    <SupportChatPanel>
      <SupportChatThread
        isError={false}
        isPending={false}
        messages={messages}
        showAuthorEmail={isAdmin}
        ticketUserId={ticketUserId}
        viewer={viewer}
      />
      <SupportChatComposer
        idPrefix={idPrefix}
        isAdmin={isAdmin}
        onListsInvalidate={onListsInvalidate}
        placeholder={placeholder}
        status={status}
        supportRequestId={supportRequestId}
      />
    </SupportChatPanel>
  )
);
SupportChatSection.displayName = "SupportChatSection";
