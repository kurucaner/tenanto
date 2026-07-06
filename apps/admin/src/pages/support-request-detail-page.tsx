import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { SupportChatComposer } from "@/components/support/support-chat-composer";
import { SupportChatThread } from "@/components/support/support-chat-thread";
import {
  SupportChatPanel,
  SupportTicketDetailShell,
} from "@/components/support/support-ticket-detail-shell";
import { SupportTicketHeader } from "@/components/support/support-ticket-header";
import { SupportTicketSidebar } from "@/components/support/support-ticket-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationStreamContext } from "@/contexts/notification-stream-context";
import { adminApi, supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  type ISupportRequestDetail,
  type TAdminSupportRequestSettableStatus,
  UserType,
} from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const DetailLoadingShell = memo(() => (
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <Skeleton className="h-24 w-full rounded-xl" />
    <Skeleton className="min-h-[calc(100dvh-12rem)] w-full rounded-xl" />
  </div>
));
DetailLoadingShell.displayName = "SupportDetailLoadingShell";

const SupportRequestDetailPageInner = memo(() => {
  const { supportRequestId } = useParams<{ supportRequestId: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userType = user?.userType;
  const isAdmin = userType === UserType.ADMIN;
  const { setSuppressToasts } = useNotificationStreamContext();

  useEffect(() => {
    setSuppressToasts(true);
    return () => {
      setSuppressToasts(false);
    };
  }, [setSuppressToasts]);

  const detailQuery = useQuery({
    enabled: Boolean(supportRequestId),
    queryFn: () => {
      if (!supportRequestId) throw new Error("Missing support request id");
      return supportApi.get(supportRequestId);
    },
    queryKey: adminQueryKeys.supportRequest(supportRequestId ?? ""),
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
      queryClient.invalidateQueries({ queryKey: ["admin", "support-requests"] });
      queryClient.invalidateQueries({ queryKey: ["support", "list"] });
    },
  });

  if (!supportRequestId) {
    return <p className="text-destructive text-sm">Invalid support request.</p>;
  }

  if (detailQuery.isPending) {
    return <DetailLoadingShell />;
  }

  if (detailQuery.isError || detailQuery.data == null) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
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

  const detail = detailQuery.data;
  const busy = patchMutation.isPending;
  const viewerUserId = user?.id ?? "";
  const submitterMessage =
    detail.messages.find((message) => message.authorUserId === detail.item.userId) ??
    detail.messages[0];

  const handlePatchStatus = (status: TAdminSupportRequestSettableStatus) => {
    patchMutation.mutate({ id: supportRequestId, status });
  };

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "support-requests"] });
    queryClient.invalidateQueries({ queryKey: ["support", "list"] });
  };

  return (
    <SupportTicketDetailShell>
      <SupportTicketHeader
        category={detail.item.category}
        createdAt={detail.item.createdAt}
        id={detail.item.id}
        isAdmin={isAdmin}
        onPatchStatus={handlePatchStatus}
        patchBusy={busy}
        status={detail.item.status}
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-0">
        {isAdmin ? (
          <div className="hidden border-r border-border/60 p-4 lg:block">
            <SupportTicketSidebar
              onPatchStatus={handlePatchStatus}
              patchBusy={busy}
              status={detail.item.status}
              submitterEmail={submitterMessage?.authorEmail ?? detail.item.userId}
              submitterName={submitterMessage?.authorName ?? "—"}
              ticketUserId={detail.item.userId}
            />
          </div>
        ) : null}

        <SupportChatPanel>
          <SupportChatThread
            isError={false}
            isPending={false}
            messages={detail.messages}
            showAuthorEmail={isAdmin}
            ticketUserId={detail.item.userId}
            viewer={{ isAdmin, userId: viewerUserId }}
          />
          <SupportChatComposer
            idPrefix={`support-detail-${supportRequestId}`}
            isAdmin={isAdmin}
            onSuccess={invalidateLists}
            placeholder={isAdmin ? "Write a reply to the user…" : "Add a follow-up message…"}
            status={detail.item.status}
            supportRequestId={supportRequestId}
          />
        </SupportChatPanel>
      </div>
    </SupportTicketDetailShell>
  );
});
SupportRequestDetailPageInner.displayName = "SupportRequestDetailPageInner";

export const SupportRequestDetailPage = SupportRequestDetailPageInner;
