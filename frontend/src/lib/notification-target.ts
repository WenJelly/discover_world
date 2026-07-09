import type { NotificationResponse } from "./types";

export function getNotificationTargetHref(notification: NotificationResponse) {
  const targetId = notification.targetId?.trim();
  if (!targetId) {
    return "/notifications";
  }

  switch (notification.targetType) {
    case "post":
      return `/community?postId=${encodeURIComponent(targetId)}`;
    case "media_asset":
      return `/discover?mediaId=${encodeURIComponent(targetId)}`;
    case "user_account":
      return `/account?userId=${encodeURIComponent(targetId)}`;
    default:
      return "/notifications";
  }
}

export function navigateNotificationTarget(notification: NotificationResponse) {
  const href = getNotificationTargetHref(notification);
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
