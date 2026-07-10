# 粉丝可见权限完善设计文档

日期：2026-07-10
状态：已确认

## 背景

Discover World 已经有单向关注关系、粉丝数、关注数、关注/粉丝列表、关注动态流和关注作品流。
数据库字段也已经预留 `followers` 可见性：`media_asset.visibility`、`post.visibility` 和
`album.visibility` 都允许 `public / private / followers / unlisted`。

当前代码里粉丝可见还没有完整启用：

- `internal/logic/post/common.go` 的 `normalizePostVisibility` 只允许 `public` 和 `private`。
- `media_asset` 上传已经能保存 `followers`，但 `canViewMediaAsset` 只允许公开或本人/管理员。
- 个人主页动态和相册列表用 `includePrivate bool` 区分本人和非本人，无法表达“粉丝可见”。
- 公开列表、公开动态流、全局搜索和关注流大量硬编码 `visibility='public'`。
- 前端动态可见范围菜单只有 `公开` 和 `仅自己可见`。

因此这次不是简单打开一个枚举，而是要把发布、详情、列表和搜索的权限口径统一。

## 范围

第一期启用动态和作品的粉丝可见权限：

- 动态 `post.visibility='followers'`。
- 作品媒体 `media_asset.visibility='followers'`，只限定 `asset_usage='work'` 的作品展示语义。
- 动态附件图片跟随动态可见范围，避免正文是粉丝可见但图片资源公开泄漏。
- 已关注作者的登录用户可以查看作者设置为粉丝可见的动态和作品。
- 取关后立即失去粉丝可见内容访问权。

本期不启用相册粉丝可见：

- `album.visibility='followers'` 继续只作为 schema 预留。
- 个人主页相册列表仍按现有 public/owner/admin 口径展示。
- 相册内图片权限和封面权限留到第二期单独设计。

## 权限规则

把内容可见性统一成四档：

```text
public    = 任何入口可见，公开列表和搜索也可见
followers = 作者本人、管理员、已关注作者的登录用户可见
private   = 作者本人和管理员可见
unlisted  = 作者本人和管理员可见；本期不做分享链接能力
```

用户关系判断：

```text
viewer.id == owner_id                      -> owner
svcCtx.IsAdminAccount(viewer)              -> admin
user_follow.follower_id = viewer.id
and user_follow.following_id = owner_id
and user_follow.status = 1                 -> follower
```

未登录用户只具备 public 访问级别。当前需要粉丝可见的详情接口都是 JWT 接口，因此第一期不新增可选登录公共接口。

## 后端设计

新增一个小的访问策略模块，建议放在 `internal/logic/access`：

- `ContentVisibility` 常量：`public / followers / private / unlisted`。
- `ViewerAccess`：记录 `ViewerID`、`OwnerID`、`IsOwner`、`IsAdmin`、`IsFollower`。
- `ResolveViewerAccess(ctx, svcCtx, viewer, ownerID)`：统一查询 owner/admin/follower。
- `CanViewVisibility(visibility string, access ViewerAccess)`：纯函数判断可见性。
- `VisiblePostVisibilitySQL(level ViewerAccessLevel)`：给个人主页和关注流模型查询复用。
- `VisibleMediaVisibilitySQL(level ViewerAccessLevel)`：给作品查询复用。

动态：

- `normalizePostVisibility` 放开 `followers`。
- `canViewPost` 调用访问策略。
- `validatePostImages` 增加规则：
  - public 动态只能挂 public + approved 图片。
  - followers 动态可以挂 public 或 followers 图片，但图片必须 active，且如果是 followers 则仍要求 approved。
  - private 动态可以挂作者自己的 active 图片，不强制公开审核。
- `CreatePostLogic` 上传后的动态附件应该跟随动态可见范围。前端也会跟随传值，后端校验兜底。
- `UpdatePostLogic` 改可见范围时重新校验附件，防止把带私有图片的动态改成 public。

媒体：

- `canViewMediaAsset` 和 `canViewOriginal` 调用访问策略。
- `GetMediaAsset`、`DownloadMediaAsset`、媒体 reaction 等需要读取单个媒体的入口使用同一判断。
- 公开媒体列表 `/api/media/list` 和 `/api/media/list/cursor` 继续只返回 public。
- 关注作品流 `/api/feed/following/media/list/cursor` 返回当前用户已关注作者的 public + followers 作品。

个人主页：

- `loadProfileTarget` 不再返回 `includePrivate bool`，改成返回访问级别。
- 他人主页未关注：动态只返回 public。
- 他人主页已关注：动态返回 public + followers。
- 本人或管理员：动态返回 public + followers + private + unlisted 中非 deleted 内容。
- 相册仍保持旧规则：他人只看 public，本人/管理员看全部非 deleted。

搜索和公开流：

- `/api/search` 继续只搜 public 作品、public 动态和 public 相册。
- `/api/post/public/list/cursor` 继续只返回 public 动态。
- `/api/media/list*` 继续只返回 public + approved + work 作品。
- 首页精选、个人精选、站点统计继续只统计 public 内容。

## 前端边界

本期只改后端。前端动态可见范围菜单、发布弹窗、动态卡片显示、类型声明暂不修改。
后端会先完整支持 `followers` 权限，这样后续前端只需要接入已有后端能力。

## 错误处理

- 未关注用户访问粉丝可见动态详情：`403 no permission to view this post`。
- 未关注用户访问粉丝可见媒体详情/下载：`403 无权查看该媒体资源`。
- public 动态挂非 public approved 图片：`400 public posts can only use public approved images`。
- followers 动态挂其他人的图片：`403 image does not belong to the post owner`。
- followers 动态挂 deleted/非 active 图片：`400 image is not active`。

## 测试

后端重点：

- `CanViewVisibility` 覆盖 public/followers/private/unlisted 和 owner/admin/follower/anonymous。
- `normalizePostVisibility("followers")` 通过。
- `canViewPost` 和 `canViewMediaAsset` 对 follower 通过，对未关注用户拒绝。
- 个人主页动态列表：未关注只含 public；已关注含 public + followers；本人含全部非 deleted。
- 关注动态流和关注作品流包含 followers 内容。
- 公开媒体列表、公开动态流、全局搜索不包含 followers 内容。

前端测试本期不做，避免修改 `frontend/`。

## 验收

- A 关注 B 后，可以看到 B 的粉丝可见动态和作品。
- A 取关 B 后，同样内容详情返回 403，个人主页和关注流不再出现。
- 未登录公开列表和搜索不会出现粉丝可见内容。
- 作者本人和管理员仍能查看自己的粉丝可见、私有和不公开内容。
- 动态正文和附件图片权限一致，不出现图片绕过访问的问题。
- 本期不修改 `frontend/`，前端菜单是否展示粉丝可见不作为验收项。

## 后续

第二期再做相册粉丝可见：

- 相册壳、封面、相册 item 逐层权限判断。
- 相册内图片不因相册可见而绕过媒体自身权限。
- 相册封面不可见时返回空封面或限制设置封面时必须满足相册可见范围。
