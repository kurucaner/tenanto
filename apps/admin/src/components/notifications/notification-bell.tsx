import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { memo, useState } from "react";

import { NotificationList } from "@/components/notifications/notification-list";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotificationStreamContext } from "@/contexts/notification-stream-context";
import { notificationsApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export const NotificationBell = memo(() => {
  const userType = useAuthStore((s) => s.user?.userType);
  const [open, setOpen] = useState(false);
  const { setSuppressToasts, status: streamStatus } = useNotificationStreamContext();

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);
    setSuppressToasts(nextOpen);
  };

  const unreadQuery = useQuery({
    enabled: userType === UserType.USER,
    queryFn: () => notificationsApi.getUnreadCount(),
    queryKey: adminQueryKeys.notificationsUnreadCount(),
    refetchInterval: streamStatus === "degraded" ? 30_000 : false,
    refetchOnWindowFocus: true,
  });

  if (userType !== UserType.USER) {
    return null;
  }

  const unreadCount = unreadQuery.data?.count ?? 0;

  return (
    <DropdownMenu onOpenChange={handleOpenChange} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          className="relative size-8 shrink-0"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-primary-foreground",
                unreadCount > 9 ? "px-1" : "size-4"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        {open ? <NotificationList onClose={() => setOpen(false)} /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
NotificationBell.displayName = "NotificationBell";
