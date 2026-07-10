import type { PostType, PostTypeFilter } from "./types";

export const POST_TYPE_OPTIONS: Array<{ value: PostType; label: string }> = [
  { value: "daily", label: "日常动态" },
  { value: "travel_share", label: "旅游分享" },
];

export const POST_TYPE_FILTER_OPTIONS: Array<{
  value: PostTypeFilter;
  label: string;
}> = [
  { value: "all", label: "全部动态" },
  ...POST_TYPE_OPTIONS,
];

export function normalizePostType(value: string | null | undefined): PostType {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "travel_share" ? "travel_share" : "daily";
}

export function postTypeLabel(value: string | null | undefined) {
  const normalized = normalizePostType(value);
  return (
    POST_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ??
    "日常动态"
  );
}
