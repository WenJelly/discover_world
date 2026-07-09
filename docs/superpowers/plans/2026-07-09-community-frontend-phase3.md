# Community Frontend Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the community backend to the React frontend with a dedicated community surface, following feeds, forum browsing/creation, and a lightweight notification entry.

**Architecture:** Keep the existing `/discover` photo feed intact. Add `/community` as the social/community surface, backed by new API wrappers in `frontend/src/lib/api.ts` and shared post/media response normalization. Keep notifications in the navbar as a compact popover rather than a full page.

**Tech Stack:** React 19, TypeScript, Vite, lucide-react, existing shadcn-style local UI primitives, go-zero backend APIs.

---

### Task 1: API Contract And Types

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/tests/community-phase3-api.test.mjs`

- [ ] Add source tests that require request/response types for public posts, forum boards/posts, notifications, and following feeds.
- [ ] Add API wrappers:
  - `fetchPublicPostCursorList`
  - `fetchForumBoardList`
  - `fetchForumPostCursorList`
  - `createForumPost`
  - `fetchNotificationCursorList`
  - `fetchUnreadNotificationCount`
  - `markNotificationRead`
  - `markAllNotificationsRead`
  - `fetchFollowingPostCursorList`
  - `fetchFollowingMediaCursorList`
- [ ] Normalize public post pages by mapping images through `normalizeMediaAsset` and author through `normalizeAccountSummary`.
- [ ] Run: `node --experimental-strip-types --test tests/community-phase3-api.test.mjs`

### Task 2: Community Route And Page

**Files:**
- Create: `frontend/src/pages/CommunityPage.tsx`
- Modify: `frontend/src/app/AppLayout.tsx`
- Modify: `frontend/src/components/Navbar.tsx`
- Test: `frontend/tests/community-phase3-routing.test.mjs`

- [ ] Add `/community` routing in `AppLayout`.
- [ ] Add a single navbar entry named `社区` linking to `/community`.
- [ ] Build CommunityPage tabs: `动态广场`, `关注动态`, `关注作品`, `论坛`.
- [ ] Use public post API for `动态广场`, following post API for `关注动态`, following media API for `关注作品`, and forum APIs for `论坛`.
- [ ] Keep unauthenticated following tabs as login-required empty states instead of firing authenticated requests.
- [ ] Run: `node --experimental-strip-types --test tests/community-phase3-routing.test.mjs`

### Task 3: Forum Creation

**Files:**
- Modify: `frontend/src/pages/CommunityPage.tsx`
- Test: `frontend/tests/community-phase3-routing.test.mjs`

- [ ] Add an authenticated forum composer with board select, title input, and body textarea.
- [ ] Submit through `createForumPost`.
- [ ] On success, prepend the returned forum post into the current forum list and reset the form.
- [ ] On failure, show existing toast error handling.

### Task 4: Notification Navbar Entry

**Files:**
- Create: `frontend/src/components/notifications/NotificationBell.tsx`
- Modify: `frontend/src/components/Navbar.tsx`
- Test: `frontend/tests/notification-bell-source.test.mjs`

- [ ] Add `NotificationBell` visible only when authenticated.
- [ ] Load unread count on mount and after opening the popover.
- [ ] Load notification list on open.
- [ ] Mark one notification read when clicked.
- [ ] Provide a `全部已读` action.
- [ ] Keep the popover keyboard-accessible and visually restrained.

### Task 5: Verification

**Files:**
- No production changes.

- [ ] Run focused frontend tests:
  - `node --experimental-strip-types --test tests/community-phase3-api.test.mjs`
  - `node --experimental-strip-types --test tests/community-phase3-routing.test.mjs`
  - `node --experimental-strip-types --test tests/notification-bell-source.test.mjs`
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run backend smoke verification: `go test ./...` and `go build ./...`.
