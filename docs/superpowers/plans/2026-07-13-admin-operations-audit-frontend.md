# Admin Operations and Audit Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/admin` with a dashboard, tag management, and operation audit workspace while reducing `AdminPage.tsx` to an access guard and panel router.

**Architecture:** Keep the existing query-parameter admin route and shadcn Sidebar. Add focused admin panels, typed API wrappers, URL helpers for `tab` and `logId`, and pure formatting helpers for audit actions and JSON. Preserve the current homepage, media review, report, and moderation behavior by extracting the first two into dedicated panels without redesigning them.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4, shadcn/Base UI, Sonner, Node test runner, oxlint.

---

## File map

Create:

- `frontend/src/components/admin/AdminDashboardPanel.tsx`: dashboard metrics, queue links, and recent audit entries.
- `frontend/src/components/admin/AdminTagManagementPanel.tsx`: tag filters, table, edit dialog, and merge dialog.
- `frontend/src/components/admin/AdminAuditPanel.tsx`: audit filters, paginated list, deep-linked detail, and JSON views.
- `frontend/src/components/admin/AdminHomepagePanel.tsx`: extracted homepage configuration state and UI.
- `frontend/src/components/admin/AdminMediaReviewPanel.tsx`: extracted pending-media review state and UI.
- `frontend/src/lib/admin-operation.ts`: audit action labels and safe JSON formatting.
- `frontend/tests/admin-operation.test.ts`: pure helper tests.
- `frontend/tests/admin-operations-api.test.mjs`: API path and type contract tests.
- `frontend/tests/admin-operations-ui.test.mjs`: admin panel and extraction source contracts.

Modify:

- `frontend/src/lib/admin-navigation.ts`: add dashboard, tags, audit, and `logId` URL support.
- `frontend/tests/admin-navigation.test.ts`: cover default dashboard and audit deep links.
- `frontend/src/lib/types.ts`: add dashboard, tag, and audit request/response types.
- `frontend/src/lib/api.ts`: add six admin operation/audit request wrappers.
- `frontend/src/components/admin/AdminSidebar.tsx`: add grouped navigation.
- `frontend/src/pages/AdminPage.tsx`: remove homepage/media business state and render seven panels.
- `frontend/tests/admin-moderation-ui.test.mjs`: preserve first-phase admin contracts after extraction.
- `frontend/tests/community-frontend-gaps.test.mjs`: point admin assertions at extracted panels.

## Task 1: Admin navigation and audit deep-link state

**Files:**

- Modify: `frontend/src/lib/admin-navigation.ts`
- Modify: `frontend/tests/admin-navigation.test.ts`

- [ ] **Step 1: Write failing navigation tests**

Replace the cases in `frontend/tests/admin-navigation.test.ts` with coverage for all seven tabs, dashboard fallback, trimmed audit IDs, and canonical audit links:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminTabHref,
  parseAdminLogId,
  parseAdminTab,
  type AdminTab,
} from "../src/lib/admin-navigation.ts";

test("admin tab query values are normalized", () => {
  const cases: Array<[string | null, AdminTab]> = [
    [null, "dashboard"],
    ["dashboard", "dashboard"],
    ["homepage", "homepage"],
    ["media-review", "media-review"],
    ["reports", "reports"],
    ["moderation", "moderation"],
    ["tags", "tags"],
    ["audit", "audit"],
    ["unknown", "dashboard"],
  ];

  for (const [value, expected] of cases) {
    assert.equal(parseAdminTab(value), expected);
  }
});

test("admin log ids are trimmed and empty values are discarded", () => {
  assert.equal(parseAdminLogId(null), "");
  assert.equal(parseAdminLogId("  "), "");
  assert.equal(parseAdminLogId(" 123 "), "123");
});

test("admin tab links use canonical query values", () => {
  assert.equal(buildAdminTabHref("reports"), "/admin?tab=reports");
  assert.equal(
    buildAdminTabHref("audit", { logId: "123" }),
    "/admin?tab=audit&logId=123"
  );
  assert.equal(buildAdminTabHref("tags", { logId: "123" }), "/admin?tab=tags");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd frontend
node --experimental-strip-types --test tests/admin-navigation.test.ts
```

Expected: FAIL because `parseAdminLogId`, the new tabs, and the options argument do not exist.

- [ ] **Step 3: Implement the navigation helpers**

Replace `frontend/src/lib/admin-navigation.ts` with:

```ts
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
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command.

Expected: 3 tests pass.

- [ ] **Step 5: Commit navigation support**

```bash
git add frontend/src/lib/admin-navigation.ts frontend/tests/admin-navigation.test.ts
git commit -m "feat: extend admin navigation state"
```

## Task 2: Dashboard, tag, and audit API contracts

**Files:**

- Create: `frontend/tests/admin-operations-api.test.mjs`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Write the failing API contract test**

Create `frontend/tests/admin-operations-api.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const types = await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8");

test("admin operations API exposes dashboard tags and audit workflows", () => {
  for (const token of [
    '"/api/admin/operation/dashboard"',
    '"/api/admin/operation/tag/list"',
    '"/api/admin/operation/tag/update"',
    '"/api/admin/operation/tag/merge"',
    '"/api/admin/audit/operation/list"',
    '"/api/admin/audit/operation/detail"',
    "fetchAdminDashboard",
    "fetchAdminTagList",
    "updateAdminTag",
    "mergeAdminTag",
    "fetchAdminOperationLogList",
    "fetchAdminOperationLogDetail",
  ]) {
    assert.ok(api.includes(token), `missing ${token}`);
  }
});

test("admin operations types preserve ids status and JSON snapshots", () => {
  for (const token of [
    "AdminDashboardResponse",
    "pendingMediaCount: number",
    "openReportCount: number",
    "AdminTagQueryRequest",
    "status?: number",
    "AdminTagUpdateRequest",
    "sourceTagId: string",
    "targetTagId: string",
    "AdminOperationLogQueryRequest",
    "operatorUserId?: string",
    "beforeJson: string",
    "afterJson: string",
    "metadataJson: string",
    "clientIp: string",
  ]) {
    assert.ok(types.includes(token), `missing ${token}`);
  }
});
```

- [ ] **Step 2: Run the contract test and verify RED**

```bash
cd frontend
node --test tests/admin-operations-api.test.mjs
```

Expected: FAIL with missing API and type tokens.

- [ ] **Step 3: Add exact TypeScript contracts**

Add these interfaces near the existing admin moderation types in `frontend/src/lib/types.ts`:

```ts
export interface AdminDashboardRequest {}

export interface AdminDashboardResponse {
  pendingMediaCount: number;
  openReportCount: number;
  activeUserCount: number;
  publicMediaCount: number;
  publicPostCount: number;
  recentMediaCount: number;
  recentPostCount: number;
  recentReportCount: number;
}

export interface AdminTagQueryRequest {
  name?: string;
  tagType?: string;
  status?: number;
  pageNum?: number;
  pageSize?: number;
}

export interface AdminTagUpdateRequest {
  id: string;
  name?: string;
  slug?: string;
  tagType?: string;
  status?: number;
  reason?: string;
}

export interface AdminTagMergeRequest {
  sourceTagId: string;
  targetTagId: string;
  reason?: string;
}

export interface AdminTagResponse {
  id: string;
  name: string;
  slug: string;
  tagType: string;
  status: number;
  createdAt: string;
}

export interface AdminTagPageResponse {
  pageNum: number;
  pageSize: number;
  total: number;
  list: AdminTagResponse[];
}

export interface AdminOperationLogQueryRequest {
  operatorUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface AdminOperationLogDetailRequest {
  id: string;
}

export interface AdminOperationLogResponse {
  id: string;
  operatorUserId: string;
  operator: AccountSummary;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  beforeJson: string;
  afterJson: string;
  metadataJson: string;
  clientIp: string;
  createdAt: string;
}

export interface AdminOperationLogPageResponse {
  pageNum: number;
  pageSize: number;
  total: number;
  list: AdminOperationLogResponse[];
}
```

- [ ] **Step 4: Add authenticated API wrappers**

Import the new types in `frontend/src/lib/api.ts`, then add:

```ts
export function fetchAdminDashboard(
  req: AdminDashboardRequest = {}
): Promise<AdminDashboardResponse> {
  return request<AdminDashboardResponse>(
    "/api/admin/operation/dashboard",
    req,
    { requireAuth: true }
  );
}

export function fetchAdminTagList(
  req: AdminTagQueryRequest
): Promise<AdminTagPageResponse> {
  return request<AdminTagPageResponse>(
    "/api/admin/operation/tag/list",
    req,
    { requireAuth: true }
  );
}

export function updateAdminTag(
  req: AdminTagUpdateRequest
): Promise<AdminTagResponse> {
  return request<AdminTagResponse>(
    "/api/admin/operation/tag/update",
    req,
    { requireAuth: true }
  );
}

export function mergeAdminTag(
  req: AdminTagMergeRequest
): Promise<AdminTagResponse> {
  return request<AdminTagResponse>(
    "/api/admin/operation/tag/merge",
    req,
    { requireAuth: true }
  );
}

export function fetchAdminOperationLogList(
  req: AdminOperationLogQueryRequest
): Promise<AdminOperationLogPageResponse> {
  return request<AdminOperationLogPageResponse>(
    "/api/admin/audit/operation/list",
    req,
    { requireAuth: true }
  );
}

export function fetchAdminOperationLogDetail(
  req: AdminOperationLogDetailRequest
): Promise<AdminOperationLogResponse> {
  return request<AdminOperationLogResponse>(
    "/api/admin/audit/operation/detail",
    req,
    { requireAuth: true }
  );
}
```

- [ ] **Step 5: Run API tests and TypeScript build**

```bash
cd frontend
node --test tests/admin-operations-api.test.mjs
npm run build
```

Expected: contract tests pass and TypeScript/Vite build exits 0.

- [ ] **Step 6: Commit API contracts**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/tests/admin-operations-api.test.mjs
git commit -m "feat: add admin operations api contracts"
```

## Task 3: Audit labels and safe JSON helpers

**Files:**

- Create: `frontend/src/lib/admin-operation.ts`
- Create: `frontend/tests/admin-operation.test.ts`

- [ ] **Step 1: Write failing pure-function tests**

Create `frontend/tests/admin-operation.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAdminOperationJson,
  getAdminOperationLabel,
} from "../src/lib/admin-operation.ts";

test("known admin operations use Chinese labels and unknown values stay visible", () => {
  assert.equal(getAdminOperationLabel("tag.update"), "更新标签");
  assert.equal(getAdminOperationLabel("moderation.report.resolve"), "处理举报");
  assert.equal(getAdminOperationLabel("forum_post.unpin"), "取消论坛置顶");
  assert.equal(getAdminOperationLabel("custom.action"), "custom.action");
  assert.equal(getAdminOperationLabel(""), "未知操作");
});

test("admin JSON formatting preserves parsed raw and empty values", () => {
  assert.deepEqual(formatAdminOperationJson('{"count":1}'), {
    kind: "json",
    text: '{\n  "count": 1\n}',
  });
  assert.deepEqual(formatAdminOperationJson("not-json"), {
    kind: "raw",
    text: "not-json",
  });
  assert.deepEqual(formatAdminOperationJson("  "), {
    kind: "empty",
    text: "无",
  });
});
```

- [ ] **Step 2: Run the helper test and verify RED**

```bash
cd frontend
node --experimental-strip-types --test tests/admin-operation.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement operation helpers**

Create `frontend/src/lib/admin-operation.ts`:

```ts
const OPERATION_LABELS: Record<string, string> = {
  "tag.update": "更新标签",
  "tag.merge": "合并标签",
  "content.feature": "设为精选",
  "content.unfeature": "取消精选",
  "moderation.report.resolve": "处理举报",
  "post.hide": "隐藏动态",
  "post.restore": "恢复动态",
  "comment.hide": "隐藏评论",
  "comment.restore": "恢复评论",
  "forum_post.lock": "锁定论坛帖子",
  "forum_post.unlock": "解锁论坛帖子",
  "forum_post.pin": "论坛分区置顶",
  "forum_post.unpin": "取消论坛置顶",
};

export function getAdminOperationLabel(action: string) {
  const value = action.trim();
  if (!value) return "未知操作";
  return OPERATION_LABELS[value] ?? value;
}

export type AdminOperationJsonView = {
  kind: "json" | "raw" | "empty";
  text: string;
};

export function formatAdminOperationJson(
  value: string | null | undefined
): AdminOperationJsonView {
  const raw = value?.trim() ?? "";
  if (!raw) return { kind: "empty", text: "无" };
  try {
    return {
      kind: "json",
      text: JSON.stringify(JSON.parse(raw), null, 2),
    };
  } catch {
    return { kind: "raw", text: raw };
  }
}
```

- [ ] **Step 4: Run the helper test and verify GREEN**

Run the Step 2 command.

Expected: 2 tests pass.

- [ ] **Step 5: Commit pure helpers**

```bash
git add frontend/src/lib/admin-operation.ts frontend/tests/admin-operation.test.ts
git commit -m "feat: add admin audit formatting helpers"
```

## Task 4: Extract homepage and media review panels

**Files:**

- Create: `frontend/src/components/admin/AdminHomepagePanel.tsx`
- Create: `frontend/src/components/admin/AdminMediaReviewPanel.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/tests/admin-operations-ui.test.mjs`
- Modify: `frontend/tests/admin-moderation-ui.test.mjs`
- Modify: `frontend/tests/community-frontend-gaps.test.mjs`

- [ ] **Step 1: Write the failing extraction contract**

Create `frontend/tests/admin-operations-ui.test.mjs` with the extraction test first:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("AdminPage delegates homepage and media review business logic", async () => {
  const page = await source("../src/pages/AdminPage.tsx");
  const homepage = await source(
    "../src/components/admin/AdminHomepagePanel.tsx"
  );
  const media = await source(
    "../src/components/admin/AdminMediaReviewPanel.tsx"
  );

  assert.ok(page.includes("AdminHomepagePanel"));
  assert.ok(page.includes("AdminMediaReviewPanel"));
  assert.ok(!page.includes("fetchHomepageConfig"));
  assert.ok(!page.includes("fetchAdminMediaAssetList"));
  assert.ok(!page.includes("reviewMediaAsset"));

  for (const token of [
    "fetchHomepageConfig",
    "updateHomepageHero",
    "updateHomepageFeatured",
    "MediaPickerDialog",
    "MAX_FEATURED_COUNT",
  ]) {
    assert.ok(homepage.includes(token), `homepage missing ${token}`);
  }

  for (const token of [
    "fetchAdminMediaAssetList",
    "reviewMediaAsset",
    "mediaReviewMessage",
    "pendingMedia",
  ]) {
    assert.ok(media.includes(token), `media review missing ${token}`);
  }
});
```

- [ ] **Step 2: Run the UI contract and verify RED**

```bash
cd frontend
node --test tests/admin-operations-ui.test.mjs
```

Expected: FAIL because both panel files are missing.

- [ ] **Step 3: Extract `AdminHomepagePanel` without behavior changes**

Move these exact homepage responsibilities from `AdminPage.tsx` into `AdminHomepagePanel.tsx`:

- `MAX_FEATURED_COUNT`, `DEFAULT_FOCAL`, `clampPercent`, `getErrorMessage` and `HeroDraft`.
- `config`, `loading`, `loadError`, hero/featured draft, picker, saving, dragging, and preview-ref state.
- `applyConfig`, `loadConfig`, dirty-state memos, focal-point handlers, save handlers, reorder/remove handlers, and featured IDs.
- The existing loading, load-error, Hero, featured, and both `MediaPickerDialog` JSX branches.

The new file must export `MAX_FEATURED_COUNT = 20` and a named `AdminHomepagePanel` component whose root is the current `flex flex-col gap-8` homepage wrapper.

Keep existing API calls, copy, Sonner messages, class names, focal behavior, picker behavior, and save semantics unchanged.

- [ ] **Step 4: Extract `AdminMediaReviewPanel` without behavior changes**

Move these exact media-review responsibilities from `AdminPage.tsx` into `AdminMediaReviewPanel.tsx`:

- `pendingMedia`, `mediaReviewLoading`, `mediaReviewMessage`, and `reviewingMediaId` state.
- `loadPendingMedia` and `handleReviewMedia`.
- The media-review header, textarea, loading/empty/list states, image preview, approve/reject buttons, and refresh button.

The new file must export a named `AdminMediaReviewPanel` component whose root keeps the current `section` and `admin-media-review-heading` accessible relationship.

Keep the existing pending-only request, 24-item page size, review-message semantics, image URL resolution, and Sonner feedback unchanged.

- [ ] **Step 5: Reduce `AdminPage` to shell and panel routing**

Remove all imports and state that moved to the two panels. Keep `isAdminRole`, `navigateTo`, access guard, section copy, active tab state, Sidebar layout, `AdminReportsPanel`, and `AdminContentModerationPanel`.

Replace the old homepage and media branches with:

```tsx
{activeTab === "homepage" ? (
  <AdminHomepagePanel />
) : activeTab === "media-review" ? (
  <AdminMediaReviewPanel />
) : activeTab === "reports" ? (
  <AdminReportsPanel />
) : (
  <AdminContentModerationPanel />
)}
```

- [ ] **Step 6: Update old source contracts**

In `frontend/tests/admin-moderation-ui.test.mjs` and `frontend/tests/community-frontend-gaps.test.mjs`, read `AdminMediaReviewPanel.tsx` for media-review tokens and keep `AdminPage.tsx` assertions focused on shell/panel composition. Do not restore public-post moderation assertions.

- [ ] **Step 7: Run focused and full tests**

```bash
cd frontend
node --test tests/admin-operations-ui.test.mjs tests/admin-moderation-ui.test.mjs tests/community-frontend-gaps.test.mjs
npm test
npm run build
```

Expected: focused tests pass, full suite has 0 failures, build exits 0.

- [ ] **Step 8: Commit panel extraction**

```bash
git add frontend/src/components/admin/AdminHomepagePanel.tsx frontend/src/components/admin/AdminMediaReviewPanel.tsx frontend/src/pages/AdminPage.tsx frontend/tests/admin-operations-ui.test.mjs frontend/tests/admin-moderation-ui.test.mjs frontend/tests/community-frontend-gaps.test.mjs
git commit -m "refactor: extract legacy admin panels"
```

## Task 5: Dashboard panel and grouped sidebar

**Files:**

- Modify: `frontend/src/components/admin/AdminSidebar.tsx`
- Create: `frontend/src/components/admin/AdminDashboardPanel.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/tests/admin-operations-ui.test.mjs`

- [ ] **Step 1: Add failing dashboard and sidebar contracts**

Append to `frontend/tests/admin-operations-ui.test.mjs`:

```js
test("admin sidebar groups dashboard and content workspaces", async () => {
  const sidebar = await source("../src/components/admin/AdminSidebar.tsx");
  for (const token of [
    "数据概览",
    "内容管理",
    "首页配置",
    "媒体审核",
    "举报工单",
    "内容治理",
  ]) {
    assert.ok(sidebar.includes(token), `sidebar missing ${token}`);
  }
});

test("admin dashboard shows real metrics queue links and recent operations", async () => {
  const dashboard = await source(
    "../src/components/admin/AdminDashboardPanel.tsx"
  );
  for (const token of [
    "fetchAdminDashboard",
    "fetchAdminOperationLogList",
    "pendingMediaCount",
    "openReportCount",
    "activeUserCount",
    "publicMediaCount",
    "publicPostCount",
    "最近操作",
    "查看全部操作日志",
  ]) {
    assert.ok(dashboard.includes(token), `dashboard missing ${token}`);
  }
  for (const token of [
    "recentMediaCount",
    "recentPostCount",
    "recentReportCount",
  ]) {
    assert.ok(!dashboard.includes(token), `dashboard must not render ${token}`);
  }
});
```

- [ ] **Step 2: Run the UI contract and verify RED**

```bash
cd frontend
node --test tests/admin-operations-ui.test.mjs
```

Expected: FAIL because the dashboard file and grouped labels are missing.

- [ ] **Step 3: Group the sidebar items**

Replace the flat item array with two explicit groups. The operations group is added when its first working panel is implemented in Task 6:

```ts
const ADMIN_GROUPS = [
  {
    label: "运营概览",
    items: [{ id: "dashboard", label: "数据概览", icon: LayoutDashboard }],
  },
  {
    label: "内容管理",
    items: [
      { id: "homepage", label: "首页配置", icon: House },
      { id: "media-review", label: "媒体审核", icon: Images },
      { id: "reports", label: "举报工单", icon: Flag },
      { id: "moderation", label: "内容治理", icon: ShieldCheck },
    ],
  },
] satisfies Array<{
  label: string;
  items: Array<{ id: AdminTab; label: string; icon: typeof House }>;
}>;
```

Render one `SidebarGroup` per group and preserve the existing `preventDefault`, `onTabChange`, tooltip, active state, and mobile close behavior.

- [ ] **Step 4: Implement `AdminDashboardPanel`**

The component props are:

```ts
type AdminDashboardPanelProps = {
  onNavigate: (tab: AdminTab) => void;
  onOpenAuditLog: (id: string) => void;
};
```

Use separate `loadDashboard` and `loadRecentLogs` callbacks and separate loading/error state. Request recent logs with `{ pageNum: 1, pageSize: 5 }`. Render:

- Two actionable queue cards for pending media and open reports.
- Three site-size cards for active users, public media, and public posts.
- Links to `/discover` and `/community` for public content counts.
- A recent operation list using `getAdminOperationLabel` and `formatRelativeTime`.
- Independent retry buttons and a shared refresh action that invokes both loaders.

Do not reference the three unpopulated Recent fields.

- [ ] **Step 5: Wire dashboard routing in `AdminPage`**

Read both `tab` and `logId` from `window.location.search`. Add:

```ts
const [activeLogId, setActiveLogId] = useState(() =>
  parseAdminLogId(new URLSearchParams(window.location.search).get("logId"))
);

const handleAuditLogOpen = useCallback((id: string) => {
  const href = buildAdminTabHref("audit", { logId: id });
  window.history.pushState({}, "", href);
  setActiveTab("audit");
  setActiveLogId(id);
  window.scrollTo({ top: 0 });
}, []);
```

Update the popstate handler to synchronize both values. `handleTabChange` must clear `activeLogId` because `buildAdminTabHref(tab)` omits it. Add dashboard section copy in this task; tags and audit section copy are added with their working panels in Tasks 6 and 7.

Render the dashboard with:

```tsx
<AdminDashboardPanel
  onNavigate={handleTabChange}
  onOpenAuditLog={handleAuditLogOpen}
/>
```

- [ ] **Step 6: Run tests and build**

```bash
cd frontend
node --experimental-strip-types --test tests/admin-navigation.test.ts tests/admin-operations-ui.test.mjs
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit dashboard and sidebar**

```bash
git add frontend/src/components/admin/AdminSidebar.tsx frontend/src/components/admin/AdminDashboardPanel.tsx frontend/src/pages/AdminPage.tsx frontend/tests/admin-operations-ui.test.mjs
git commit -m "feat: add admin operations dashboard"
```

## Task 6: Tag management panel

**Files:**

- Create: `frontend/src/components/admin/AdminTagManagementPanel.tsx`
- Modify: `frontend/src/components/admin/AdminSidebar.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/tests/admin-operations-ui.test.mjs`

- [ ] **Step 1: Add a failing tag-management contract**

Append:

```js
test("tag management supports explicit status edit and merge workflows", async () => {
  const sidebar = await source("../src/components/admin/AdminSidebar.tsx");
  const tags = await source(
    "../src/components/admin/AdminTagManagementPanel.tsx"
  );
  for (const token of [
    "fetchAdminTagList",
    "updateAdminTag",
    "mergeAdminTag",
    'status: 1',
    "修改原因",
    "合并原因",
    "源标签",
    "目标标签",
    "标签关联将迁移",
    "pageSize: 20",
  ]) {
    assert.ok(tags.includes(token), `tag management missing ${token}`);
  }
  assert.ok(sidebar.includes("运营管理"));
  assert.ok(sidebar.includes("标签管理"));
  assert.ok(!tags.includes("全部状态"));
});
```

- [ ] **Step 2: Run the contract and verify RED**

```bash
cd frontend
node --test tests/admin-operations-ui.test.mjs
```

Expected: FAIL because the tag panel does not exist.

- [ ] **Step 3: Implement list and filters**

Create `AdminTagManagementPanel.tsx` with:

```ts
const PAGE_SIZE = 20;

type TagFilters = {
  name: string;
  tagType: string;
  status: 0 | 1;
};

const DEFAULT_FILTERS: TagFilters = {
  name: "",
  tagType: "",
  status: 1,
};
```

Maintain draft filters separately from submitted filters. Request `name`, `tagType`, explicit `status`, `pageNum`, and `pageSize`. Render a horizontally scrollable semantic table with name, slug, type, status, created time, edit, and merge actions. Provide loading skeleton rows, inline error with retry, empty state, previous/next pagination, and no “all statuses” choice.

- [ ] **Step 4: Implement the edit dialog**

Use the existing shadcn `Dialog`, `Input`, `Select`, `Label`, and `Button`. Copy the selected tag into an edit draft containing `name`, `slug`, `tagType`, `status`, and `reason`.

Require non-empty name, slug, type, and trimmed reason. Submit the complete current values:

```ts
const next = await updateAdminTag({
  id: editTag.id,
  name: editDraft.name.trim(),
  slug: editDraft.slug.trim(),
  tagType: editDraft.tagType.trim(),
  status: editDraft.status,
  reason: editDraft.reason.trim(),
});
```

Replace only the matching row with the response, close on success, and retain the draft on failure.

- [ ] **Step 5: Implement the merge dialog**

Keep the source tag fixed. The merge dialog contains target-name search, a search button, active-target results, selected target, and required reason. Search with:

```ts
fetchAdminTagList({
  name: targetSearch.trim() || undefined,
  status: 1,
  pageNum: 1,
  pageSize: 20,
});
```

Filter the source ID out of results. Disable submit when the target is missing, target equals source, reason is empty, or a request is running. Render the exact warning that associations move to the target and the source becomes disabled. Submit:

```ts
await mergeAdminTag({
  sourceTagId: mergeSource.id,
  targetTagId: mergeTarget.id,
  reason: mergeReason.trim(),
});
```

On success, close the dialog, show Sonner feedback, set `highlightedTagId` to the returned target ID, reset to page 1, and reload the submitted filters. If the target is present in the refreshed page, apply a temporary highlighted row background; clear the highlight when filters, page, or another mutation changes. On failure, keep the source, target, search results, and reason.

- [ ] **Step 6: Add the operations group and render the tags panel**

Add a third `AdminSidebar` group named `运营管理` containing the working `tags` item. Do not expose the audit item until Task 7 creates the audit panel.

Add tags section copy and the explicit `AdminPage` branch:

Add the explicit branch:

```tsx
) : activeTab === "tags" ? (
  <AdminTagManagementPanel />
```

Keep moderation as an explicit branch instead of a final catch-all so an exhaustive final fallback cannot silently render the wrong panel.

- [ ] **Step 7: Run tests, lint, and build**

```bash
cd frontend
node --test tests/admin-operations-ui.test.mjs
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit tag management**

```bash
git add frontend/src/components/admin/AdminTagManagementPanel.tsx frontend/src/components/admin/AdminSidebar.tsx frontend/src/pages/AdminPage.tsx frontend/tests/admin-operations-ui.test.mjs
git commit -m "feat: add admin tag management"
```

## Task 7: Operation audit panel and `logId` synchronization

**Files:**

- Create: `frontend/src/components/admin/AdminAuditPanel.tsx`
- Modify: `frontend/src/components/admin/AdminSidebar.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/tests/admin-operations-ui.test.mjs`

- [ ] **Step 1: Add a failing audit-panel contract**

Append:

```js
test("operation audit supports filters deep links and safe JSON sections", async () => {
  const sidebar = await source("../src/components/admin/AdminSidebar.tsx");
  const audit = await source("../src/components/admin/AdminAuditPanel.tsx");
  assert.ok(sidebar.includes("操作审计"));
  for (const token of [
    "fetchAdminOperationLogList",
    "fetchAdminOperationLogDetail",
    "operatorUserId",
    "targetType",
    "targetId",
    "createdAtFrom",
    "createdAtTo",
    "formatAdminOperationJson",
    "Before",
    "After",
    "Metadata",
    "clientIp",
    "onSelectedIdChange",
  ]) {
    assert.ok(audit.includes(token), `audit panel missing ${token}`);
  }
});
```

- [ ] **Step 2: Run the contract and verify RED**

```bash
cd frontend
node --test tests/admin-operations-ui.test.mjs
```

Expected: FAIL because the audit panel does not exist.

- [ ] **Step 3: Implement list filters and pagination**

Use these props and filter state:

```ts
type AdminAuditPanelProps = {
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
};

type AuditFilters = {
  operatorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAtFrom: string;
  createdAtTo: string;
};
```

Use draft/submitted filters, page number, page size 20, preserved rows during reload, skeletons, inline retry, empty state, and previous/next buttons. Preserve a non-empty initial `selectedId` during the first list load so a dashboard or direct URL deep link can load independently even when it is not on the current page. Before submitting filters, clearing filters, or changing page, call `onSelectedIdChange("")`; after the new list succeeds, select its first row through `onSelectedIdChange`.

- [ ] **Step 4: Implement independent detail loading**

Whenever `selectedId` is non-empty, call `fetchAdminOperationLogDetail({ id: selectedId })` independently from list loading. Use a cancellation flag in the effect so a slower previous request cannot overwrite a newer selection. Detail failure must leave list rows visible and provide a detail-only retry button.

- [ ] **Step 5: Render safe JSON views**

Format `beforeJson`, `afterJson`, and `metadataJson` with `formatAdminOperationJson`. Render Before and After in a responsive two-column grid and Metadata beneath them. Each section uses a horizontally scrollable `<pre>` with wrapping disabled, a visible “无” empty state, and raw fallback text for invalid JSON.

Display operator avatar/name/ID, Chinese operation label, raw action value, target, reason, client IP, and time. Keep the panel read-only.

- [ ] **Step 6: Expose audit navigation and wire selection to URL state**

Add the `audit` item to the existing `运营管理` sidebar group and add audit section copy to `AdminPage`.

Add to `AdminPage`:

```ts
const handleAuditLogChange = useCallback((id: string) => {
  const href = buildAdminTabHref("audit", { logId: id });
  window.history.replaceState({}, "", href);
  setActiveLogId(id);
}, []);
```

Render:

```tsx
<AdminAuditPanel
  selectedId={activeLogId}
  onSelectedIdChange={handleAuditLogChange}
/>
```

Dashboard clicks continue to use `pushState`; list-selection changes use `replaceState` so arrow-key or row exploration does not flood browser history.

- [ ] **Step 7: Run tests, lint, and build**

```bash
cd frontend
node --experimental-strip-types --test tests/admin-operation.test.ts tests/admin-navigation.test.ts
node --test tests/admin-operations-api.test.mjs tests/admin-operations-ui.test.mjs
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit operation audit**

```bash
git add frontend/src/components/admin/AdminAuditPanel.tsx frontend/src/components/admin/AdminSidebar.tsx frontend/src/pages/AdminPage.tsx frontend/tests/admin-operations-ui.test.mjs
git commit -m "feat: add admin operation audit"
```

## Task 8: Final integration, responsive browser QA, and documentation verification

**Files:**

- Modify only if verification finds an issue: files introduced or changed in Tasks 1–7.

- [ ] **Step 1: Run a spec-coverage source audit**

Verify:

```bash
rg -n "dashboard|tags|audit|logId" frontend/src/lib/admin-navigation.ts frontend/src/pages/AdminPage.tsx frontend/src/components/admin/AdminSidebar.tsx
rg -n "recentMediaCount|recentPostCount|recentReportCount" frontend/src/components/admin/AdminDashboardPanel.tsx
rg -n "全部状态" frontend/src/components/admin/AdminTagManagementPanel.tsx
rg -n "fetchHomepageConfig|fetchAdminMediaAssetList|reviewMediaAsset" frontend/src/pages/AdminPage.tsx
```

Expected:

- First command finds all new tab and URL integration points.
- Second, third, and fourth commands return no matches.

- [ ] **Step 2: Run full frontend verification**

```bash
cd frontend
npm test
npm run lint
npm run build
```

Expected: 0 test failures, lint exits 0, TypeScript/Vite build exits 0. Record the existing Vite chunk-size warning as non-blocking if it remains the only warning.

- [ ] **Step 3: Run desktop browser QA**

Start the frontend against a reachable development backend or a deliberately unreachable API base for authenticated shell/error-state verification. At a 1440×1000 viewport verify:

- `/admin` resolves to `/admin?tab=dashboard` behavior and renders dashboard copy.
- Sidebar shows the three approved groups and seven entries.
- Dashboard queue links open media review and reports.
- Recent operation clicks open `/admin?tab=audit&logId=<id>` when data is available.
- Tag table, edit dialog, merge dialog, audit list/detail split, loading, empty, and error states remain readable.

- [ ] **Step 4: Run mobile browser QA**

At a 390×844 viewport verify:

- Sidebar opens as a shadcn Sheet and closes after navigation.
- Dashboard cards stack without horizontal overflow.
- Tag table remains reachable through horizontal scrolling.
- Edit and merge dialogs fit the viewport and keep action buttons reachable.
- Audit list and detail stack vertically, and JSON blocks scroll horizontally inside their own containers.

Reset the temporary viewport after verification.

- [ ] **Step 5: Inspect the final diff and workspace state**

```bash
git diff --check
git status --short
git log --oneline --decorate -10
```

Expected: no whitespace errors; only user-owned unrelated changes may remain unstaged; all implementation changes are committed on the feature branch.

- [ ] **Step 6: Commit verification fixes if needed**

If QA required code changes, stage only the affected implementation and test files, then commit:

```bash
git commit -m "fix: polish admin operations workspace"
```

If QA required no changes, do not create an empty commit.
