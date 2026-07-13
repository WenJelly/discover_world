export const ADMIN_TABS = [
  "dashboard",
  "homepage",
  "media-review",
  "reports",
  "moderation",
  "tags",
  "audit",
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

export function parseAdminTab(value: string | null | undefined): AdminTab {
  return ADMIN_TABS.includes(value as AdminTab)
    ? (value as AdminTab)
    : "dashboard";
}

export function parseAdminLogId(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function buildAdminTabHref(
  tab: AdminTab,
  options: { logId?: string } = {}
) {
  const params = new URLSearchParams({ tab });
  const logId = options.logId?.trim();
  if (tab === "audit" && logId) params.set("logId", logId);
  return `/admin?${params.toString()}`;
}
