import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { SupportChatSection } from "@/components/support/support-chat-section";
import {
  supportDetailFullBleedClass,
  supportDetailMetaClass,
  supportDetailRailClass,
} from "@/components/support/support-constants";
import { SupportTicketDetailShell } from "@/components/support/support-ticket-detail-shell";
import { SupportTicketHeader } from "@/components/support/support-ticket-header";
import { SupportTicketSidebar } from "@/components/support/support-ticket-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationStreamContext } from "@/contexts/notification-stream-context";
import { adminApi, supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  type ISupportRequest,
  type ISupportRequestDetail,
  type TAdminSupportRequestSettableStatus,
  UserType,
} from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const DetailLoadingShell = memo(() => (
  <div className={cn(supportDetailFullBleedClass, "gap-4")}>
    <div className={cn(supportDetailMetaClass, "space-y-3 py-3")}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-64" />
    </div>
    <Skeleton className="min-h-0 flex-1" />
  </div>
));
DetailLoadingShell.displayName = "SupportDetailLoadingShell";

interface SupportTicketHeaderSectionProps {
  isAdmin: boolean;
  onPatchStatus: (status: TAdminSupportRequestSettableStatus) => void;
  patchBusy: boolean;
  ticket: ISupportRequest;
}

const SupportTicketHeaderSection = memo(
  ({ isAdmin, onPatchStatus, patchBusy, ticket }: SupportTicketHeaderSectionProps) => (
    <SupportTicketHeader
      category={ticket.category}
      createdAt={ticket.createdAt}
      id={ticket.id}
      isAdmin={isAdmin}
      onPatchStatus={onPatchStatus}
      patchBusy={patchBusy}
      status={ticket.status}
    />
  )
);
SupportTicketHeaderSection.displayName = "SupportTicketHeaderSection";

interface SupportTicketSidebarSectionProps {
  submitterEmail: string;
  submitterName: string;
  ticketUserId: string;
}

const SupportTicketSidebarSection = memo(
  ({ submitterEmail, submitterName, ticketUserId }: SupportTicketSidebarSectionProps) => (
    <div className={cn("hidden lg:block", supportDetailRailClass)}>
      <SupportTicketSidebar
        submitterEmail={submitterEmail}
        submitterName={submitterName}
        ticketUserId={ticketUserId}
      />
    </div>
  )
);
SupportTicketSidebarSection.displayName = "SupportTicketSidebarSection";

const SupportRequestDetailPageInner = memo(() => {
  const { supportRequestId } = useParams<{ supportRequestId: string }>();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const userType = useAuthStore((s) => s.user?.userType);
  const isAdmin = userType === UserType.ADMIN;
  const { setSuppressToasts } = useNotificationStreamContext();

  useEffect(() => {
    setSuppressToasts(true);
    return () => {
      setSuppressToasts(false);
    };
  }, [setSuppressToasts]);

  const detailQueryKey = adminQueryKeys.supportRequest(supportRequestId ?? "");

  const detailQuery = useQuery({
    enabled: Boolean(supportRequestId),
    queryFn: () => {
      if (!supportRequestId) throw new Error("Missing support request id");
      return supportApi.get(supportRequestId);
    },
    queryKey: detailQueryKey,
  });

  const messagesQuery = useQuery({
    enabled: Boolean(supportRequestId),
    queryFn: () => {
      if (!supportRequestId) throw new Error("Missing support request id");
      return supportApi.get(supportRequestId);
    },
    queryKey: detailQueryKey,
    select: (detail: ISupportRequestDetail) => detail.messages,
  });

  const ticketQuery = useQuery({
    enabled: Boolean(supportRequestId),
    queryFn: () => {
      if (!supportRequestId) throw new Error("Missing support request id");
      return supportApi.get(supportRequestId);
    },
    queryKey: detailQueryKey,
    select: (detail: ISupportRequestDetail) => detail.item,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TAdminSupportRequestSettableStatus }) =>
      adminApi.patchSupportRequest(id, { status }),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    },
    onSuccess: (data) => {
      toast.success("Status updated");
      queryClient.setQueryData<ISupportRequestDetail | undefined>(
        adminQueryKeys.supportRequest(data.item.id),
        (old) => (old == null ? old : { ...old, item: { ...old.item, status: data.item.status } })
      );
      queryClient.invalidateQueries({ queryKey: ["support-requests"] });
      queryClient.invalidateQueries({ queryKey: ["support", "list"] });
    },
  });

  const handlePatchStatus = useCallback(
    (status: TAdminSupportRequestSettableStatus) => {
      if (!supportRequestId) return;
      patchMutation.mutate({ id: supportRequestId, status });
    },
    [patchMutation, supportRequestId]
  );

  const invalidateLists = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["support-requests"] });
    queryClient.invalidateQueries({ queryKey: ["support", "list"] });
  }, [queryClient]);

  const viewer = useMemo(() => ({ isAdmin, userId }), [isAdmin, userId]);

  const submitterInfo = useMemo(() => {
    const messages = messagesQuery.data ?? [];
    const ticket = ticketQuery.data;
    if (ticket == null) {
      return { email: "—", name: "—", userId: "" };
    }

    const submitterMessage =
      messages.find((message) => message.authorUserId === ticket.userId) ?? messages[0];

    return {
      email: submitterMessage?.authorEmail ?? ticket.userId,
      name: submitterMessage?.authorName ?? "—",
      userId: ticket.userId,
    };
  }, [messagesQuery.data, ticketQuery.data]);

  if (!supportRequestId) {
    return <p className="text-destructive text-sm">Invalid support request.</p>;
  }

  if (detailQuery.isPending) {
    return <DetailLoadingShell />;
  }

  if (detailQuery.isError || detailQuery.data == null) {
    return (
      <div className={cn(supportDetailFullBleedClass, supportDetailMetaClass, "gap-4 py-3")}>
        <Link className="text-muted-foreground text-sm hover:underline" to="/support-requests">
          ← Support requests
        </Link>
        <p className="text-destructive text-sm">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : "Support request not found."}
        </p>
      </div>
    );
  }

  const ticket = ticketQuery.data;
  const messages = messagesQuery.data ?? [];
  const busy = patchMutation.isPending;

  if (ticket == null) {
    return null;
  }

  return (
    <div className={supportDetailFullBleedClass}>
      <SupportTicketDetailShell>
        <SupportTicketHeaderSection
          isAdmin={isAdmin}
          onPatchStatus={handlePatchStatus}
          patchBusy={busy}
          ticket={ticket}
        />

        <div className="grid min-h-0 flex-1 overflow-hidden lg:gap-0">
          {isAdmin ? (
            <SupportTicketSidebarSection
              submitterEmail={submitterInfo.email}
              submitterName={submitterInfo.name}
              ticketUserId={submitterInfo.userId}
            />
          ) : null}

          <SupportChatSection
            idPrefix={`support-detail-${supportRequestId}`}
            isAdmin={isAdmin}
            messages={messages}
            onListsInvalidate={invalidateLists}
            placeholder={isAdmin ? "Write a reply to the user…" : "Add a follow-up message…"}
            status={ticket.status}
            supportRequestId={supportRequestId}
            ticketUserId={ticket.userId}
            viewer={viewer}
          />
        </div>
      </SupportTicketDetailShell>
    </div>
  );
});
SupportRequestDetailPageInner.displayName = "SupportRequestDetailPageInner";

export const SupportRequestDetailPage = SupportRequestDetailPageInner;
