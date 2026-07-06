import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { SupportMessageThread } from "@/components/support/support-message-thread";
import { SupportReplyForm } from "@/components/support/support-reply-form";
import { SupportStatusBadge } from "@/components/support/support-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  type ISupportRequestDetail,
  type TAdminSupportRequestSettableStatus,
  UserType,
} from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const detailTriageButtonClass = "cursor-pointer disabled:cursor-not-allowed";

const SupportRequestDetailPageInner = memo(() => {
  const { supportRequestId } = useParams<{ supportRequestId: string }>();
  const queryClient = useQueryClient();
  const userType = useAuthStore((s) => s.user?.userType);
  const isAdmin = userType === UserType.ADMIN;

  const detailQuery = useQuery({
    enabled: Boolean(supportRequestId),
    queryFn: () => supportApi.get(supportRequestId!),
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
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || detailQuery.data == null) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-3">
        <Link className="text-muted-foreground text-sm hover:underline" to="/support-requests">
          ← Support requests
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <SupportStatusBadge status={detail.item.status} />
          <Badge variant="outline">{detail.item.category}</Badge>
          <span className="text-muted-foreground text-xs">
            {new Date(detail.item.createdAt).toLocaleString()}
          </span>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{detail.item.id}</p>
      </div>

      {isAdmin ? (
        <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Submitter</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{submitterMessage?.authorName ?? "—"}</p>
            <Link
              className="text-primary underline-offset-2 hover:underline"
              to={`/users/${encodeURIComponent(detail.item.userId)}`}
            >
              {submitterMessage?.authorEmail ?? detail.item.userId}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SupportMessageThread
            isError={false}
            isPending={false}
            messages={detail.messages}
            showAuthorEmail={isAdmin}
          />
          <Separator />
          <SupportReplyForm
            idPrefix={`support-detail-${supportRequestId}`}
            onSuccess={invalidateLists}
            placeholder={isAdmin ? "Write a reply to the user…" : "Add a follow-up message…"}
            supportRequestId={supportRequestId}
          />
        </CardContent>
      </Card>

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          {detail.item.status === "resolved" ? (
            <p className="text-muted-foreground text-sm">This request is resolved.</p>
          ) : null}
          {detail.item.status === "pending" ? (
            <>
              <Button
                className={detailTriageButtonClass}
                disabled={busy}
                onClick={() => handlePatchStatus("in_progress")}
                type="button"
                variant="secondary"
              >
                {busy ? "Saving…" : "Mark in progress"}
              </Button>
              <Button
                className={detailTriageButtonClass}
                disabled={busy}
                onClick={() => handlePatchStatus("resolved")}
                type="button"
              >
                {busy ? "Saving…" : "Mark resolved"}
              </Button>
            </>
          ) : null}
          {detail.item.status === "in_progress" ? (
            <Button
              className={detailTriageButtonClass}
              disabled={busy}
              onClick={() => handlePatchStatus("resolved")}
              type="button"
            >
              {busy ? "Saving…" : "Mark resolved"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
SupportRequestDetailPageInner.displayName = "SupportRequestDetailPageInner";

export const SupportRequestDetailPage = SupportRequestDetailPageInner;
