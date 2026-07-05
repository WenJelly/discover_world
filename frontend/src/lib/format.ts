import type { MediaAssetResponse } from "./types";

export function formatCount(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  }
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function parseServerTime(value: string) {
  if (!value) return 0;
  const parsed = Date.parse(value.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(value: string) {
  if (!value) return "未知时间";
  const ms = parseServerTime(value);
  if (!ms) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(ms));
}

/** Relative time for recent posts ("刚刚" / "3 分钟前"), falls back to a date. */
export function formatRelativeTime(value: string, now: number = Date.now()) {
  const ms = parseServerTime(value);
  if (!ms) return value || "未知时间";
  const diff = now - ms;
  if (diff < 60_000) return "刚刚";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return formatDate(value);
}

export function getAvatarFallback(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "U";
}

export function getMediaUrl(media?: MediaAssetResponse | null) {
  if (!media) return "";
  return (
    media.thumbnailUrl ||
    media.urls?.thumbnail ||
    media.urls?.preview ||
    media.urls?.detail ||
    media.urls?.original ||
    media.url ||
    ""
  );
}
