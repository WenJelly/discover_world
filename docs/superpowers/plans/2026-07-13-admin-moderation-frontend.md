# Admin Moderation Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shadcn Sidebar-based `/admin` workspace with report queue processing and complete post/comment/forum moderation.

**Architecture:** Keep `/admin` as the only admin pathname and store the selected section in `?tab=`. Add small navigation utilities, typed API wrappers, and focused admin panel components; keep existing homepage and media-review behavior while replacing the old public-list moderation branch with admin APIs.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Base UI, Sonner, Node source-contract tests, Vitest.

---

## File Structure

- Create `frontend/src/lib/admin-navigation.ts`: canonical admin tab values, query parsing, and URL construction.
- Create `frontend/tests/admin-navigation.test.ts`: pure navigation behavior tests.
- Modify `frontend/src/lib/types.ts`: typed report and admin-content request/response contracts.
- Modify `frontend/src/lib/api.ts`: report list/detail/resolve, admin content list, comment hide/restore wrappers; extend moderation request payloads.
- Create `frontend/tests/admin-moderation-api.test.mjs`: source-level endpoint and payload contract checks.
- Generate `frontend/src/components/ui/sidebar.tsx`: official shadcn Sidebar primitives.
- Modify `frontend/src/index.css`: generated Sidebar theme variables if added by shadcn.
- Modify `frontend/package.json` and `frontend/package-lock.json`: dependencies required by generated Sidebar.
- Create `frontend/src/components/admin/AdminSidebar.tsx`: admin navigation, mobile trigger, and return-home action.
- Create `frontend/src/components/admin/AdminReportsPanel.tsx`: report filters, paginated list, detail pane, and resolution form.
- Create `frontend/src/components/admin/AdminContentModerationPanel.tsx`: post/comment filters, paginated list, selection detail, reason-gated actions, and internal forum view.
- Create `frontend/src/components/admin/AdminForumModerationPanel.tsx`: forum board filter and lock/pin actions.
- Modify `frontend/src/pages/AdminPage.tsx`: Sidebar shell, query-driven tabs, new panel integration, and removal of the legacy public-list moderation branch.
- Create `frontend/tests/admin-moderation-ui.test.mjs`: source contracts for Sidebar, report workflow, content workflow, and forum preservation.

## Task 1: Admin Tab Navigation

**Files:**
- Create: `frontend/src/lib/admin-navigation.ts`
- Test: `frontend/tests/admin-navigation.test.ts`

- [ ] **Step 1: Write the failing navigation test**

```ts
import { describe, expect, it } from "vitest";
import {
  buildAdminTabHref,
  parseAdminTab,
  type AdminTab,
} from "../src/lib/admin-navigation";

describe("admin navigation", () => {
  it.each<[string | null, AdminTab]>([
    [null, "homepage"],
    ["homepage", "homepage"],
    ["media-review", "media-review"],
    ["reports", "reports"],
    ["moderation", "moderation"],
    ["unknown", "homepage"],
  ])("maps %s to %s", (value, expected) => {
    expect(parseAdminTab(value)).toBe(expected);
  });

  it("builds canonical admin tab links", () => {
    expect(buildAdminTabHref("reports")).toBe("/admin?tab=reports");
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd frontend && npm test -- admin-navigation.test.ts`

Expected: FAIL because `src/lib/admin-navigation.ts` does not exist.

- [ ] **Step 3: Implement the navigation utility**

```ts
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
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `cd frontend && npm test -- admin-navigation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the navigation utility**

```bash
git add frontend/src/lib/admin-navigation.ts frontend/tests/admin-navigation.test.ts
git commit -m "feat: add admin tab navigation"
```

## Task 2: Moderation API And Type Contracts

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/tests/admin-moderation-api.test.mjs`

- [ ] **Step 1: Write the failing endpoint contract test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const types = await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8");

test("admin moderation API exposes report and content workflows", () => {
  for (const token of [
    '"/api/admin/moderation/report/list"',
    '"/api/admin/moderation/report/detail"',
    '"/api/admin/moderation/report/resolve"',
    '"/api/admin/moderation/content/list"',
    '"/api/admin/moderation/comment/hide"',
    '"/api/admin/moderation/comment/restore"',
    "fetchAdminModerationReportList",
    "fetchAdminModerationReportDetail",
    "resolveAdminModerationReport",
    "fetchAdminContentList",
    "adminHideComment",
    "adminRestoreComment",
  ]) {
    assert.match(api, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("admin moderation types preserve ids as strings", () => {
  for (const token of [
    "AdminModerationReportQueryRequest",
    "AdminModerationReportResolveRequest",
    "AdminModerationReportResponse",
    "AdminModerationReportPageResponse",
    "AdminContentQueryRequest",
    "AdminContentResponse",
    "AdminContentPageResponse",
    "reportId?: string",
    "reason?: string",
  ]) {
    assert.ok(types.includes(token), `missing ${token}`);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd frontend && node --test tests/admin-moderation-api.test.mjs`

Expected: FAIL because the admin report/content endpoints and types are absent.

- [ ] **Step 3: Add exact TypeScript contracts**

Add interfaces matching `api/discover_world.api`:

```ts
export interface AdminModerateContentRequest {
  id: string;
  reason?: string;
  reportId?: string;
}

export interface AdminModerationReportQueryRequest {
  status?: string;
  targetType?: string;
  targetId?: string;
  reporterUserId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface AdminModerationReportResolveRequest {
  id: string;
  resolution: "accepted" | "rejected" | "resolved";
  resolutionNote?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
}

export interface AdminModerationReportResponse {
  id: string;
  reporterUserId: string;
  reporter: AccountSummary;
  targetType: string;
  targetId: string;
  reason: string;
  description: string;
  status: string;
  handlerUserId: string;
  resolution: string;
  resolutionNote: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
}

export interface AdminModerationReportPageResponse {
  pageNum: number;
  pageSize: number;
  total: number;
  list: AdminModerationReportResponse[];
}

export interface AdminContentQueryRequest {
  targetType?: string;
  status?: string;
  userId?: string;
  searchText?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface AdminContentResponse {
  id: string;
  targetType: string;
  author: AccountSummary;
  title: string;
  content: string;
  status: string;
  createdAt: string;
}

export interface AdminContentPageResponse {
  pageNum: number;
  pageSize: number;
  total: number;
  list: AdminContentResponse[];
}
```

- [ ] **Step 4: Add authenticated API wrappers**

Implement wrappers using the existing `request` helper and `{ requireAuth: true }`. Update post/forum moderation wrappers to accept `AdminModerateContentRequest` without breaking `{ id }` callers.

```ts
export function fetchAdminModerationReportList(
  req: AdminModerationReportQueryRequest
) {
  return request<AdminModerationReportPageResponse>(
    "/api/admin/moderation/report/list",
    req,
    { requireAuth: true }
  );
}

export function fetchAdminModerationReportDetail(
  req: { id: string }
) {
  return request<AdminModerationReportResponse>(
    "/api/admin/moderation/report/detail",
    req,
    { requireAuth: true }
  );
}

export function resolveAdminModerationReport(
  req: AdminModerationReportResolveRequest
) {
  return request<AdminModerationReportResponse>(
    "/api/admin/moderation/report/resolve",
    req,
    { requireAuth: true }
  );
}
```

Add equivalent `fetchAdminContentList`, `adminHideComment`, and `adminRestoreComment` wrappers.

- [ ] **Step 5: Run the focused contract test and TypeScript tests**

Run: `cd frontend && node --test tests/admin-moderation-api.test.mjs && npm test -- admin-navigation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit API contracts**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/tests/admin-moderation-api.test.mjs
git commit -m "feat: add admin moderation api contracts"
```

## Task 3: Install Official shadcn Sidebar

**Files:**
- Create: `frontend/src/components/ui/sidebar.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: Confirm Sidebar is not already installed**

Run: `test ! -f frontend/src/components/ui/sidebar.tsx`

Expected: exit 0.

- [ ] **Step 2: Generate the official component**

Run from `frontend/`: `npx shadcn@latest add sidebar -y`

Expected: `src/components/ui/sidebar.tsx` is created and required dependencies/theme tokens are added. Do not replace the generated component with a custom wrapper.

- [ ] **Step 3: Verify the generated source compiles in isolation**

Run: `cd frontend && npx tsc -b --pretty false`

Expected: PASS.

- [ ] **Step 4: Commit generated Sidebar files**

```bash
git add frontend/src/components/ui/sidebar.tsx frontend/src/index.css frontend/package.json frontend/package-lock.json
git commit -m "feat: add shadcn sidebar"
```

## Task 4: Admin Sidebar And Query-Driven Shell

**Files:**
- Create: `frontend/src/components/admin/AdminSidebar.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Create: `frontend/tests/admin-moderation-ui.test.mjs`

- [ ] **Step 1: Write the failing Sidebar source contract**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("admin shell uses shadcn Sidebar and canonical tab links", async () => {
  const sidebar = await source("../src/components/admin/AdminSidebar.tsx");
  const page = await source("../src/pages/AdminPage.tsx");

  for (const token of [
    "Sidebar",
    "SidebarContent",
    "SidebarMenuButton",
    "首页配置",
    "媒体审核",
    "举报工单",
    "内容治理",
    "buildAdminTabHref",
  ]) assert.ok(sidebar.includes(token), `missing ${token}`);

  for (const token of [
    "SidebarProvider",
    "SidebarInset",
    "SidebarTrigger",
    "parseAdminTab",
    "window.location.search",
  ]) assert.ok(page.includes(token), `missing ${token}`);
});
```

- [ ] **Step 2: Run the source test and verify RED**

Run: `cd frontend && node --test tests/admin-moderation-ui.test.mjs`

Expected: FAIL because `AdminSidebar.tsx` does not exist and the page has no Sidebar shell.

- [ ] **Step 3: Implement AdminSidebar**

Use `Home`, `Images`, `Flag`, and `ShieldCheck` icons. Each `SidebarMenuButton` renders an anchor with `href={buildAdminTabHref(item.id)}`, `isActive={activeTab === item.id}`, and an `onClick` callback that prevents full navigation and delegates to `onTabChange`.

Expose this interface:

```ts
type AdminSidebarProps = {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
};
```

- [ ] **Step 4: Integrate the query-driven shell**

Initialize the tab with:

```ts
const [activeTab, setActiveTab] = useState<AdminTab>(() =>
  parseAdminTab(new URLSearchParams(window.location.search).get("tab"))
);
```

Listen for `popstate`, update the query with `history.pushState`, and wrap the authorized admin UI with `SidebarProvider`, `AdminSidebar`, `SidebarInset`, and a header containing `SidebarTrigger`.

- [ ] **Step 5: Run navigation and source tests**

Run: `cd frontend && npm test -- admin-navigation.test.ts && node --test tests/admin-moderation-ui.test.mjs`

Expected: PASS for navigation and Sidebar shell contract.

- [ ] **Step 6: Commit the admin shell**

```bash
git add frontend/src/components/admin/AdminSidebar.tsx frontend/src/pages/AdminPage.tsx frontend/tests/admin-moderation-ui.test.mjs
git commit -m "feat: add admin sidebar shell"
```

## Task 5: Report Queue Panel

**Files:**
- Create: `frontend/src/components/admin/AdminReportsPanel.tsx`
- Modify: `frontend/tests/admin-moderation-ui.test.mjs`
- Modify: `frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: Extend the failing report workflow contract**

Add a test that requires these tokens in `AdminReportsPanel.tsx`:

```js
test("report panel supports filters detail and resolution", async () => {
  const sourceText = await source("../src/components/admin/AdminReportsPanel.tsx");
  for (const token of [
    "fetchAdminModerationReportList",
    "fetchAdminModerationReportDetail",
    "resolveAdminModerationReport",
    'status: "open"',
    "reporterUserId",
    "targetId",
    "createdAtFrom",
    "createdAtTo",
    "accepted",
    "rejected",
    "resolved",
    "hide_post",
    "restore_post",
    "hide_comment",
    "restore_comment",
    "lock_forum_post",
    "unlock_forum_post",
    "处理说明",
  ]) assert.ok(sourceText.includes(token), `missing ${token}`);
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `cd frontend && node --test tests/admin-moderation-ui.test.mjs`

Expected: FAIL because `AdminReportsPanel.tsx` does not exist.

- [ ] **Step 3: Implement report state and loading**

Use page size 20 and default filters:

```ts
const [filters, setFilters] = useState({
  status: "open",
  targetType: "",
  reporterUserId: "",
  targetId: "",
  createdAtFrom: "",
  createdAtTo: "",
});
const [pageNum, setPageNum] = useState(1);
const [selectedId, setSelectedId] = useState("");
```

Load list and detail independently. Keep the current list during filter reloads. Select the first list row when the old selection is absent.

- [ ] **Step 4: Implement the split layout and resolution form**

Render filters above `grid min-h-0 gap-0 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(24rem,1.15fr)]`. Use a bordered list region and a detail region, not nested cards.

Require a non-empty resolution note only when `action` is non-empty:

```ts
const canResolve =
  detail?.status === "open" &&
  !resolving &&
  (!action || resolutionNote.trim().length > 0);
```

Submit the selected report's own `targetType` and `targetId`. On success, update detail and either remove or replace the list row based on the active status filter.

- [ ] **Step 5: Integrate the report tab**

Render `<AdminReportsPanel />` when `activeTab === "reports"`.

- [ ] **Step 6: Run focused tests and build**

Run: `cd frontend && node --test tests/admin-moderation-api.test.mjs tests/admin-moderation-ui.test.mjs && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit report management**

```bash
git add frontend/src/components/admin/AdminReportsPanel.tsx frontend/src/pages/AdminPage.tsx frontend/tests/admin-moderation-ui.test.mjs
git commit -m "feat: add admin report queue"
```

## Task 6: Complete Content And Forum Moderation

**Files:**
- Create: `frontend/src/components/admin/AdminContentModerationPanel.tsx`
- Create: `frontend/src/components/admin/AdminForumModerationPanel.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/tests/admin-moderation-ui.test.mjs`

- [ ] **Step 1: Extend the failing content workflow contract**

```js
test("content moderation uses admin content API and preserves forum actions", async () => {
  const content = await source("../src/components/admin/AdminContentModerationPanel.tsx");
  const forum = await source("../src/components/admin/AdminForumModerationPanel.tsx");

  for (const token of [
    "fetchAdminContentList",
    "adminHidePost",
    "adminRestorePost",
    "adminHideComment",
    "adminRestoreComment",
    "searchText",
    "userId",
    "治理原因",
    "动态与评论",
    "论坛帖子",
  ]) assert.ok(content.includes(token), `missing ${token}`);

  for (const token of [
    "fetchForumBoardList",
    "fetchForumPostCursorList",
    "adminLockForumPost",
    "adminUnlockForumPost",
    "adminPinForumPost",
    "adminUnpinForumPost",
  ]) assert.ok(forum.includes(token), `missing ${token}`);
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `cd frontend && node --test tests/admin-moderation-ui.test.mjs`

Expected: FAIL because the content and forum panel files do not exist.

- [ ] **Step 3: Implement dynamic/comment moderation**

Use filters `{ targetType, status, userId, searchText }`, page size 20, and a selected item. Render a split list/detail layout matching reports.

Require `reason.trim()` before all write actions. Select the API by target and status:

```ts
const request = selected.targetType === "comment_record"
  ? selected.status === "hidden" ? adminRestoreComment : adminHideComment
  : selected.status === "hidden" ? adminRestorePost : adminHidePost;
await request({ id: selected.id, reason: reason.trim() });
```

Update the selected row status locally after success, clear the reason, and show Sonner feedback.

- [ ] **Step 4: Implement forum moderation panel**

Move the existing forum board/list loading and lock/pin handlers out of `AdminPage.tsx`. Add a board filter, paginated cursor loading, selected forum item, and right-side operation area. Preserve all four existing admin forum functions.

- [ ] **Step 5: Replace the legacy moderation branch**

Remove `fetchPublicPostCursorList` and the old public-post moderation state from `AdminPage.tsx`. Render `<AdminContentModerationPanel />` for `activeTab === "moderation"`.

- [ ] **Step 6: Run focused tests and build**

Run: `cd frontend && node --test tests/admin-moderation-api.test.mjs tests/admin-moderation-ui.test.mjs && npm test -- admin-navigation.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit complete content governance**

```bash
git add frontend/src/components/admin/AdminContentModerationPanel.tsx frontend/src/components/admin/AdminForumModerationPanel.tsx frontend/src/pages/AdminPage.tsx frontend/tests/admin-moderation-ui.test.mjs
git commit -m "feat: complete admin content moderation"
```

## Task 7: Full Verification And Browser QA

**Files:**
- Modify only files required by verified defects from this task.

- [ ] **Step 1: Run the full frontend test suite**

Run: `cd frontend && npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run lint**

Run: `cd frontend && npm run lint`

Expected: exit 0 with no lint errors.

- [ ] **Step 3: Run production build**

Run: `cd frontend && npm run build`

Expected: exit 0 and `dist/` generated.

- [ ] **Step 4: Start the frontend for visual QA**

Run: `cd frontend && npm run dev -- --host 127.0.0.1`

Expected: Vite reports a local URL.

- [ ] **Step 5: Verify desktop behavior**

Open `/admin?tab=reports` at approximately 1440×1000 and confirm Sidebar, report filters, list/detail split, empty/loading/error states, and status controls render without overflow.

- [ ] **Step 6: Verify mobile behavior**

Open `/admin?tab=moderation` at approximately 390×844 and confirm SidebarTrigger opens the drawer, the work area stacks vertically, filters wrap, and action controls remain keyboard reachable.

- [ ] **Step 7: Verify URL behavior**

Check refresh and browser navigation for all four canonical tabs; confirm `/admin?tab=unknown` renders homepage and the next tab click writes a canonical URL.

- [ ] **Step 8: Review the final diff**

Run: `git diff --check && git status --short && git diff --stat HEAD~6..HEAD`

Expected: no whitespace errors; only scoped frontend files, the design, and this plan are included in implementation commits. Existing unrelated document deletions remain uncommitted.
