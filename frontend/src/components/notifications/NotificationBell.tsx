import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchNotificationCursorList,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { interactiveSurfaceClassName } from "@/lib/interactive-surface";
import {
  getNotificationTargetHref,
  navigateNotificationTarget,
} from "@/lib/notification-target";
import type { NotificationResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function getActorName(notification: NotificationResponse) {
  return (
    notification.actor?.nickname ||
    notification.actor?.username ||
    notification.actorUserId ||
    "系统"
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadUnread = async () => {
    try {
      const resp = await fetchUnreadNotificationCount();
      setUnreadCount(resp.unreadCount ?? 0);
    } catch {
      setUnreadCount(0);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const resp = await fetchNotificationCursorList({ pageSize: 20 });
      setNotifications(resp.list ?? []);
      void loadUnread();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUnread();
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleNotificationClick = async (notification: NotificationResponse) => {
    if (!notification.isRead) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      try {
        await markNotificationRead({ id: notification.id });
      } catch {
        void loadUnread();
      }
    }
    setOpen(false);
    navigateNotificationTarget(notification);
  };

  const handleMarkAllRead = async () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true }))
    );
    setUnreadCount(0);
    try {
      await markAllNotificationsRead({});
    } catch {
      void loadUnread();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="通知"
        aria-expanded={open}
        className="relative"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="size-[18px]" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">通知</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {unreadCount > 0 ? `${unreadCount} 条未读` : "没有未读通知"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              全部已读
            </Button>
          </div>

          <div className="max-h-[26rem] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="size-5 animate-spin" aria-label="通知加载中" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-800">暂无通知</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  有新的关注、评论或审核结果时，会显示在这里。
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  data-slot="interactive-surface"
                  type="button"
                  title={getNotificationTargetHref(notification)}
                  className={cn(
                    interactiveSurfaceClassName,
                    "flex w-full gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"
                  )}
                  onClick={() => void handleNotificationClick(notification)}
                >
                  <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center">
                    {notification.isRead ? (
                      <Circle className="size-2.5 text-slate-300" aria-hidden />
                    ) : (
                      <span className="size-2 rounded-full bg-indigo-600" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-950">
                      {notification.title}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600">
                      {getActorName(notification)}
                      {notification.content ? `：${notification.content}` : ""}
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-slate-100 p-2">
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setOpen(false);
                window.history.pushState({}, "", "/notifications");
                window.dispatchEvent(new Event("popstate"));
              }}
            >
              查看全部通知
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
