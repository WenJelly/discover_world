# 个人主页精选管理入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在个人主页精选 Tab 增加「管理精选」入口，通过扩展后的 MediaPickerDialog 从本人已发布作品中勾选/取消勾选精选，一次性全量保存。

**Architecture:** 后端与 `api.ts` 封装（`updateProfileFeaturedMedia`）已就绪，纯前端 UI 工作。扩展 `MediaPickerDialog` 支持按 `ownerUserId` 过滤与 `initialSelected` 预选（管理模式），`AccountDetailPage` 精选 Tab 增加入口按钮并把精选状态从 `ImageItem[]` 改为持有原始 `MediaAssetResponse[]`（弹窗预选需要原始对象）。

**Tech Stack:** React 19 + TypeScript + Tailwind v4 + base-ui Dialog；测试为 `node --test` 源码正则断言（`npm test`）。

**与 spec 的两处偏差（已确认必要）：**
1. spec 说"用 update 返回值直接刷新精选"——但 `UpdateProfileFeaturedMediaReq` 不支持 `variantOption`，返回 URL 非压缩图。改为保存成功后 `await loadFeatured()` 重新拉取（compressType=2）。
2. `FEATURED_PAGE_SIZE` 从 12 改为 20（后端上限 `maxProfileFeaturedMediaCount = 20`）。否则用户已有 13+ 张精选时，弹窗预选不全，保存会静默丢弃第 13–20 张。

**背景事实（实现者无需再查证）：**
- `/api/media/list/cursor` 传 `ownerUserId` 时后端强制 `visibility='public' + status='active' + audit_status='approved'`（`internal/logic/media/query.go` `buildPublicMediaAssetListWhere`），与精选更新接口"必须是本人已发布图片"的校验口径一致，前端无需传额外过滤参数。
- `MediaAssetCursorListReq`（`frontend/src/lib/types.ts:390`）已含 `ownerUserId?: string`。
- `ToastProvider` 已挂在 `App.tsx` 根部，`AccountDetailPage` 可直接 `useToast()`。
- `isFeatured` 全前端只有两处：`account-profile.ts:96`（假数据产出）和 `types.ts:464`（类型字段），无任何消费方，可安全删除。
- `toImageItem` 只有 `AccountDetailPage.tsx` 一个调用方（`.map(toImageItem)` 两处）+ 测试文件。

**工作目录：** `D:\Development Tools\Project\Go-Projects\discover_world\frontend`（npm 命令在此执行；git 命令仓库根目录亦可）。

---

### Task 1: 移除 toImageItem 的假 isFeatured

**Files:**
- Modify: `frontend/tests/account-profile.test.ts:68-81`
- Modify: `frontend/src/lib/account-profile.ts:62,96`
- Modify: `frontend/src/lib/types.ts:464`

- [ ] **Step 1: 先改测试（TDD）**

`frontend/tests/account-profile.test.ts` 中，把

```ts
  const image = toImageItem(picture, 0);
```

改为

```ts
  const image = toImageItem(picture);
```

把

```ts
  assert.equal(image.isFeatured, true);
```

改为

```ts
  assert.equal("isFeatured" in image, false);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL —— `toImageItem maps backend media URLs...` 用例中 `"isFeatured" in image` 为 `true`，断言失败。

- [ ] **Step 3: 修改实现**

`frontend/src/lib/account-profile.ts`：函数签名去掉 `index` 参数：

```ts
export function toImageItem(picture: PictureResponse): ImageItem {
```

并整行删除：

```ts
    isFeatured: index < 8,
```

`frontend/src/lib/types.ts` 的 `ImageItem` 接口中整行删除：

```ts
  isFeatured?: boolean;
```

（`AccountDetailPage.tsx` 的 `.map(toImageItem)` 调用无需改动——TS 允许回调参数少于 map 提供的参数。）

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS（全部用例）

- [ ] **Step 5: Commit**

```bash
git add frontend/tests/account-profile.test.ts frontend/src/lib/account-profile.ts frontend/src/lib/types.ts
git commit -m "refactor: 移除 toImageItem 按索引伪造的 isFeatured 假数据"
```

---

### Task 2: MediaPickerDialog 支持 ownerUserId 过滤与管理模式预选

**Files:**
- Create: `frontend/tests/profile-featured-picker.test.mjs`
- Modify: `frontend/src/components/admin/MediaPickerDialog.tsx`

- [ ] **Step 1: 写失败测试**

创建 `frontend/tests/profile-featured-picker.test.mjs`：

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("media picker supports owner filter and managed pre-selection", async () => {
  const source = await readFile(
    new URL("../src/components/admin/MediaPickerDialog.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /ownerUserId\?: string/);
  assert.match(source, /initialSelected\?: MediaAssetResponse\[\]/);
  assert.match(source, /ownerUserId,\s*\n\s*variantOption/);
  assert.match(source, /initialSelectedRef/);
  assert.match(source, /selected\.size === 0 && !isManaged/);
  assert.match(source, /result === false/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL —— 新文件中 6 个 `assert.match` 全部不匹配。

- [ ] **Step 3: 扩展 MediaPickerDialog**

对 `frontend/src/components/admin/MediaPickerDialog.tsx` 做以下 7 处修改：

**(a) Props 类型**（`MediaPickerDialogProps`，现 L29-44）新增两个可选 prop，并放宽 `onConfirm` 返回类型：

```ts
type MediaPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MediaPickerMode;
  title: string;
  description: string;
  /**
   * Asset ids that are already part of the caller's selection. They render as
   * "已选" and cannot be picked again; removal happens in the caller's list.
   */
  excludedIds?: string[];
  /** How many more works may still be picked (multiple mode). */
  maxCount?: number;
  /** Limit the list to one owner's published works (e.g. profile featured). */
  ownerUserId?: string;
  /**
   * Managed mode: assets pre-selected when the dialog opens. Unchecking them
   * removes; confirming an empty selection clears the whole collection.
   */
  initialSelected?: MediaAssetResponse[];
  confirmLabel?: string;
  /** Return false or reject to keep the dialog open (e.g. save failed). */
  onConfirm: (
    assets: MediaAssetResponse[]
  ) => void | boolean | Promise<void | boolean>;
};
```

**(b) 解构参数**（现 L57-67）加上 `ownerUserId` 与 `initialSelected`：

```ts
export function MediaPickerDialog({
  open,
  onOpenChange,
  mode,
  title,
  description,
  excludedIds = [],
  maxCount,
  ownerUserId,
  initialSelected,
  confirmLabel = "确认选择",
  onConfirm,
}: MediaPickerDialogProps) {
```

**(c) 组件内新增状态与 ref**（紧跟现有 `requestVersionRef` 声明之后，现 L80）：

```ts
  const [confirming, setConfirming] = useState(false);
  const isManaged = initialSelected != null;
  // Read via ref in the open-effect so a parent re-render (new array identity)
  // never resets an in-progress selection.
  const initialSelectedRef = useRef(initialSelected);
  initialSelectedRef.current = initialSelected;
```

**(d) `loadPage`**（现 L86-129）：请求体加 `ownerUserId`，依赖数组由 `[]` 改为 `[ownerUserId]`：

```ts
      const page = await fetchMediaAssetCursorList({
        pageSize: PAGE_SIZE,
        cursor: cursorRef.current ?? undefined,
        searchText: keyword || undefined,
        ownerUserId,
        variantOption: { compressType: 2 },
      });
```

```ts
  }, [ownerUserId]);
```

**(e) 打开时的重置 effect**（现 L133-139）：预选替代清空：

```ts
  useEffect(() => {
    if (!open) return;
    setSearchInput("");
    setSearchText("");
    setSelected(
      new Map(
        (initialSelectedRef.current ?? []).map((asset) => [asset.id, asset])
      )
    );
    loadPage(true, "");
  }, [open, loadPage]);
```

**(f) `handleConfirm`**（现 L177-180）改为异步、失败保持弹窗：

```ts
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const result = await onConfirm(Array.from(selected.values()));
      if (result === false) return;
      onOpenChange(false);
    } catch {
      // Caller already surfaced the error; keep the dialog open for retry.
    } finally {
      setConfirming(false);
    }
  };
```

**(g) 底部栏**（现 L391-420）：管理模式文案 + 按钮状态：

```tsx
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <p
            className="text-sm text-slate-500 dark:text-slate-400"
            aria-live="polite"
          >
            {mode === "multiple"
              ? isManaged
                ? maxCount != null
                  ? `已选 ${selected.size} / ${maxCount} 张`
                  : `已选 ${selected.size} 张`
                : maxCount != null
                  ? `本次新增 ${selected.size} 张（还可添加 ${Math.max(0, maxCount - selected.size)} 张）`
                  : `本次新增 ${selected.size} 张`
              : selected.size > 0
                ? "已选 1 张作品"
                : "尚未选择作品"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={confirming}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={confirming || (selected.size === 0 && !isManaged)}
              onClick={handleConfirm}
            >
              {confirming ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {confirmLabel}
            </Button>
          </div>
        </div>
```

说明：管理模式下允许 0 选提交（= 清空精选），所以确认按钮的禁用条件是 `selected.size === 0 && !isManaged`。新增/取消勾选沿用现有 `toggleAsset`，`Map` 的插入顺序天然满足"原有精选在前、新增追加在后"。

- [ ] **Step 4: 运行测试确认新用例通过**

Run: `npm test`
Expected: PASS —— `media picker supports owner filter and managed pre-selection` 及全部既有用例。

- [ ] **Step 5: 类型与 lint 检查**

Run: `npx tsc -b && npm run lint`
Expected: 无错误（管理员 `AdminPage.tsx` 的既有用法不传新 prop，向后兼容）。

- [ ] **Step 6: Commit**

```bash
git add frontend/tests/profile-featured-picker.test.mjs frontend/src/components/admin/MediaPickerDialog.tsx
git commit -m "feat: MediaPickerDialog 支持按作者过滤与管理模式预选"
```

---

### Task 3: AccountDetailPage 精选 Tab 接入管理入口

**Files:**
- Modify: `frontend/tests/profile-featured-picker.test.mjs`（追加用例）
- Modify: `frontend/src/pages/AccountDetailPage.tsx`

- [ ] **Step 1: 追加失败测试**

在 `frontend/tests/profile-featured-picker.test.mjs` 末尾追加：

```js
test("account featured tab exposes management entry for owner", async () => {
  const source = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /MAX_FEATURED_COUNT = 20/);
  assert.match(source, /管理精选/);
  assert.match(source, /去挑选作品/);
  assert.match(source, /updateProfileFeaturedMedia/);
  assert.match(source, /initialSelected=\{featuredAssets\}/);
  assert.match(source, /maxCount=\{MAX_FEATURED_COUNT\}/);
  assert.match(source, /ownerUserId=\{user\?\.id\}/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL —— 新用例 7 个断言全部不匹配。

- [ ] **Step 3: 修改 AccountDetailPage**

对 `frontend/src/pages/AccountDetailPage.tsx` 做以下 9 处修改：

**(a) imports**：
- lucide 导入列表（L8-24）加 `Settings2`（按字母序插在 `RefreshCw` 与 `Sparkles` 之间）。
- `@/lib/api` 导入（L26-34）加 `updateProfileFeaturedMedia`。
- React 导入（L1-7）加 `type ReactNode`。
- 新增两行导入（放在 `PostComposerDialog` 导入之后）：

```ts
import { MediaPickerDialog } from "@/components/admin/MediaPickerDialog";
import { useToast } from "@/hooks/use-toast";
```

- `@/lib/types` 的类型导入（L55-60）加 `MediaAssetResponse`。

**(b) 常量**（L74）：`FEATURED_PAGE_SIZE` 替换为：

```ts
const MAX_FEATURED_COUNT = 20;
```

**(c) EmptyState 支持 action**（L89-103）整体替换为：

```tsx
function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ImageIcon className="size-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
```

**(d) 精选 state**（L136-139）改为持有原始资产 + 派生 ImageItem + 弹窗开关：

```ts
  // Featured state (raw assets kept so the picker can pre-select them)
  const [featuredAssets, setFeaturedAssets] = useState<MediaAssetResponse[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [showFeaturedPicker, setShowFeaturedPicker] = useState(false);
```

并在 `isOwnProfile` 声明（L155）之后加：

```ts
  const featuredImages = useMemo(
    () => featuredAssets.map(toImageItem),
    [featuredAssets]
  );
  const { toast } = useToast();
```

**(e) `loadFeatured`**（L231-253）：`setFeaturedImages(...)` 两处改为 `setFeaturedAssets`，pageSize 用新常量：

```ts
  const loadFeatured = useCallback(async () => {
    if (!isAuthenticated || !ownerId) {
      setFeaturedAssets([]);
      setFeaturedError(null);
      return;
    }

    setFeaturedLoading(true);
    setFeaturedError(null);
    try {
      const resp = await fetchProfileFeaturedMediaList({
        userId: ownerId,
        pageSize: MAX_FEATURED_COUNT,
        variantOption: { compressType: 2 },
      });
      setFeaturedAssets(resp.list);
    } catch (error) {
      setFeaturedError(errorMessage(error, "精选图片加载失败"));
      setFeaturedAssets([]);
    } finally {
      setFeaturedLoading(false);
    }
  }, [isAuthenticated, ownerId]);
```

**(f) `removeDeletedImageFromState`**（L370-374）中：

```ts
    setFeaturedImages((prev) => prev.filter((img) => img.id !== imageId));
```

改为

```ts
    setFeaturedAssets((prev) => prev.filter((asset) => asset.id !== imageId));
```

**(g) 保存回调**（放在 `handleNewPost` 之前，L414 附近）：

```ts
  // Full-replace save; refetch afterwards because the update response carries
  // no variantOption (URLs would be uncompressed originals).
  const handleFeaturedConfirm = async (assets: MediaAssetResponse[]) => {
    try {
      await updateProfileFeaturedMedia({
        mediaAssetIds: assets.map((asset) => asset.id),
      });
      await loadFeatured();
      toast({ title: "精选已更新", variant: "success" });
    } catch (error) {
      toast({
        title: "精选保存失败",
        description: errorMessage(error, "请稍后重试"),
        variant: "destructive",
      });
      return false;
    }
  };
```

**(h) 精选 Tab 渲染**（L704-739 的 `activeTab === "featured"` 分支）整体替换为（网格部分与原代码完全一致，仅外层加 `space-y-4` 容器、顶部按钮和空状态变化）：

```tsx
        ) : activeTab === "featured" ? (
          <div className="space-y-4">
            {isOwnProfile && !featuredLoading && featuredImages.length > 0 ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFeaturedPicker(true)}
                >
                  <Settings2 className="size-4" />
                  管理精选
                </Button>
              </div>
            ) : null}
            {featuredLoading ? (
              <LoadingBlock />
            ) : featuredError ? (
              <EmptyState title="精选图片加载失败" description={featuredError} />
            ) : featuredImages.length === 0 ? (
              <EmptyState
                title="暂无精选图片"
                description={
                  isOwnProfile
                    ? "从你的作品中挑选精选，展示在这里"
                    : "设置精选后会展示在这里"
                }
                action={
                  isOwnProfile ? (
                    <Button
                      type="button"
                      onClick={() => setShowFeaturedPicker(true)}
                    >
                      <Sparkles className="size-4" />
                      去挑选作品
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {featuredImages.map((image, index) => (
                  <article
                    key={image.id}
                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted"
                    onClick={() => handleImageClick(image, index)}
                  >
                    <img
                      src={getImageUrl(image)}
                      alt={image.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                      <div className="text-sm font-medium line-clamp-1">{image.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="size-3" />
                          {formatCount(image.likes)}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
```

**(i) 弹窗挂载**（`PostComposerDialog` 之前，L849 附近）：

```tsx
      {/* Featured Picker Dialog */}
      {isOwnProfile ? (
        <MediaPickerDialog
          open={showFeaturedPicker}
          onOpenChange={setShowFeaturedPicker}
          mode="multiple"
          title="管理精选"
          description="从你已发布的公开作品中挑选精选，最多 20 张，取消勾选即可移除。"
          ownerUserId={user?.id}
          initialSelected={featuredAssets}
          maxCount={MAX_FEATURED_COUNT}
          confirmLabel="保存精选"
          onConfirm={handleFeaturedConfirm}
        />
      ) : null}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS（全部用例）

- [ ] **Step 5: 构建与 lint**

Run: `npx tsc -b && npm run lint`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add frontend/tests/profile-featured-picker.test.mjs frontend/src/pages/AccountDetailPage.tsx
git commit -m "feat: 个人主页精选 Tab 支持从自己的作品中管理精选"
```

---

### Task 4: 端到端手动验证（可选但推荐）

- [ ] **Step 1: 启动前后端**

后端（仓库根目录）：`go run discoverworld.go`；前端：`npm run dev`。

- [ ] **Step 2: 验证流程**

1. 登录后进入个人主页 → 精选 Tab，空状态显示「去挑选作品」按钮。
2. 打开弹窗，只看到自己的已发布作品；勾选若干张保存，toast「精选已更新」，网格刷新。
3. 重新打开弹窗，已选图片带勾选标记；取消一张后保存，网格对应减少。
4. 取消全部勾选后保存（0 张），精选清空回到空状态。
5. 访问他人主页精选 Tab：无任何管理按钮。
