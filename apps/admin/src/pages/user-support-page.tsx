import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { LifeBuoy, Plus } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supportApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  type ISupportMessage,
  type ISupportRequestListItem,
  type ISupportRequestsListResponse,
  type SupportCategory,
  type SupportRequestStatus,
} from "@/packages/shared";

const STATUS_OPTIONS: { label: string; value: "" | SupportRequestStatus }[] = [
  { label: "All statuses", value: "" },
  { label: "Pending", value: "pending" },
  { label: "In progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
];

const CATEGORY_OPTIONS: { label: string; value: "" | SupportCategory }[] = [
  { label: "All categories", value: "" },
  { label: "Bug", value: "bug" },
  { label: "Feature", value: "feature" },
  { label: "General", value: "general" },
];

const CREATE_CATEGORY_OPTIONS: { label: string; value: SupportCategory }[] = [
  { label: "Bug report", value: "bug" },
  { label: "Feature request", value: "feature" },
  { label: "General", value: "general" },
];

const STATUS_LABEL: Record<SupportRequestStatus, string> = {
  in_progress: "In progress",
  pending: "Pending",
  resolved: "Resolved",
};

type TAppliedSupportFilters = {
  category?: SupportCategory;
  status?: SupportRequestStatus;
};

const selectClass = cn(
  "h-8 w-full min-w-[160px] rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
);

const messageTextareaClass = cn(
  "min-h-[120px] w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
);

function supportStatusBadgeVariant(
  status: SupportRequestStatus
): "default" | "outline" | "secondary" {
  if (status === "pending") return "outline";
  if (status === "in_progress") return "secondary";
  return "default";
}

const SupportStatusBadge = memo(({ status }: Readonly<{ status: SupportRequestStatus }>) => (
  <Badge
    className={status === "resolved" ? "bg-muted text-muted-foreground" : undefined}
    variant={supportStatusBadgeVariant(status)}
  >
    {STATUS_LABEL[status]}
  </Badge>
));
SupportStatusBadge.displayName = "SupportStatusBadge";

const SupportMessageBubble = memo(({ message }: Readonly<{ message: ISupportMessage }>) => (
  <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{message.authorName}</span>
      <span>{new Date(message.createdAt).toLocaleString()}</span>
    </div>
    <pre className="text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">
      {message.body}
    </pre>
  </div>
));
SupportMessageBubble.displayName = "SupportMessageBubble";

const CreateSupportRequestDialog = memo(
  ({
    onOpenChange,
    open,
  }: Readonly<{
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }>) => {
    const queryClient = useQueryClient();
    const [category, setCategory] = useState<SupportCategory>("bug");
    const [message, setMessage] = useState("");

    const mutation = useMutation({
      mutationFn: () =>
        supportApi.create({
          category,
          message: message.trim(),
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Could not submit request");
      },
      onSuccess: () => {
        toast.success("Support request submitted");
        queryClient.invalidateQueries({ queryKey: ["support", "list"] });
        onOpenChange(false);
        setCategory("bug");
        setMessage("");
      },
    });

    const handleSubmit = (e: { preventDefault(): void }) => {
      e.preventDefault();
      if (message.trim().length === 0) {
        toast.error("Message is required");
        return;
      }
      mutation.mutate();
    };

    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New support request</DialogTitle>
            <DialogDescription>
              Report a bug, request a feature, or ask a general question. Our team will reply here.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4 px-6 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-support-category">Category</Label>
                <select
                  className={selectClass}
                  id="create-support-category"
                  onChange={(e) => setCategory(e.target.value as SupportCategory)}
                  value={category}
                >
                  {CREATE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-support-message">Message</Label>
                <textarea
                  className={messageTextareaClass}
                  id="create-support-message"
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the issue or request…"
                  required
                  value={message}
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={mutation.isPending} type="submit">
                {mutation.isPending ? "Submitting…" : "Submit request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateSupportRequestDialog.displayName = "CreateSupportRequestDialog";

const UserSupportDetailDialog = memo(
  ({ listRow, onClose }: Readonly<{ listRow: ISupportRequestListItem; onClose: () => void }>) => {
    const queryClient = useQueryClient();
    const [replyDraft, setReplyDraft] = useState("");

    const detailQuery = useQuery({
      queryFn: () => supportApi.get(listRow.id),
      queryKey: adminQueryKeys.supportRequest(listRow.id),
    });

    const replyMutation = useMutation({
      mutationFn: (body: string) => supportApi.postMessage(listRow.id, { message: body }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Could not send reply");
      },
      onSuccess: (detail) => {
        toast.success("Reply sent");
        setReplyDraft("");
        queryClient.setQueryData(adminQueryKeys.supportRequest(listRow.id), detail);
        queryClient.invalidateQueries({ queryKey: ["support", "list"] });
      },
    });

    const detail = detailQuery.data;
    const status = detail?.item.status ?? listRow.status;
    const busy = replyMutation.isPending;

    const handleSendReply = () => {
      const trimmed = replyDraft.trim();
      if (trimmed.length === 0) {
        toast.error("Reply cannot be empty");
        return;
      }
      replyMutation.mutate(trimmed);
    };

    return (
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Support request</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {listRow.id} · {new Date(listRow.createdAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,480px)] space-y-4 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">Status</span>
            <SupportStatusBadge status={status} />
            <span className="text-muted-foreground text-xs uppercase tracking-wide">Category</span>
            <Badge variant="outline">{listRow.category}</Badge>
          </div>
          <Separator />
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Conversation</p>
            {detailQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : null}
            {detailQuery.isError ? (
              <p className="text-destructive text-sm">
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : "Could not load conversation."}
              </p>
            ) : null}
            {detail?.messages.map((message) => (
              <SupportMessageBubble key={message.id} message={message} />
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`user-support-reply-${listRow.id}`}>Reply</Label>
            <textarea
              className={messageTextareaClass}
              disabled={busy}
              id={`user-support-reply-${listRow.id}`}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder="Add a follow-up message…"
              value={replyDraft}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || replyDraft.trim().length === 0}
                onClick={handleSendReply}
                type="button"
              >
                {replyMutation.isPending ? "Sending…" : "Send reply"}
              </Button>
              <Button onClick={onClose} type="button" variant="outline">
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    );
  }
);
UserSupportDetailDialog.displayName = "UserSupportDetailDialog";

const UserSupportTicketRow = memo(
  ({
    onOpenDetail,
    row,
  }: Readonly<{
    onOpenDetail: (row: ISupportRequestListItem) => void;
    row: ISupportRequestListItem;
  }>) => (
    <button
      className="flex w-full flex-col gap-2 rounded-lg border border-border/80 bg-card/80 p-4 text-left transition-colors hover:bg-muted/30"
      onClick={() => onOpenDetail(row)}
      type="button"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SupportStatusBadge status={row.status} />
        <Badge variant="outline">{row.category}</Badge>
        <span className="text-muted-foreground ml-auto text-xs">
          {new Date(row.updatedAt).toLocaleString()}
        </span>
      </div>
      <p className="text-muted-foreground line-clamp-2 whitespace-pre-wrap break-words text-sm">
        {row.lastMessagePreview}
      </p>
      {row.messageCount > 1 ? (
        <p className="text-muted-foreground text-xs">{row.messageCount} messages</p>
      ) : null}
    </button>
  )
);
UserSupportTicketRow.displayName = "UserSupportTicketRow";

const UserSupportPageInner = memo(() => {
  const [statusInput, setStatusInput] = useState<string>("");
  const [categoryInput, setCategoryInput] = useState<string>("");
  const [applied, setApplied] = useState<TAppliedSupportFilters>({});
  const [detailRow, setDetailRow] = useState<ISupportRequestListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const listQuery = useInfiniteQuery<
    ISupportRequestsListResponse,
    Error,
    InfiniteData<ISupportRequestsListResponse>,
    ReturnType<typeof adminQueryKeys.userSupportList>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      supportApi.list({
        category: applied.category,
        cursor: pageParam,
        limit: 20,
        status: applied.status,
      }),
    queryKey: adminQueryKeys.userSupportList({
      category: applied.category,
      status: applied.status,
    }),
  });

  const rows = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data?.pages]
  );

  const openDetail = useCallback((row: ISupportRequestListItem) => {
    setDetailRow(row);
  }, []);

  const applyFilters = () => {
    setApplied({
      category: categoryInput === "" ? undefined : (categoryInput as SupportCategory),
      status: statusInput === "" ? undefined : (statusInput as SupportRequestStatus),
    });
  };

  return (
    <AdminPageLayout
      intro={{
        description:
          "Submit bug reports and feature requests, then follow the conversation until your ticket is resolved.",
        eyebrow: "Support",
        title: "Your support requests",
      }}
      maxWidth="3xl"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Need help or want to suggest something? Start a new request anytime.
          </p>
          <Button className="gap-2" onClick={() => setCreateOpen(true)} type="button">
            <Plus className="size-4" />
            New request
          </Button>
        </div>

        <CreateSupportRequestDialog onOpenChange={setCreateOpen} open={createOpen} />

        <Dialog
          onOpenChange={(open) => {
            if (open) return;
            setDetailRow(null);
          }}
          open={detailRow !== null}
        >
          {detailRow === null ? null : (
            <UserSupportDetailDialog listRow={detailRow} onClose={() => setDetailRow(null)} />
          )}
        </Dialog>

        <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary">
              <LifeBuoy className="size-4" />
              <CardTitle className="text-base font-semibold">Filters</CardTitle>
            </div>
            <CardDescription>Optional. Filter your requests by status or category.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-[160px] flex-1 flex-col gap-2">
              <Label htmlFor="user-support-status">Status</Label>
              <select
                className={selectClass}
                id="user-support-status"
                onChange={(e) => setStatusInput(e.target.value)}
                value={statusInput}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[160px] flex-1 flex-col gap-2">
              <Label htmlFor="user-support-category">Category</Label>
              <select
                className={selectClass}
                id="user-support-category"
                onChange={(e) => setCategoryInput(e.target.value)}
                value={categoryInput}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={applyFilters} type="button" variant="secondary">
              Apply filters
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Your tickets</CardTitle>
            <CardDescription>Newest first. Open a ticket to read the full thread and reply.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {listQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : null}
            {listQuery.isError ? (
              <p className="text-destructive text-sm">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : "Could not load your support requests."}
              </p>
            ) : null}
            {rows.map((row) => (
              <UserSupportTicketRow key={row.id} onOpenDetail={openDetail} row={row} />
            ))}
            {listQuery.hasNextPage ? (
              <Button
                className="self-start"
                disabled={listQuery.isFetchingNextPage}
                onClick={() => {
                  listQuery.fetchNextPage().catch(() => {});
                }}
                type="button"
                variant="outline"
              >
                {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            ) : null}
            {!listQuery.isPending && rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No support requests yet. Create one to get started.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AdminPageLayout>
  );
});
UserSupportPageInner.displayName = "UserSupportPageInner";

export const UserSupportPage = UserSupportPageInner;
