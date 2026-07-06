import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationsApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { type IUserNotification } from "@/packages/shared";

function getNotificationHref(notification: IUserNotification): string {
  if (notification.resourceType === "property" && notification.resourceId != null) {
    return `/properties/${encodeURIComponent(notification.resourceId)}`;
  }
  if (notification.resourceType === "support_request" && notification.resourceId != null) {
    return `/support-requests/${encodeURIComponent(notification.resourceId)}`;
  }
  return "/support-requests";
}

const NotificationListItem = memo(
  ({
    notification,
    onNavigate,
  }: Readonly<{
    notification: IUserNotification;
    onNavigate: (notification: IUserNotification) => void;
  }>) => {
    const unread = notification.readAt == null;

    return (
      <button
        className={cn(
          "flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/60",
          unread ? "bg-muted/30" : undefined
        )}
        onClick={() => onNavigate(notification)}
        type="button"
      >
        <div className="flex items-start justify-between gap-2">
          <span className={cn("text-sm leading-tight", unread ? "font-semibold" : "font-medium")}>
            {notification.title}
          </span>
          {unread ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" /> : null}
        </div>
        <p className="text-muted-foreground line-clamp-2 text-xs">{notification.body}</p>
        <span className="text-muted-foreground text-[0.65rem]">
          {new Date(notification.createdAt).toLocaleString()}
        </span>
      </button>
    );
  }
);
NotificationListItem.displayName = "NotificationListItem";

export const NotificationList = memo(
  ({
    onClose,
  }: Readonly<{
    onClose: () => void;
  }>) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const listQuery = useQuery({
      queryFn: () => notificationsApi.list({ limit: 20 }),
      queryKey: adminQueryKeys.notificationsList(),
    });

    const markAllMutation = useMutation({
      mutationFn: () => notificationsApi.markAllRead(),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Could not mark all as read");
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.notificationsUnreadCount() });
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.notificationsList() });
      },
    });

    const handleNavigate = useCallback(
      async (notification: IUserNotification) => {
        if (notification.readAt == null) {
          try {
            await notificationsApi.markRead(notification.id);
            queryClient.invalidateQueries({ queryKey: adminQueryKeys.notificationsUnreadCount() });
            queryClient.invalidateQueries({ queryKey: adminQueryKeys.notificationsList() });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not update notification");
          }
        }
        onClose();
        navigate(getNotificationHref(notification));
      },
      [navigate, onClose, queryClient]
    );

    const items = listQuery.data?.items ?? [];
    const hasUnread = items.some((item) => item.readAt == null);

    return (
      <div className="flex max-h-[min(24rem,70vh)] flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {hasUnread ? (
            <Button
              aria-label="Mark all as read"
              className="size-7 shrink-0"
              disabled={markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <CheckCheck className="size-4" />
            </Button>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {listQuery.isPending ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : null}
          {listQuery.isError ? (
            <p className="text-destructive p-3 text-sm">Could not load notifications.</p>
          ) : null}
          {!listQuery.isPending && items.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">No notifications yet.</p>
          ) : null}
          {items.map((notification) => (
            <NotificationListItem
              key={notification.id}
              notification={notification}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      </div>
    );
  }
);
NotificationList.displayName = "NotificationList";
