export const ADMIN_TABS = [
  "homepage",
  "media-review",
  "reports",
  "moderation",
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

export function parseAdminTab(value: string | null | undefined): AdminTab {
  return ADMIN_TABS.includes(value as AdminTab)
    ? (value as AdminTab)
    : "homepage";
}

export function buildAdminTabHref(tab: AdminTab) {
  return `/admin?tab=${tab}`;
}
