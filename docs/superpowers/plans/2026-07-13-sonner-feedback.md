# Sonner Global Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install shadcn Sonner and restore concise, business-specific global feedback beneath the centered navbar without recreating the removed custom Toast system.

**Architecture:** Use the generated `frontend/src/components/ui/sonner.tsx` once at the app root, imported as `Sonner`. Business files import Sonner's fixed export with `import { toast as sonner } from "sonner"` and call `sonner.success/error/warning/info` directly. Page-level load errors, field validation, and `UploadDialog`'s existing inline progress/result UI remain local and do not emit duplicate global messages.

**Tech Stack:** React 19, TypeScript, Vite, shadcn CLI, Sonner, Node test runner, oxlint.

---

## File map

- Create `frontend/src/components/ui/sonner.tsx`: shadcn-generated Sonner renderer.
- Create `frontend/tests/sonner-feedback-source.test.mjs`: installation, naming, placement, and message contracts.
- Modify `frontend/package.json` and `frontend/package-lock.json`: add `sonner` through the shadcn CLI.
- Modify `frontend/src/App.tsx`: mount `<Sonner />` at top-center below the navbar.
- Modify `frontend/src/context/AuthContext.tsx`: show the global session-expired message.
- Modify `frontend/src/components/auth/AuthDialog.tsx`: login/register and unavailable-auth feedback.
- Modify `frontend/src/components/Navbar.tsx`: logout, avatar upload, and profile-save feedback.
- Modify `frontend/src/components/photo/PhotoDetailDialog.tsx`: like rollback, copied link, and download errors.
- Modify `frontend/src/components/post/PostCard.tsx`: post interaction and moderation feedback.
- Modify `frontend/src/components/post/PostComposerDialog.tsx`: image limit and publish success feedback.
- Modify `frontend/src/components/post/PostImageAttach.tsx`: local image selection warnings.
- Modify `frontend/src/components/upload/ImageAttachButton.tsx`: inline upload validation/result feedback.
- Modify `frontend/src/pages/AccountDetailPage.tsx`: follow, delete, and featured-save feedback.
- Modify `frontend/src/pages/AdminPage.tsx`: homepage save, review, and moderation feedback.
- Modify `frontend/src/pages/CommunityPage.tsx`: discussion publish and forum moderation feedback only; page-load errors remain inline.
- Modify `frontend/src/pages/DiscoverPage.tsx`: login-required and follow-failure feedback only; media-detail load errors remain non-global.

### Task 1: Add failing Sonner source contracts

**Files:**
- Create: `frontend/tests/sonner-feedback-source.test.mjs`

- [ ] **Step 1: Write the failing source-contract test**

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shadcn Sonner is installed and mounted below the centered navbar", () => {
  const packageJson = JSON.parse(read("package.json"));
  const app = read("src/App.tsx");

  assert.equal(typeof packageJson.dependencies.sonner, "string");
  assert.equal(
    existsSync(new URL("../src/components/ui/sonner.tsx", import.meta.url)),
    true
  );
  assert.match(
    app,
    /import \{ Toaster as Sonner \} from "@\/components\/ui\/sonner"/
  );
  assert.match(app, /<Sonner[\s\S]*position="top-center"/);
  assert.match(
    app,
    /top:\s*"calc\(var\(--navbar-height, 4rem\) \+ 0\.75rem\)"/
  );
  assert.doesNotMatch(app, /ToastProvider|useToast/);
});

test("business files alias the Sonner API instead of restoring project Toast hooks", () => {
  for (const path of [
    "src/context/AuthContext.tsx",
    "src/components/auth/AuthDialog.tsx",
    "src/components/Navbar.tsx",
    "src/components/photo/PhotoDetailDialog.tsx",
    "src/components/post/PostCard.tsx",
    "src/components/post/PostComposerDialog.tsx",
    "src/components/post/PostImageAttach.tsx",
    "src/components/upload/ImageAttachButton.tsx",
    "src/pages/AccountDetailPage.tsx",
    "src/pages/AdminPage.tsx",
    "src/pages/CommunityPage.tsx",
    "src/pages/DiscoverPage.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /import \{ toast as sonner \} from "sonner"/);
    assert.doesNotMatch(source, /useToast|ToastProvider/);
  }

  assert.equal(
    existsSync(new URL("../src/hooks/use-toast.tsx", import.meta.url)),
    false
  );
  assert.equal(
    existsSync(new URL("../src/components/ui/toast.tsx", import.meta.url)),
    false
  );
});

test("Sonner messages use Discover World business copy", () => {
  const combined = [
    "src/context/AuthContext.tsx",
    "src/components/auth/AuthDialog.tsx",
    "src/components/Navbar.tsx",
    "src/components/post/PostCard.tsx",
    "src/components/post/PostComposerDialog.tsx",
    "src/pages/AccountDetailPage.tsx",
    "src/pages/AdminPage.tsx",
    "src/pages/CommunityPage.tsx",
  ]
    .map(read)
    .join("\n");

  for (const copy of [
    "登录成功",
    "注册成功",
    "登录已过期",
    "头像更新成功",
    "资料已保存",
    "动态已发布",
    "动态已删除",
    "评论已发布",
    "举报已提交",
    "图片已删除",
    "精选已更新",
    "Hero 配置已保存",
    "讨论已发布",
  ]) {
    assert.match(combined, new RegExp(copy));
  }
});

test("page-level loading errors are not duplicated through Sonner", () => {
  const community = read("src/pages/CommunityPage.tsx");
  const discover = read("src/pages/DiscoverPage.tsx");

  assert.doesNotMatch(community, /sonner\.error\("动态加载失败"/);
  assert.doesNotMatch(community, /sonner\.error\("论坛加载失败"/);
  assert.doesNotMatch(discover, /sonner\.error\("作品详情加载失败"/);
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run from `frontend/`:

```bash
node --experimental-strip-types --test tests/sonner-feedback-source.test.mjs
```

Expected: FAIL because `dependencies.sonner` and `src/components/ui/sonner.tsx` do not exist yet.

- [ ] **Step 3: Commit the red test only**

```bash
git add frontend/tests/sonner-feedback-source.test.mjs
git commit -m "test: define Sonner feedback contracts"
```

### Task 2: Install and mount shadcn Sonner

**Files:**
- Create: `frontend/src/components/ui/sonner.tsx`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/sonner-feedback-source.test.mjs`

- [ ] **Step 1: Install through the requested shadcn CLI command**

Run from `frontend/`:

```bash
npm dlx shadcn@latest add sonner
```

Expected: shadcn creates `src/components/ui/sonner.tsx` and adds `sonner` to the npm dependency files. Do not overwrite unrelated customized UI primitives if the CLI unexpectedly prompts for them.

- [ ] **Step 2: Mount the generated component with Sonner naming and responsive placement**

Replace `frontend/src/App.tsx` with:

```tsx
import { AppLayout } from "@/app/AppLayout"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { AuthProvider } from "@/context/AuthContext"

const sonnerTopOffset = "calc(var(--navbar-height, 4rem) + 0.75rem)"

function App() {
  return (
    <AuthProvider>
      <AppLayout />
      <Sonner
        position="top-center"
        offset={{ top: sonnerTopOffset }}
        mobileOffset={{ top: sonnerTopOffset, left: "1rem", right: "1rem" }}
        richColors
        closeButton
        duration={3600}
      />
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 3: Run the global placement test**

```bash
node --experimental-strip-types --test tests/sonner-feedback-source.test.mjs
```

Expected: the installation/placement test passes; alias/message tests still fail because business files are not migrated yet.

- [ ] **Step 4: Commit the Sonner installation and root mount**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/ui/sonner.tsx frontend/src/App.tsx
git commit -m "feat: install and mount Sonner"
```

### Task 3: Add authentication and navbar feedback

**Files:**
- Modify: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/components/auth/AuthDialog.tsx`
- Modify: `frontend/src/components/Navbar.tsx`
- Test: `frontend/tests/sonner-feedback-source.test.mjs`

- [ ] **Step 1: Add the shared import alias in all three files**

```ts
import { toast as sonner } from "sonner"
```

`AuthDialog.tsx` and `Navbar.tsx` should also restore their local readable-error helpers using `ApiError`:

```ts
function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}
```

- [ ] **Step 2: Implement authentication feedback**

Use these exact results in `AuthDialog.tsx`:

```ts
sonner.success("登录成功", { description: "已为你同步账号状态。" })
sonner.error("登录失败", {
  description: getErrorMessage(error, "请检查邮箱和密码后重试。"),
})
sonner.success("注册成功", {
  description: "账号已创建，请使用邮箱和密码登录。",
})
sonner.error("注册失败", {
  description: getErrorMessage(error, "注册暂时不可用，请稍后重试。"),
})
sonner.info(`${provider} 登录暂未配置`, {
  description: "请先使用邮箱和密码完成登录。",
})
sonner.info("忘记密码暂未开放", {
  description: "请先联系站点管理员重置账号。",
})
```

Change `handleProviderLogin` back to accepting `provider: "GitHub" | "Google"`, pass the provider from each button, and replace the forgot-password no-op with the info message.

- [ ] **Step 3: Implement session and navbar feedback**

In `AuthContext.tsx`, consume `AuthExpiredEventDetail` and emit:

```ts
function handleAuthExpired(event: Event) {
  clearAuthState()
  const detail = (event as CustomEvent<AuthExpiredEventDetail>).detail
  sonner.error("登录已过期", {
    description: detail?.message ?? "请重新登录后继续操作。",
  })
}
```

In `Navbar.tsx`, emit:

```ts
sonner.success("已退出登录")
sonner.warning("请选择图片文件", { description: "头像必须是图片格式。" })
sonner.success("头像更新成功", { description: "新的头像已同步到账户资料。" })
sonner.error("头像上传失败", {
  description: getErrorMessage(error, "图片上传失败，请稍后重试。"),
})
sonner.success("资料已保存", { description: "个人信息已更新。" })
sonner.error("保存失败", {
  description: getErrorMessage(error, "个人信息保存失败，请稍后重试。"),
})
```

- [ ] **Step 4: Run focused contracts**

```bash
node --experimental-strip-types --test tests/sonner-feedback-source.test.mjs tests/auth-dialog-source.test.mjs
```

Expected: auth/navbar message assertions pass; remaining file-alias assertions fail until Tasks 4 and 5.

- [ ] **Step 5: Commit authentication feedback**

```bash
git add frontend/src/context/AuthContext.tsx frontend/src/components/auth/AuthDialog.tsx frontend/src/components/Navbar.tsx
git commit -m "feat: add Sonner auth feedback"
```

### Task 4: Add media and post interaction feedback

**Files:**
- Modify: `frontend/src/components/photo/PhotoDetailDialog.tsx`
- Modify: `frontend/src/components/post/PostCard.tsx`
- Modify: `frontend/src/components/post/PostComposerDialog.tsx`
- Modify: `frontend/src/components/post/PostImageAttach.tsx`
- Modify: `frontend/src/components/upload/ImageAttachButton.tsx`
- Test: `frontend/tests/sonner-feedback-source.test.mjs`

- [ ] **Step 1: Import the Sonner alias in all five files**

```ts
import { toast as sonner } from "sonner"
```

- [ ] **Step 2: Add media detail and image-selection messages**

`PhotoDetailDialog.tsx`:

```ts
sonner.error("点赞失败", {
  description: error instanceof Error ? error.message : "请稍后重试。",
})
sonner.success("链接已复制")
sonner.error("下载失败", {
  description: error instanceof Error ? error.message : "请稍后重试。",
})
```

`PostImageAttach.tsx`:

```ts
sonner.warning("图片已达上限", {
  description: `一条动态最多 ${POST_MAX_IMAGES} 张图片。`,
})
sonner.warning("已达到图片上限", {
  description: `本次只添加前 ${remaining} 张，一条动态最多 ${POST_MAX_IMAGES} 张图片。`,
})
sonner.warning("请选择图片文件", {
  description: `${file.name} 不是支持的图片格式。`,
})
sonner.warning("图片过大", {
  description: `${file.name} 超过 20MB，已跳过。`,
})
```

`ImageAttachButton.tsx`:

```ts
sonner.warning("请选择图片文件", { description: "仅支持图片格式。" })
sonner.warning("图片过大", { description: "单张图片不能超过 20MB。" })
sonner.success("图片已添加", {
  description: asset.title ? `「${asset.title}」已上传。` : "图片已上传。",
})
sonner.error("上传失败", {
  description: error instanceof Error ? error.message : "请稍后重试。",
})
```

- [ ] **Step 3: Add post lifecycle messages**

`PostComposerDialog.tsx` uses a warning when the image tool is already at the limit and a success after `createPost`. Keep the existing inline `setError(...)` on failure so the composer does not duplicate the same failure globally.

```ts
sonner.warning("图片已达上限", {
  description: `一条动态最多 ${POST_MAX_IMAGES} 张图片。`,
})
sonner.success("动态已发布", {
  description:
    visibility === "public" ? "所有人都可以看到这条动态。" : "这条动态仅自己可见。",
})
```

`PostCard.tsx` uses silent success for like/favorite, error on rollback, and explicit results for write operations:

```ts
sonner.error("点赞失败", { description: getPostError(error) })
sonner.error("收藏失败", { description: getPostError(error) })
sonner.success("可见范围已更新", {
  description: nextVisibility === "private" ? "这条动态现在仅自己可见。" : "这条动态现在公开展示。",
})
sonner.error("可见范围修改失败", { description: getPostError(error) })
sonner.success("动态已删除")
sonner.error("删除失败", { description: getPostError(error) })
sonner.error("评论加载失败", { description: getPostError(error) })
sonner.success("评论已发布")
sonner.error("评论发布失败", { description: getPostError(error) })
sonner.success("举报已提交", { description: "我们会尽快审核相关内容。" })
sonner.error("举报失败", { description: getPostError(error) })
sonner.success(updated.isPinned ? "动态已置顶" : "已取消置顶")
sonner.error(pinned ? "取消置顶失败" : "置顶失败", {
  description: getPostError(error),
})
```

Define the local helper once:

```ts
function getPostError(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "请稍后重试。"
}
```

- [ ] **Step 4: Run post/media tests**

```bash
node --experimental-strip-types --test tests/sonner-feedback-source.test.mjs tests/post-visibility-update-source.test.mjs tests/post-image-attach-source.test.mjs tests/media-detail-interactions.test.mjs
```

Expected: media/post behavior remains green; only Task 5 alias/message assertions may remain red.

- [ ] **Step 5: Commit media and post feedback**

```bash
git add frontend/src/components/photo/PhotoDetailDialog.tsx frontend/src/components/post/PostCard.tsx frontend/src/components/post/PostComposerDialog.tsx frontend/src/components/post/PostImageAttach.tsx frontend/src/components/upload/ImageAttachButton.tsx
git commit -m "feat: add Sonner content feedback"
```

### Task 5: Add profile, admin, community, and Discover feedback

**Files:**
- Modify: `frontend/src/pages/AccountDetailPage.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/src/pages/CommunityPage.tsx`
- Modify: `frontend/src/pages/DiscoverPage.tsx`
- Test: `frontend/tests/sonner-feedback-source.test.mjs`

- [ ] **Step 1: Import the Sonner alias in all four files**

```ts
import { toast as sonner } from "sonner"
```

- [ ] **Step 2: Add profile action results without touching page-load states**

Use the existing `errorMessage` helper in `AccountDetailPage.tsx`:

```ts
sonner.error(nextFollowing ? "关注失败" : "取消关注失败", {
  description: errorMessage(error, "请稍后重试。"),
})
sonner.success("图片已删除")
sonner.error("删除失败", {
  description: errorMessage(error, "请稍后重试。"),
})
sonner.success("精选已更新", {
  description: `个人主页已展示 ${assets.length} 张精选作品。`,
})
sonner.error("精选保存失败", {
  description: errorMessage(error, "请稍后重试。"),
})
```

The force-delete conflict continues opening the existing confirmation Dialog and must not emit an error until the final delete attempt actually fails.

- [ ] **Step 3: Add admin operation results without duplicating admin load errors**

Use the existing `getErrorMessage` helper in `AdminPage.tsx`:

```ts
sonner.success("Hero 配置已保存", {
  description: heroDraft.asset ? "首页主视觉已更新。" : "首页主视觉已清空。",
})
sonner.error("Hero 配置保存失败", { description: getErrorMessage(error, "请稍后重试。") })
sonner.success("精选作品流已保存", { description: `首页精选已更新，共 ${next.featured.length} 张作品。` })
sonner.error("精选作品流保存失败", { description: getErrorMessage(error, "请稍后重试。") })
sonner.success(auditStatus === "approved" ? "作品已通过" : "作品已拒绝")
sonner.error("审核操作失败", { description: getErrorMessage(error, "请稍后重试。") })
sonner.success(action === "hide" ? "动态已隐藏" : "动态已恢复")
sonner.error("动态治理失败", { description: getErrorMessage(error, "请稍后重试。") })
sonner.success("帖子治理操作已完成")
sonner.error("帖子治理失败", { description: getErrorMessage(error, "请稍后重试。") })
```

- [ ] **Step 4: Add community and Discover action feedback only**

`CommunityPage.tsx`:

```ts
sonner.success("讨论已发布", { description: "内容已发布到所选论坛分区。" })
sonner.error("发布失败", {
  description: error instanceof Error ? error.message : "请稍后重试。",
})
sonner.success("论坛治理操作已完成")
sonner.error("论坛治理失败", {
  description: error instanceof Error ? error.message : "请稍后重试。",
})
```

`DiscoverPage.tsx`:

```ts
sonner.info("请先登录", { description: "登录后可以关注创作者。" })
sonner.error(nextFollowing ? "关注失败" : "取消关注失败", {
  description: error instanceof Error ? error.message : "请稍后重试。",
})
```

Do not add Sonner calls to `fetchMediaAssetDetail`, feed loaders, forum loaders, or other page-level fetch effects.

- [ ] **Step 5: Run the complete Sonner contract and related tests**

```bash
node --experimental-strip-types --test tests/sonner-feedback-source.test.mjs tests/account-follow-contract.test.mjs tests/media-delete-source.test.mjs tests/homepage-featured-admin.test.mjs tests/community-phase3-routing.test.mjs tests/discover-route-ui.test.ts
```

Expected: all listed tests PASS and `sonner-feedback-source.test.mjs` reports no missing alias/message contract.

- [ ] **Step 6: Commit page-level operation feedback**

```bash
git add frontend/src/pages/AccountDetailPage.tsx frontend/src/pages/AdminPage.tsx frontend/src/pages/CommunityPage.tsx frontend/src/pages/DiscoverPage.tsx
git commit -m "feat: add Sonner workflow feedback"
```

### Task 6: Verify the complete migration

**Files:**
- Verify all files modified in Tasks 1-5.

- [ ] **Step 1: Check for old custom Toast residue and unintended page-load messages**

```bash
rg -n "useToast|ToastProvider|@/hooks/use-toast|@/components/ui/toast" src tests
rg -n 'sonner\.error\("(动态加载失败|论坛加载失败|作品详情加载失败)' src
```

Expected: both commands return no matches. `toast` may appear only in `import { toast as sonner } from "sonner"` and within the generated shadcn component's third-party types/classes.

- [ ] **Step 2: Run the full frontend suite**

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, oxlint exits 0, and Vite build exits 0. The existing large-chunk warning is non-fatal if it still appears.

- [ ] **Step 3: Verify formatting and scoped changes**

Run from the repository root:

```bash
git diff --check
git status --short
git diff -- frontend/package.json frontend/package-lock.json frontend/src/App.tsx frontend/src/components/ui/sonner.tsx frontend/src/context/AuthContext.tsx frontend/src/components/auth/AuthDialog.tsx frontend/src/components/Navbar.tsx frontend/src/components/photo/PhotoDetailDialog.tsx frontend/src/components/post/PostCard.tsx frontend/src/components/post/PostComposerDialog.tsx frontend/src/components/post/PostImageAttach.tsx frontend/src/components/upload/ImageAttachButton.tsx frontend/src/pages/AccountDetailPage.tsx frontend/src/pages/AdminPage.tsx frontend/src/pages/CommunityPage.tsx frontend/src/pages/DiscoverPage.tsx frontend/tests/sonner-feedback-source.test.mjs
```

Expected: `git diff --check` exits 0. The status may still show the user's pre-existing unrelated changes; do not revert or include them.

- [ ] **Step 4: Commit any verification-only test adjustment if needed**

```bash
git add frontend/tests/sonner-feedback-source.test.mjs
git commit -m "test: finalize Sonner feedback coverage"
```

Skip this commit when Task 6 requires no test-file adjustment.
