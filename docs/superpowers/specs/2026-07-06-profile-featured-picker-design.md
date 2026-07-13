# 个人主页精选管理入口 设计文档

日期：2026-07-06
状态：已确认

## 背景

个人主页（`frontend/src/pages/AccountDetailPage.tsx`）的「精选」Tab 目前只读展示，通过
`fetchProfileFeaturedMediaList` 拉取精选图片，但没有任何"设置精选"的入口。

后端能力已完整就绪，本设计只涉及前端 UI：

- `POST /api/profile/featured/media/list`：读取精选列表。
- `POST /api/profile/featured/media/update`：**全量替换**精选列表，入参为完整的
  `mediaAssetIds`，顺序即展示顺序；上限 20 张（`maxProfileFeaturedMediaCount`）；
  只允许选择本人已发布（公开 + 审核通过）的图片，否则报错。
- 前端 `frontend/src/lib/api.ts` 已封装 `fetchProfileFeaturedMediaList` /
  `updateProfileFeaturedMedia`，后者尚无任何页面调用。

交互形态已确认：**弹窗统一管理**——一个选择弹窗内勾选/取消勾选，保存时一次性全量提交。
不做页内拖拽排序与逐张标记（YAGNI，后端全量替换语义下弹窗一次提交最贴合）。

## 方案

### 1. 入口按钮（AccountDetailPage）

- 精选 Tab 网格上方新增「管理精选」按钮，仅 `isOwnProfile` 为 true 时渲染。
- 精选为空且是本人时，空状态中增加「去挑选作品」按钮，同样打开弹窗；
  访客看到的空状态文案保持不变（"暂无精选图片"）。
- 两个入口共用同一个弹窗 open state。

### 2. 选择弹窗（扩展 MediaPickerDialog）

复用 `frontend/src/components/admin/MediaPickerDialog.tsx`，新增两个可选 prop，
不影响管理员首页精选的现有用法：

- `ownerUserId?: string`：透传给 `fetchMediaAssetCursorList`，限定只列出该用户的
  已发布作品（公开 + 审核通过），与后端校验口径一致。
- `initialSelectedIds?: string[]`：弹窗打开时预勾选当前精选，用户可取消勾选实现移除。
  需要在打开时把当前精选的 `MediaAssetResponse` 放入选中 Map（精选列表数据
  `AccountDetailPage` 已持有，直接传入即可，无需额外请求）。

个人主页调用方式：`mode="multiple"`、`maxCount={20}`、`ownerUserId={user.id}`、
`initialSelectedIds` 为当前精选 id 列表。达到上限时沿用弹窗现有的上限提示逻辑。

### 3. 保存流程

- 确认后调用 `updateProfileFeaturedMedia({ mediaAssetIds })`。
- id 顺序：原有精选中仍被勾选的保持原顺序在前，新勾选的按选择顺序追加在后。
- 用接口返回的 `MediaAssetPageResponse` 经 `toImageItem` 映射后直接刷新
  `featuredImages`（同时更新顶部统计栏计数），不再重新请求列表。
- 成功/失败沿用页面内状态反馈；失败时保留弹窗让用户重试。

### 4. 顺手清理

- 移除 `frontend/src/lib/account-profile.ts` 中 `toImageItem` 的遗留假数据
  `isFeatured: index < 8`（按索引硬编码，与真实精选无关）。

## 错误处理

- 保存失败（网络错误 / 校验失败如"必须从自己已发布的图片中选择"）：页面展示
  `ApiError.message`，弹窗不关闭。
- 弹窗内作品列表加载失败：沿用 `MediaPickerDialog` 现有错误展示与重试。

## 测试

沿用 `frontend/tests/` 下的 vitest 模式：

- `MediaPickerDialog`：`ownerUserId` 会传入列表请求；`initialSelectedIds` 预勾选生效、
  可取消勾选；`maxCount` 上限拦截。
- 保存流程：确认后以正确的 id 顺序调用 `updateProfileFeaturedMedia`，成功后精选
  网格用返回数据刷新；失败时弹窗保持打开并提示。

## 不做的事

- 页内拖拽排序、单张移除按钮（AdminPage 式草稿列表）。
- 后端任何改动。
- 「作品」Tab hover 遮罩上的逐张精选开关。
