import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Circle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  fetchNotificationCursorList,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import {
  getNotificationTargetHref,
  navigateNotificationTarget,
} from "@/lib/notification-target";
import type { NotificationResponse } from "@/lib/types";

const PAGE_SIZE = 30;

function actorName(notification: NotificationResponse) {
  return (
    notification.actor?.nickname ||
    notification.actor?.username ||
    notification.actorUserId ||
    "系统"
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [cursor, setCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(
    async (mode: "reset" | "append" = "reset") => {
      setLoading(true);
      try {
        const page = await fetchNotificationCursorList({
          cursor: mode === "append" ? cursor : "",
          pageSize: PAGE_SIZE,
        });
        setNotifications((current) =>
          mode === "append" ? [...current, ...page.list] : page.list
        );
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } finally {
        setLoading(false);
      }
    },
    [cursor]
  );

  useEffect(() => {
    void loadNotifications("reset");
    // Initial notification center load is one-shot; load-more uses cursor.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = async (notification: NotificationResponse) => {
    if (!notification.isRead) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item
        )
      );
      await markNotificationRead({ id: notification.id });
    }
    navigateNotificationTarget(notification);
  };

  const handleMarkAllRead = async () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true }))
    );
    await markAllNotificationsRead({});
  };

  return (
    <section className="min-h-screen bg-background pt-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-16 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Bell className="size-4" aria-hidden />
              通知中心
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">
              通知
            </h1>
          </div>
          <Button type="button" variant="outline" onClick={() => void handleMarkAllRead()}>
            <CheckCheck className="size-4" aria-hidden />
            全部已读
          </Button>
        </header>

        {loading && notifications.length === 0 ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" aria-label="通知加载中" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium text-foreground">暂无通知</p>
            <p className="mt-1 text-sm text-muted-foreground">
              新的关注、评论、点赞和审核结果会显示在这里。
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                title={getNotificationTargetHref(notification)}
                className="flex w-full gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20"
                onClick={() => void handleClick(notification)}
              >
                <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center">
                  {notification.isRead ? (
                    <Circle className="size-2.5 text-muted-foreground/45" aria-hidden />
                  ) : (
                    <span className="size-2 rounded-full bg-primary" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {notification.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {actorName(notification)}
                    {notification.content ? `：${notification.content}` : ""}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatRelativeTime(notification.createdAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {hasMore ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void loadNotifications("append")}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              加载更多
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
