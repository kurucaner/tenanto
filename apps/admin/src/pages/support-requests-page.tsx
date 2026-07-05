import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { LifeBuoy, PanelRightOpen } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AdminPageIntro } from "@/components/admin-page-intro";
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
import { adminApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  type IAdminSupportRequestListItem,
  type IAdminSupportRequestsListResponse,
  type SupportCategory,
  type SupportRequestStatus,
  type TAdminSupportRequestSettableStatus,
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

const detailTriageButtonClass = "cursor-pointer disabled:cursor-not-allowed";

function mergePatchedSupportItemIntoInfiniteCache(
  old: InfiniteData<IAdminSupportRequestsListResponse> | undefined,
  item: IAdminSupportRequestListItem
): InfiniteData<IAdminSupportRequestsListResponse> | undefined {
  if (old == null) return old;
  let touched = false;
  const pages = old.pages.map((page) => ({
    ...page,
    items: page.items.map((row) => {
      if (row.id === item.id) {
        touched = true;
        return item;
      }
      return row;
    }),
  }));
  return touched ? { ...old, pages } : old;
}

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

const SupportRequestDetailDialogContent = memo(
  ({
    onPatchStatus,
    patchingId,
    row,
  }: Readonly<{
    onPatchStatus: (id: string, status: TAdminSupportRequestSettableStatus) => void;
    patchingId: string | null;
    row: IAdminSupportRequestListItem;
  }>) => {
    const busy = patchingId === row.id;
    return (
      <DialogContent className="gap-0 p-0 sm:max-w-xl" key={row.id}>
        <DialogHeader>
          <DialogTitle>Support request</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {row.id} · {new Date(row.createdAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,480px)] space-y-4 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">Status</span>
            <SupportStatusBadge status={row.status} />
            <span className="text-muted-foreground text-xs uppercase tracking-wide">Category</span>
            <Badge variant="outline">{row.category}</Badge>
          </div>
          <Separator />
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Submitter</p>
            <p className="font-medium">{row.submitterName}</p>
            <Link
              className="text-sm text-primary underline-offset-2 hover:underline"
              to={`/users/${encodeURIComponent(row.userId)}`}
            >
              {row.submitterEmail}
            </Link>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">Message</p>
            <pre className="text-foreground max-h-[min(40vh,320px)] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border/80 bg-muted/30 p-3 text-sm leading-relaxed">
              {row.message}
            </pre>
          </div>
        </div>
        <DialogFooter>
          {row.status === "resolved" ? (
            <p className="text-muted-foreground text-sm sm:mr-auto">This request is resolved.</p>
          ) : null}
          {row.status === "pending" ? (
            <>
              <Button
                className={detailTriageButtonClass}
                disabled={busy}
                onClick={() => onPatchStatus(row.id, "in_progress")}
                type="button"
                variant="secondary"
              >
                {busy ? "Saving…" : "Mark in progress"}
              </Button>
              <Button
                className={detailTriageButtonClass}
                disabled={busy}
                onClick={() => onPatchStatus(row.id, "resolved")}
                type="button"
              >
                {busy ? "Saving…" : "Mark resolved"}
              </Button>
            </>
          ) : null}
          {row.status === "in_progress" ? (
            <Button
              className={detailTriageButtonClass}
              disabled={busy}
              onClick={() => onPatchStatus(row.id, "resolved")}
              type="button"
            >
              {busy ? "Saving…" : "Mark resolved"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    );
  }
);
SupportRequestDetailDialogContent.displayName = "SupportRequestDetailDialogContent";

const SupportRequestTableRow = memo(
  ({
    onOpenDetail,
    row,
  }: Readonly<{
    onOpenDetail: (row: IAdminSupportRequestListItem) => void;
    row: IAdminSupportRequestListItem;
  }>) => (
    <tr className="border-b border-border/60 align-top text-sm last:border-0">
      <td className="max-w-[120px] py-2 pr-2 font-mono text-xs text-muted-foreground">
        {new Date(row.createdAt).toLocaleString()}
      </td>
      <td className="py-2 pr-2">
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.category}</span>
      </td>
      <td className="py-2 pr-2">
        <SupportStatusBadge status={row.status} />
      </td>
      <td className="max-w-[200px] py-2 pr-2">
        <div className="font-medium leading-tight">{row.submitterName}</div>
        <Link
          className="text-xs text-primary underline-offset-2 hover:underline"
          to={`/users/${encodeURIComponent(row.userId)}`}
        >
          {row.submitterEmail}
        </Link>
      </td>
      <td className="max-w-[min(20rem,36vw)] py-2 pr-2">
        <p className="text-muted-foreground line-clamp-2 whitespace-pre-wrap break-words">
          {row.message}
        </p>
      </td>
      <td className="max-w-[120px] py-2 pr-2 text-xs text-muted-foreground">
        {new Date(row.updatedAt).toLocaleString()}
      </td>
      <td className="w-12 py-2 text-right align-middle">
        <Button
          aria-label="View details"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onOpenDetail(row)}
          size="icon-sm"
          title="View details"
          type="button"
          variant="ghost"
        >
          <PanelRightOpen className="size-4" />
        </Button>
      </td>
    </tr>
  )
);
SupportRequestTableRow.displayName = "SupportRequestTableRow";

const SupportRequestsPageInner = memo(() => {
  const queryClient = useQueryClient();
  const [statusInput, setStatusInput] = useState<string>("");
  const [categoryInput, setCategoryInput] = useState<string>("");
  const [applied, setApplied] = useState<TAppliedSupportFilters>({});
  const [detailRow, setDetailRow] = useState<IAdminSupportRequestListItem | null>(null);

  const listQuery = useInfiniteQuery<
    IAdminSupportRequestsListResponse,
    Error,
    InfiniteData<IAdminSupportRequestsListResponse>,
    ReturnType<typeof adminQueryKeys.supportRequestsList>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      adminApi.listSupportRequests({
        category: applied.category,
        cursor: pageParam,
        limit: 20,
        status: applied.status,
      }),
    queryKey: adminQueryKeys.supportRequestsList({
      category: applied.category,
      status: applied.status,
    }),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TAdminSupportRequestSettableStatus }) =>
      adminApi.patchSupportRequest(id, { status }),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    },
    onSuccess: (data) => {
      toast.success("Status updated");
      queryClient.setQueriesData<InfiniteData<IAdminSupportRequestsListResponse>>(
        { queryKey: ["admin", "support-requests"] },
        (old) => mergePatchedSupportItemIntoInfiniteCache(old, data.item)
      );
      setDetailRow((prev) => (prev?.id === data.item.id ? data.item : prev));
    },
  });

  const patchingId =
    patchMutation.isPending && patchMutation.variables != null ? patchMutation.variables.id : null;

  const handlePatchStatus = useCallback(
    (id: string, status: TAdminSupportRequestSettableStatus) => {
      patchMutation.mutate({ id, status });
    },
    [patchMutation]
  );

  const rows = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data?.pages]
  );

  const liveDetailRow = useMemo(() => {
    if (detailRow == null) return null;
    return rows.find((r) => r.id === detailRow.id) ?? detailRow;
  }, [detailRow, rows]);

  const openDetail = useCallback((row: IAdminSupportRequestListItem) => {
    setDetailRow(row);
  }, []);

  const applyFilters = () => {
    setApplied({
      category: categoryInput === "" ? undefined : (categoryInput as SupportCategory),
      status: statusInput === "" ? undefined : (statusInput as SupportRequestStatus),
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <AdminPageIntro
        description="Feedback submitted from the mobile app: category, message, triage status, and who filed it."
        eyebrow="Support"
        title="Support requests"
      />

      <Dialog
        onOpenChange={(open) => {
          if (open) return;
          setDetailRow(null);
        }}
        open={liveDetailRow !== null}
      >
        {liveDetailRow === null ? null : (
          <SupportRequestDetailDialogContent
            onPatchStatus={handlePatchStatus}
            patchingId={patchingId}
            row={liveDetailRow}
          />
        )}
      </Dialog>

      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-primary">
            <LifeBuoy className="size-4" />
            <CardTitle className="text-base font-semibold">Filters</CardTitle>
          </div>
          <CardDescription>Optional. Choose status and/or category, then apply.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-[160px] flex-1 flex-col gap-2">
            <Label htmlFor="support-status">Status</Label>
            <select
              className={selectClass}
              id="support-status"
              onChange={(e) => setStatusInput(e.target.value)}
              value={statusInput}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col gap-2">
            <Label htmlFor="support-category">Category</Label>
            <select
              className={selectClass}
              id="support-category"
              onChange={(e) => setCategoryInput(e.target.value)}
              value={categoryInput}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
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
          <CardTitle className="text-base">Requests</CardTitle>
          <CardDescription>
            Newest first. Open a row to read the full message and update status.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          {listQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}
          {listQuery.isError ? (
            <p className="text-destructive text-sm">
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : "Could not load requests."}
            </p>
          ) : null}
          {rows.length > 0 ? (
            <>
              <Separator className="mb-2" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Created</th>
                      <th className="py-2 pr-2 font-medium">Category</th>
                      <th className="py-2 pr-2 font-medium">Status</th>
                      <th className="py-2 pr-2 font-medium">Submitter</th>
                      <th className="py-2 pr-2 font-medium">Message</th>
                      <th className="py-2 pr-2 font-medium">Updated</th>
                      <th className="w-12 py-2 text-right font-medium">
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <SupportRequestTableRow key={row.id} onOpenDetail={openDetail} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
              {listQuery.hasNextPage ? (
                <Button
                  className="mt-4 self-start"
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
            </>
          ) : null}
          {!listQuery.isPending && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No support requests match these filters.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
});
SupportRequestsPageInner.displayName = "SupportRequestsPageInner";

export const SupportRequestsPage = SupportRequestsPageInner;
