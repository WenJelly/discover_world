# Frontend Button System Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all Discover World user-facing and admin action buttons on the existing shadcn `base-nova` Button system while preserving semantic card, list, tab, and selection surfaces.

**Architecture:** Keep the generated shadcn Button unchanged, install the official Spinner, and add one shared class constant for native interactive surfaces. Convert 46 native action buttons to shadcn Button, retain and mark 24 business interactive surfaces plus the generated SidebarRail, then enforce the boundary with source-contract tests.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, shadcn `base-nova`, Base UI, Lucide React, Node test runner, oxlint.

---

## File map

### New files

- `frontend/src/components/ui/spinner.tsx`: official shadcn loading indicator.
- `frontend/src/lib/interactive-surface.ts`: shared focus and disabled-state classes for native semantic surfaces.
- `frontend/tests/button-system-source.test.mjs`: source contracts for Button usage, native surface registration, icon labels, Spinner use, and retired CSS.

### User-facing files to modify

- `frontend/src/pages/DiscoverPage.tsx`
- `frontend/src/pages/SearchPage.tsx`
- `frontend/src/pages/CommunityPage.tsx`
- `frontend/src/pages/NotificationsPage.tsx`
- `frontend/src/pages/AccountDetailPage.tsx`
- `frontend/src/components/home/InfiniteGallery.tsx`
- `frontend/src/components/Navbar.tsx`
- `frontend/src/components/auth/AuthDialog.tsx`
- `frontend/src/components/notifications/NotificationBell.tsx`
- `frontend/src/components/upload/UploadDialog.tsx`
- `frontend/src/components/discover/DiscoverPictureCard.tsx`
- `frontend/src/components/post/PostComposerDialog.tsx`
- `frontend/src/components/post/PostImageAttach.tsx`
- `frontend/src/components/post/PostCard.tsx`
- `frontend/src/components/post/PostVisibilityMenu.tsx`
- `frontend/src/components/photo/PhotoStats.tsx`
- `frontend/src/components/photo/PhotoDetailDialog.tsx`
- `frontend/src/components/photo/PhotographerInfo.tsx`
- `frontend/src/components/photo/DownloadButton.tsx`
- `frontend/src/components/ImagePreviewModal.tsx`

### Admin files to modify

- `frontend/src/components/admin/AdminHomepagePanel.tsx`
- `frontend/src/components/admin/AdminDashboardPanel.tsx`
- `frontend/src/components/admin/AdminForumModerationPanel.tsx`
- `frontend/src/components/admin/AdminReportsPanel.tsx`
- `frontend/src/components/admin/AdminContentModerationPanel.tsx`
- `frontend/src/components/admin/AdminTagManagementPanel.tsx`
- `frontend/src/components/admin/AdminAuditPanel.tsx`
- `frontend/src/components/admin/MediaPickerDialog.tsx`
- `frontend/src/components/admin/AdminMediaReviewPanel.tsx`

### Shared style file to modify

- `frontend/src/index.css`: remove retired page-specific button rules after JSX migration.

### Generated file to inspect but not modify

- `frontend/src/components/ui/sidebar.tsx`: keep the generated `SidebarRail` native button unchanged.

## Semantic mapping used by every task

| Intent | Button props |
| --- | --- |
| Primary submit/query/publish | `variant="default" size="default"` |
| Page-level empty-state entry | `variant="default" size="lg"` |
| Cancel/retry/load more | `variant="outline"` |
| Selected mode/toggle | `variant="secondary"` with `aria-pressed` |
| Toolbar/clear/auxiliary | `variant="ghost"` |
| Delete/reject/remove | `variant="destructive"` |
| Inline auth switch | `variant="link" size="xs"` |
| Icon-only control | matching `size="icon*"` plus Chinese `aria-label` |

## Task 1: Add the shared Button foundations

**Files:**

- Create: `frontend/tests/button-system-source.test.mjs`
- Create: `frontend/src/components/ui/spinner.tsx`
- Create: `frontend/src/lib/interactive-surface.ts`

- [ ] **Step 1: Write the failing foundation test**

Create `frontend/tests/button-system-source.test.mjs` with this initial content:

```js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), "utf8")
}

test("button foundations keep shadcn Button and provide Spinner plus interactive surface states", () => {
  const button = readSource("components/ui/button.tsx")
  const spinner = readSource("components/ui/spinner.tsx")
  const surface = readSource("lib/interactive-surface.ts")

  assert.match(button, /import \{ Button as ButtonPrimitive \} from "@base-ui\/react\/button"/)
  assert.match(button, /default: "bg-primary text-primary-foreground hover:bg-primary\/80"/)
  assert.match(button, /destructive:/)
  assert.match(spinner, /data-slot="spinner"/)
  assert.match(spinner, /role="status"/)
  assert.match(spinner, /className=\{cn\("size-4 animate-spin", className\)\}/)
  assert.match(surface, /focus-visible:ring-3/)
  assert.match(surface, /focus-visible:ring-ring\/50/)
  assert.match(surface, /disabled:pointer-events-none/)
})
```

- [ ] **Step 2: Run the foundation test and verify RED**

Run:

```bash
cd frontend
node --test tests/button-system-source.test.mjs
```

Expected: FAIL with `ENOENT` for `src/components/ui/spinner.tsx`.

- [ ] **Step 3: Install the official shadcn Spinner**

Run from `frontend/`:

```bash
npx shadcn@latest add spinner -y
```

Verify that the generated `frontend/src/components/ui/spinner.tsx` is:

```tsx
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
```

- [ ] **Step 4: Add the native interactive-surface class**

Create `frontend/src/lib/interactive-surface.ts`:

```ts
const interactiveSurfaceClassName =
  "outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

export { interactiveSurfaceClassName }
```

- [ ] **Step 5: Run the foundation test and verify GREEN**

Run:

```bash
cd frontend
node --test tests/button-system-source.test.mjs
```

Expected: PASS, one test.

- [ ] **Step 6: Commit the foundation**

```bash
git add frontend/src/components/ui/spinner.tsx frontend/src/lib/interactive-surface.ts frontend/tests/button-system-source.test.mjs frontend/package.json frontend/package-lock.json
git commit -m "feat: add shared button foundations"
```

## Task 2: Migrate discovery, search, community, and home actions

**Files:**

- Modify: `frontend/tests/button-system-source.test.mjs`
- Modify: `frontend/src/pages/DiscoverPage.tsx:472-783`
- Modify: `frontend/src/pages/SearchPage.tsx:697-814`
- Modify: `frontend/src/pages/CommunityPage.tsx:169-175,697-711,874-886`
- Modify: `frontend/src/components/home/InfiniteGallery.tsx:163-220`
- Modify: `frontend/src/components/discover/DiscoverPictureCard.tsx:28-52`

- [ ] **Step 1: Add the failing public-surface contract**

Append these helpers and test to `frontend/tests/button-system-source.test.mjs`:

```js
function openingTags(source, tagName) {
  const result = []
  const needle = `<${tagName}`
  let start = 0

  while ((start = source.indexOf(needle, start)) >= 0) {
    const boundary = source[start + needle.length]
    if (boundary && !/[\s/>]/.test(boundary)) {
      start += needle.length
      continue
    }

    let quote = null
    let braceDepth = 0
    let end = start + needle.length

    for (; end < source.length; end += 1) {
      const char = source[end]
      const previous = source[end - 1]
      if (quote) {
        if (char === quote && previous !== "\\") quote = null
        continue
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char
        continue
      }
      if (char === "{") braceDepth += 1
      if (char === "}") braceDepth -= 1
      if (char === ">" && braceDepth === 0) break
    }

    result.push(source.slice(start, end + 1))
    start = end + 1
  }

  return result
}

function assertMarkedNativeSurfaces(relativePath, expectedCount) {
  const tags = openingTags(readSource(relativePath), "button")
  assert.equal(tags.length, expectedCount, relativePath)
  for (const tag of tags) {
    assert.match(tag, /data-slot="interactive-surface"/, `${relativePath}: ${tag}`)
  }
}

test("public discovery and search keep only registered native interaction surfaces", () => {
  assertMarkedNativeSurfaces("pages/DiscoverPage.tsx", 0)
  assertMarkedNativeSurfaces("pages/SearchPage.tsx", 3)
  assertMarkedNativeSurfaces("pages/CommunityPage.tsx", 2)
  assertMarkedNativeSurfaces("components/home/InfiniteGallery.tsx", 0)
  assertMarkedNativeSurfaces("components/discover/DiscoverPictureCard.tsx", 1)
})
```

- [ ] **Step 2: Run the public-surface test and verify RED**

Run:

```bash
cd frontend
node --test --test-name-pattern="public discovery" tests/button-system-source.test.mjs
```

Expected: FAIL because `DiscoverPage.tsx` still contains six native buttons.

- [ ] **Step 3: Convert Discover actions to Button**

In `frontend/src/pages/DiscoverPage.tsx`:

- Import `Button` from `@/components/ui/button`.
- Replace the four layout/filter controls with these semantic forms:

```tsx
<Button
  type="button"
  variant={active ? "secondary" : "ghost"}
  size="icon-sm"
  aria-label={option.title}
  aria-pressed={active}
  title={option.title}
  onClick={() => handleLayoutClick(option.key)}
>
  <Icon size={18} strokeWidth={2} aria-hidden="true" />
</Button>
```

```tsx
<Button
  type="button"
  variant="ghost"
  size="sm"
  aria-expanded={openMenu === "sort"}
  onClick={() => setOpenMenu((current) => (current === "sort" ? null : "sort"))}
>
  {activeSortLabel}
</Button>
```

Use the same `ghost`/`sm` form for photographer and category triggers. Replace both retry buttons with `variant="outline" size="sm"` and keep the existing `retry` callbacks and `RefreshCw` icon.

- [ ] **Step 4: Convert Search, Community, and InfiniteGallery actions**

Apply these exact mappings:

| File and current line | Change |
| --- | --- |
| `SearchPage.tsx:697` | `Button variant="ghost" size="icon" aria-label="清空搜索"`; keep absolute positioning only |
| `SearchPage.tsx:801` | `Button variant="ghost" size="xs"`; text remains “清除” |
| `CommunityPage.tsx:169` | `Button variant="ghost" size="xs"`; text remains “查看详情” |
| `InfiniteGallery.tsx:163` | `Button variant="outline"`; text remains “重试” |
| `InfiniteGallery.tsx:214` | `Button variant="ghost" size="sm"`; text remains “重试” |

For retained native surfaces, import `cn` when not already present plus `interactiveSurfaceClassName`, add `data-slot="interactive-surface"`, and use the current Community tab as the concrete pattern:

```tsx
<button
  key={tab.key}
  data-slot="interactive-surface"
  type="button"
  onClick={() => navigateTab(tab.key)}
  className={cn(
    interactiveSurfaceClassName,
    "inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium",
    active
      ? "border-foreground text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  )}
  aria-pressed={active}
>
  <Icon className="size-4" aria-hidden />
  {tab.label}
</button>
```

Register these retained surfaces:

- `SearchPage.tsx`: result tabs and two recent-search suggestion groups, three opening tags total.
- `CommunityPage.tsx`: community tabs and board choices, two opening tags total.
- `DiscoverPictureCard.tsx`: the full picture card, one opening tag.

Replace every `focus-visible:ring-blue-*` class on these surfaces with the shared neutral ring and keep their layout, selected border, and hover behavior.

- [ ] **Step 5: Run the public-surface test and verify GREEN**

Run:

```bash
cd frontend
node --test --test-name-pattern="public discovery" tests/button-system-source.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the public-page migration**

```bash
git add frontend/src/pages/DiscoverPage.tsx frontend/src/pages/SearchPage.tsx frontend/src/pages/CommunityPage.tsx frontend/src/components/home/InfiniteGallery.tsx frontend/src/components/discover/DiscoverPictureCard.tsx frontend/tests/button-system-source.test.mjs
git commit -m "refactor: unify discovery and search buttons"
```

## Task 3: Migrate navigation, authentication, and notification actions

**Files:**

- Modify: `frontend/tests/button-system-source.test.mjs`
- Modify: `frontend/src/components/Navbar.tsx:400-683`
- Modify: `frontend/src/components/auth/AuthDialog.tsx:148-653`
- Modify: `frontend/src/components/notifications/NotificationBell.tsx:105-190`
- Modify: `frontend/src/pages/NotificationsPage.tsx:92-153`

- [ ] **Step 1: Add the failing shell contract**

Append:

```js
test("shell and auth use shadcn actions and keep notification rows as surfaces", () => {
  assertMarkedNativeSurfaces("components/Navbar.tsx", 0)
  assertMarkedNativeSurfaces("components/auth/AuthDialog.tsx", 0)
  assertMarkedNativeSurfaces("components/notifications/NotificationBell.tsx", 1)
  assertMarkedNativeSurfaces("pages/NotificationsPage.tsx", 1)
})
```

- [ ] **Step 2: Run the shell test and verify RED**

Run:

```bash
cd frontend
node --test --test-name-pattern="shell and auth" tests/button-system-source.test.mjs
```

Expected: FAIL because `Navbar.tsx` still contains six native buttons.

- [ ] **Step 3: Normalize Navbar actions**

In `frontend/src/components/Navbar.tsx`, convert all six native controls and normalize the existing login/start/logout Buttons:

| Control | Required Button form |
| --- | --- |
| Desktop and mobile clear search | `variant="ghost" size="icon-sm"`, preserve absolute positioning, `aria-label="清空搜索"` |
| Account menu trigger | `variant="ghost" size="lg"`, preserve avatar/content layout only |
| Settings menu item | `variant="ghost" className="w-full justify-start" role="menuitem"` |
| Logout menu item | `variant="destructive" className="w-full justify-start" role="menuitem"` |
| Mobile menu toggle | `variant="ghost" size="icon"`, Chinese `aria-label` based on open state |
| Login | `variant="ghost"` |
| Start | `variant="default"` |
| Mobile logout | `variant="destructive" className="w-full"` |

Delete blue/indigo/slate button colors, custom `h-[42px]`, `h-10`, `rounded-xl`, horizontal padding, button shadows, translate and scale effects. Keep width, absolute positioning, content gap, and responsive visibility classes.

- [ ] **Step 4: Normalize AuthDialog and notification actions**

In `AuthDialog.tsx`:

- Convert password visibility to `Button variant="ghost" size="icon-sm"`.
- Convert “忘记密码”“点击注册”“点击登录” to `Button variant="link" size="xs"`.
- Keep login/register submit buttons as `default`, remove blue color, custom height, shadow and translate classes.
- Replace button-contained `LoaderCircle` with `<Spinner aria-label="加载中" />` and add `aria-busy={loading === "login"}` or `aria-busy={loading === "register"}`.

In `NotificationBell.tsx`:

- Convert the bell trigger to `Button variant="ghost" size="icon-lg"`.
- Convert “全部已读” to `Button variant="ghost" size="xs"`.
- Convert “查看全部通知” to `Button variant="ghost" className="w-full"`.
- Mark the notification row with `data-slot="interactive-surface"` and the shared class.

In `NotificationsPage.tsx`, keep the notification row as a marked interactive surface. Replace the load-more Button loader with Spinner and add `aria-busy={loading}`.

- [ ] **Step 5: Run the shell test and verify GREEN**

Run:

```bash
cd frontend
node --test --test-name-pattern="shell and auth" tests/button-system-source.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the shell migration**

```bash
git add frontend/src/components/Navbar.tsx frontend/src/components/auth/AuthDialog.tsx frontend/src/components/notifications/NotificationBell.tsx frontend/src/pages/NotificationsPage.tsx frontend/tests/button-system-source.test.mjs
git commit -m "refactor: unify shell and auth buttons"
```

## Task 4: Migrate account, posting, upload, and media actions

**Files:**

- Modify: `frontend/tests/button-system-source.test.mjs`
- Modify: `frontend/src/pages/AccountDetailPage.tsx:228-1322`
- Modify: `frontend/src/components/post/PostComposerDialog.tsx:50-360`
- Modify: `frontend/src/components/post/PostImageAttach.tsx:131-192`
- Modify: `frontend/src/components/post/PostCard.tsx:399-839`
- Modify: `frontend/src/components/post/PostVisibilityMenu.tsx:77-131`
- Modify: `frontend/src/components/upload/UploadDialog.tsx:347-565`
- Modify: `frontend/src/components/photo/PhotoStats.tsx:111-121`
- Modify: `frontend/src/components/photo/PhotoDetailDialog.tsx:402-545`
- Modify: `frontend/src/components/photo/PhotographerInfo.tsx:77-97`
- Modify: `frontend/src/components/photo/DownloadButton.tsx:61-76`
- Modify: `frontend/src/components/ImagePreviewModal.tsx:164-298`

- [ ] **Step 1: Add the failing content/media contract**

Append:

```js
test("account post upload and media actions use Button while semantic surfaces remain native", () => {
  assertMarkedNativeSurfaces("pages/AccountDetailPage.tsx", 2)
  assertMarkedNativeSurfaces("components/post/PostComposerDialog.tsx", 0)
  assertMarkedNativeSurfaces("components/post/PostImageAttach.tsx", 1)
  assertMarkedNativeSurfaces("components/post/PostCard.tsx", 0)
  assertMarkedNativeSurfaces("components/post/PostVisibilityMenu.tsx", 1)
  assertMarkedNativeSurfaces("components/upload/UploadDialog.tsx", 0)
  assertMarkedNativeSurfaces("components/photo/PhotoStats.tsx", 0)
  assertMarkedNativeSurfaces("components/photo/PhotoDetailDialog.tsx", 0)
  assertMarkedNativeSurfaces("components/ImagePreviewModal.tsx", 0)

  const upload = readSource("components/upload/UploadDialog.tsx")
  assert.match(
    upload,
    /data-slot="interactive-surface"\s+role="button"|role="button"\s+data-slot="interactive-surface"/
  )
})
```

- [ ] **Step 2: Run the content/media test and verify RED**

Run:

```bash
cd frontend
node --test --test-name-pattern="account post upload" tests/button-system-source.test.mjs
```

Expected: FAIL because `PostComposerDialog.tsx` still contains four native buttons.

- [ ] **Step 3: Migrate account and composer controls**

In `AccountDetailPage.tsx`:

- Mark the account search result and profile tab as two interactive surfaces.
- Convert clickable profile statistics to `Button variant="ghost" size="sm"` and preserve disabled behavior for “作品”.
- Convert preview edit to `Button variant="secondary"` and delete to `Button variant="destructive"`.
- Remove the custom rounded/padded class from the existing “有什么新鲜事?” Button.
- Replace Button-contained Loader2 instances with Spinner and add `aria-busy` to their owning Buttons.

In `PostComposerDialog.tsx`:

- Delete `toolButtonClass`.
- Convert post-type options to `Button size="sm" variant={active ? "secondary" : "ghost"}` with `aria-pressed={active}`.
- Convert image/topic/mention tools to `Button variant="ghost" size="icon"` with their current labels.
- Keep submit as `default`, remove custom height/rounded/padding, use Spinner, `disabled={!canSubmit}`, and `aria-busy={submitting}`.

- [ ] **Step 4: Migrate post and upload controls**

In `PostImageAttach.tsx`:

- Convert both remove-image controls to `Button variant="secondary" size="icon-xs"` with positioning only.
- Mark the add-image tile as one interactive surface.

In `PostCard.tsx`:

- Delete `footerActionClass` and `footerIconActionClass` visual systems.
- Use `variant={liked ? "secondary" : "ghost"}` for like.
- Use `variant={favorited ? "secondary" : "ghost"}` for favorite.
- Use `ghost` for comment/share/reply auxiliary actions.
- Use `destructive` for delete actions.
- Convert “举报” to `Button variant="ghost" size="xs"`.
- Replace Button-contained Loader2 instances with Spinner and apply `aria-busy` to each pending action.

In `PostVisibilityMenu.tsx`, mark the option row as an interactive surface. Normalize the trigger to `variant="ghost" size="default"` without custom height, radius or horizontal padding. Replace its button loading icon with Spinner.

In `UploadDialog.tsx`:

- Convert the preview remove button to `Button variant="secondary" size="icon-sm"`.
- Add `data-slot="interactive-surface"` and `interactiveSurfaceClassName` to the file dropzone `role="button"`.
- Replace `focus-visible:border-blue-500` and blue ring classes with the shared neutral states.
- Replace the submit Button loader with Spinner and add `aria-busy`.

- [ ] **Step 5: Migrate photo and preview controls**

Apply this mapping:

| File | Required change |
| --- | --- |
| `PhotoStats.tsx` | like control becomes `Button variant={isLiked ? "secondary" : "ghost"}`; preserve `aria-pressed` and pending disable |
| `PhotoDetailDialog.tsx` | close becomes `ghost` icon-sm; share becomes `outline`; more becomes `outline` icon; remove square custom colors |
| `PhotographerInfo.tsx` | use `default` when not following and `outline` when following; remove blue border/text and square geometry; use Spinner |
| `DownloadButton.tsx` | keep `default`; remove blue background override; use Spinner and `aria-busy={loading}` |
| `ImagePreviewModal.tsx` | add `className="dark"` to the overlay root; close/previous/next use `secondary` icon sizes; download uses `secondary`; like uses `outline`; remove white translucent custom button styles |

- [ ] **Step 6: Run the content/media test and verify GREEN**

Run:

```bash
cd frontend
node --test --test-name-pattern="account post upload" tests/button-system-source.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the content/media migration**

```bash
git add frontend/src/pages/AccountDetailPage.tsx frontend/src/components/post/PostComposerDialog.tsx frontend/src/components/post/PostImageAttach.tsx frontend/src/components/post/PostCard.tsx frontend/src/components/post/PostVisibilityMenu.tsx frontend/src/components/upload/UploadDialog.tsx frontend/src/components/photo/PhotoStats.tsx frontend/src/components/photo/PhotoDetailDialog.tsx frontend/src/components/photo/PhotographerInfo.tsx frontend/src/components/photo/DownloadButton.tsx frontend/src/components/ImagePreviewModal.tsx frontend/tests/button-system-source.test.mjs
git commit -m "refactor: unify account post and media buttons"
```

## Task 5: Migrate admin actions and register admin list surfaces

**Files:**

- Modify: `frontend/tests/button-system-source.test.mjs`
- Modify: `frontend/src/components/admin/AdminHomepagePanel.tsx:455-599`
- Modify: `frontend/src/components/admin/AdminDashboardPanel.tsx:105-284`
- Modify: `frontend/src/components/admin/AdminForumModerationPanel.tsx:155-289`
- Modify: `frontend/src/components/admin/AdminReportsPanel.tsx:279-554`
- Modify: `frontend/src/components/admin/AdminContentModerationPanel.tsx:201-427`
- Modify: `frontend/src/components/admin/AdminTagManagementPanel.tsx:382-397`
- Modify: `frontend/src/components/admin/AdminAuditPanel.tsx:220-311`
- Modify: `frontend/src/components/admin/MediaPickerDialog.tsx:252-456`
- Modify: `frontend/src/components/admin/AdminMediaReviewPanel.tsx:87-162`

- [ ] **Step 1: Add the failing admin contract**

Append:

```js
test("admin actions use Button and admin rows remain registered surfaces", () => {
  assertMarkedNativeSurfaces("components/admin/AdminHomepagePanel.tsx", 0)
  assertMarkedNativeSurfaces("components/admin/AdminDashboardPanel.tsx", 3)
  assertMarkedNativeSurfaces("components/admin/AdminForumModerationPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminReportsPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminContentModerationPanel.tsx", 3)
  assertMarkedNativeSurfaces("components/admin/AdminTagManagementPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminAuditPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/MediaPickerDialog.tsx", 1)
})
```

- [ ] **Step 2: Run the admin test and verify RED**

Run:

```bash
cd frontend
node --test --test-name-pattern="admin actions" tests/button-system-source.test.mjs
```

Expected: FAIL because `AdminHomepagePanel.tsx` still contains three native icon buttons.

- [ ] **Step 3: Convert admin action buttons**

Apply these mappings:

| File | Required action changes |
| --- | --- |
| `AdminHomepagePanel.tsx` | move-left/move-right become `secondary` icon-sm; remove becomes `destructive` icon-sm; use local `.dark` on the media overlay; replace Button loaders with Spinner |
| `AdminForumModerationPanel.tsx` | keep refresh/reload/load-more/action Buttons on ghost/outline semantics; replace button loaders with Spinner |
| `AdminReportsPanel.tsx` | keep query default, clear ghost, reload outline, pagination ghost, resolve default; replace loaders with Spinner |
| `AdminContentModerationPanel.tsx` | keep query default, clear ghost and pagination ghost; use outline for “恢复内容” and destructive for “隐藏内容”; replace loaders with Spinner |
| `AdminTagManagementPanel.tsx` | use outline for cancel and target search, default for save, destructive for merge; replace loaders with Spinner |
| `AdminAuditPanel.tsx` | keep query default, clear/pagination ghost, retry outline; replace loaders with Spinner |
| `MediaPickerDialog.tsx` | clear search becomes `ghost` icon-sm; normalize existing action Buttons and replace loaders with Spinner |
| `AdminMediaReviewPanel.tsx` | use outline for refresh, default for approve, destructive for reject; replace Button loaders with Spinner |

- [ ] **Step 4: Register admin interaction surfaces**

Add `data-slot="interactive-surface"` and `interactiveSurfaceClassName` to exactly these native surfaces:

- `AdminDashboardPanel.tsx`: two navigation summary rows and one audit-log row, three opening tags.
- `AdminForumModerationPanel.tsx`: forum-post list row, one opening tag.
- `AdminReportsPanel.tsx`: report list row, one opening tag.
- `AdminContentModerationPanel.tsx`: two view tabs and one content row, three opening tags.
- `AdminTagManagementPanel.tsx`: merge-target search result, one opening tag.
- `AdminAuditPanel.tsx`: audit-log list row, one opening tag.
- `MediaPickerDialog.tsx`: media asset selection card, one opening tag.

Keep their existing full-width layouts, selected backgrounds and semantic roles. Replace any blue or indigo focus ring with the shared neutral ring.

- [ ] **Step 5: Run the admin test and verify GREEN**

Run:

```bash
cd frontend
node --test --test-name-pattern="admin actions" tests/button-system-source.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the admin migration**

```bash
git add frontend/src/components/admin/AdminHomepagePanel.tsx frontend/src/components/admin/AdminDashboardPanel.tsx frontend/src/components/admin/AdminForumModerationPanel.tsx frontend/src/components/admin/AdminReportsPanel.tsx frontend/src/components/admin/AdminContentModerationPanel.tsx frontend/src/components/admin/AdminTagManagementPanel.tsx frontend/src/components/admin/AdminAuditPanel.tsx frontend/src/components/admin/MediaPickerDialog.tsx frontend/src/components/admin/AdminMediaReviewPanel.tsx frontend/tests/button-system-source.test.mjs
git commit -m "refactor: unify admin buttons"
```

## Task 6: Enforce the global button contract and delete retired CSS

**Files:**

- Modify: `frontend/tests/button-system-source.test.mjs`
- Modify: `frontend/src/index.css:274-300,599-610,730-748`
- Inspect: every `frontend/src/**/*.tsx` file containing `<Button`, `<button`, or `role="button"`

- [ ] **Step 1: Add the failing global contract**

Extend `frontend/tests/button-system-source.test.mjs` with filesystem walking and the final assertions:

```js
import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

const srcRoot = fileURLToPath(new URL("../src", import.meta.url))

function collectTsxFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) return collectTsxFiles(path)
    return entry.name.endsWith(".tsx") ? [path] : []
  })
}

function relativeSourcePath(path) {
  return path.slice(srcRoot.length + 1)
}

test("all business native buttons are registered interaction surfaces", () => {
  const files = collectTsxFiles(srcRoot).filter(
    (path) => relativeSourcePath(path) !== "components/ui/sidebar.tsx"
  )
  const nativeTags = files.flatMap((path) =>
    openingTags(readFileSync(path, "utf8"), "button").map((tag) => ({
      path: relativeSourcePath(path),
      tag,
    }))
  )

  assert.equal(nativeTags.length, 23)
  for (const item of nativeTags) {
    assert.match(item.tag, /data-slot="interactive-surface"/, `${item.path}: ${item.tag}`)
  }

  const upload = readSource("components/upload/UploadDialog.tsx")
  assert.match(upload, /data-slot="interactive-surface"[\s\S]{0,160}role="button"|role="button"[\s\S]{0,160}data-slot="interactive-surface"/)
})

test("business Button calls do not recreate page-specific visual systems", () => {
  const forbiddenVisualClass =
    /\b(?:h-\[[^\]]+\]|h-(?:6|7|8|9|10|11|12)|rounded(?:-[^\s"'`]+)?|px-[^\s"'`]+|bg-(?:blue|indigo|white|black|slate|red|rose|amber|green)-[^\s"'`]+|text-(?:white|blue|indigo|red|rose|amber|green)-[^\s"'`]+)\b/

  for (const path of collectTsxFiles(srcRoot)) {
    if (relativeSourcePath(path).startsWith("components/ui/")) continue
    for (const tag of openingTags(readFileSync(path, "utf8"), "Button")) {
      assert.doesNotMatch(tag, forbiddenVisualClass, `${relativeSourcePath(path)}: ${tag}`)
      if (/size="icon(?:-[^"]+)?"/.test(tag)) {
        assert.match(tag, /aria-label=/, `${relativeSourcePath(path)}: ${tag}`)
      }
    }
  }
})

test("retired page-specific button CSS is removed", () => {
  const css = readSource("index.css")
  assert.doesNotMatch(css, /discover-layout-switch__button/)
  assert.doesNotMatch(css, /discover-feedback__button/)
  assert.doesNotMatch(css, /discover-inline-error button/)
  assert.doesNotMatch(css, /search-clear-button/)
})
```

- [ ] **Step 2: Run the global contract and verify RED**

Run:

```bash
cd frontend
node --test --test-name-pattern="retired page-specific button CSS" tests/button-system-source.test.mjs
```

Expected: FAIL because `frontend/src/index.css` still contains `discover-layout-switch__button`.

- [ ] **Step 3: Remove obsolete button CSS**

Delete these rules from `frontend/src/index.css`:

- `.discover-layout-switch__button` and its hover/selected rule.
- `.discover-filter__target` and `.discover-category-picker` button visuals that are now owned by Button.
- `.discover-feedback__button` and `.discover-inline-error button`.
- `.search-clear-button` and `.search-clear-button:hover`.

Keep `.search-suggestion-button`, because recent-search suggestions remain native interaction surfaces. Keep parent layout rules such as `.discover-layout-switch`, `.discover-filter`, and `.search-group-tabs`.

- [ ] **Step 4: Run the complete button contract and fix every reported violation**

Run:

```bash
cd frontend
node --test tests/button-system-source.test.mjs
```

Expected: all button-system tests PASS. If the forbidden-class assertion reports a business Button, remove the visual class or replace it with the correct `variant`/`size`; do not weaken the regex for a known violation.

- [ ] **Step 5: Prove the final inventory**

Run:

```bash
cd frontend
rg -o --glob '*.tsx' '<Button\b' src | wc -l
rg -o --glob '*.tsx' '<button\b' src | wc -l
rg -n --glob '*.tsx' 'role="button"' src
```

Expected:

- shadcn Button count increases from the 134 baseline by the converted action controls.
- Native button count is 24 total, consisting of 23 marked business surfaces plus the generated SidebarRail.
- The only business `role="button"` is the marked UploadDialog dropzone.

- [ ] **Step 6: Commit the global contract and CSS cleanup**

```bash
git add frontend/src/index.css frontend/tests/button-system-source.test.mjs
git commit -m "test: enforce frontend button contracts"
```

## Task 7: Run full verification and visual QA

**Files:**

- Verify: `frontend/src/**/*`
- Verify: `frontend/tests/**/*`
- Update only if verification finds a real regression.

- [ ] **Step 1: Run the complete frontend test suite**

```bash
cd frontend
npm test
```

Expected: all Node tests PASS with zero failures.

- [ ] **Step 2: Run lint**

```bash
cd frontend
npm run lint
```

Expected: exit code 0 with no oxlint errors.

- [ ] **Step 3: Run the production build**

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite build complete successfully. Record any existing Vite chunk-size warning separately; do not treat a pre-existing warning as a Button regression.

- [ ] **Step 4: Check formatting and repository state**

```bash
git diff --check
git status --short
```

Expected: `git diff --check` prints nothing. `git status --short` contains only the intended button-system changes, or is clean after commits.

- [ ] **Step 5: Perform desktop visual QA**

Open the application at a 1440 by 900 viewport and inspect:

- `/`, `/discover`, `/search?q=test`, `/community`, `/notifications`, `/account`, `/upload`.
- Login/register dialog, post composer, upload dialog, photo detail, image preview.
- `/admin?tab=dashboard`, `homepage`, `media-review`, `content`, `forum`, `reports`, `tags`, and `audit`.

Confirm:

- Every section has one clear default primary action.
- Secondary, ghost, selected and destructive hierarchy is consistent.
- Icon buttons are square and aligned.
- Loading buttons retain size and disable repeated clicks.
- No blue/indigo legacy button system remains.
- Native rows/cards retain full-width click targets and neutral keyboard focus.

- [ ] **Step 6: Perform mobile visual QA**

Repeat the user-facing routes at a 390 by 844 viewport. Confirm Navbar, dialogs, composer tools, upload, image preview, full-width Buttons and horizontal tabs do not overflow or collapse.

- [ ] **Step 7: Request code review before completion**

Invoke the `requesting-code-review` skill against the final diff. Address actionable findings, then rerun `npm test`, `npm run lint`, `npm run build`, and `git diff --check` before claiming completion.
