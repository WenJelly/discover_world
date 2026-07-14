# Personal Profile Post List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the personal profile post timeline with a plain chronological card list without changing post behavior.

**Architecture:** Keep `PostTimeline` as the public rendering boundary used by `AccountDetailPage`, but remove its date-grouping and timeline-decoration implementation. Render each existing `PostCard` directly in one ordered list while preserving `data-post-id` and all callbacks.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, Vite 8

---

### Task 1: Simplify the profile post renderer

**Files:**
- Modify: `frontend/src/components/post/PostTimeline.tsx:1-150`

- [ ] **Step 1: Confirm the current timeline-specific implementation**

Run:

```bash
rg -n "parseServerTime|groupPostsByDay|Timeline rail|Date marker|Post node" frontend/src/components/post/PostTimeline.tsx
```

Expected: matches for the date grouping helper, vertical rail, date marker, and post node.

- [ ] **Step 2: Replace the timeline implementation with a plain list**

Use this complete component implementation:

```tsx
import type { ProfilePostResponse } from "@/lib/types";
import { PostCard } from "./PostCard";
import type { PostAuthor } from "./PostComposerDialog";

export type PostTimelineProps = {
  posts: ProfilePostResponse[];
  author?: PostAuthor | null;
  canManage?: boolean;
  onDeleted?: (id: string) => void;
  onUpdated?: (post: ProfilePostResponse) => void;
  onPinChanged?: (post: ProfilePostResponse) => void;
};

export function PostTimeline({
  posts,
  author,
  canManage = false,
  onDeleted,
  onUpdated,
  onPinChanged,
}: PostTimelineProps) {
  return (
    <ol className="space-y-3">
      {posts.map((post) => (
        <li key={post.id} data-post-id={post.id}>
          <PostCard
            post={post}
            author={author}
            canManage={canManage}
            onDeleted={onDeleted}
            onUpdated={onUpdated}
            onPinChanged={onPinChanged}
          />
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 3: Verify the source contract**

Run:

```bash
rg -n "parseServerTime|groupPostsByDay|Timeline rail|Date marker|Post node|今天|昨天|更早" frontend/src/components/post/PostTimeline.tsx
rg -n 'data-post-id=\{post.id\}|className="space-y-3"' frontend/src/components/post/PostTimeline.tsx
```

Expected: the first command returns no matches; the second command returns both the scroll anchor and list-spacing lines.

- [ ] **Step 4: Build the frontend**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript project build and Vite production build exit with code 0.

- [ ] **Step 5: Lint the frontend**

Run:

```bash
cd frontend && npm run lint
```

Expected: oxlint exits with code 0 and reports no errors.

- [ ] **Step 6: Inspect desktop and mobile profile layouts**

Start the existing Vite app, open a personal profile with dynamic posts, and inspect desktop and mobile widths. Confirm there is no left rail, node, date heading, or horizontal overflow; confirm card order and spacing remain intact.

- [ ] **Step 7: Review the scoped diff**

Run:

```bash
git diff -- frontend/src/components/post/PostTimeline.tsx docs/superpowers/plans/2026-07-14-profile-post-list.md
git status --short
```

Expected: implementation changes are limited to `PostTimeline.tsx`; pre-existing staged deletions and unrelated API changes remain untouched. Per user direction, no automated test is added.
