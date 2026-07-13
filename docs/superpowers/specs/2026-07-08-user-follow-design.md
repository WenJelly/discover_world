# 用户关注功能设计文档

日期：2026-07-08
状态：已确认

## 背景

当前 Discover World 已有用户账号、公开个人主页、作品详情弹窗和媒体/动态/相册可见性字段。
数据库文档中已经定义 `user_follow` 表，Go model 也已经生成
`model/userfollowmodel_gen.go`，但服务上下文、API、业务逻辑和前端还没有真正接入。

第一版只做普通单向关注：

- 登录用户可以关注 / 取关其他 active 用户。
- 个人主页展示粉丝数、关注数、当前登录用户是否已关注该主页用户。
- 作品详情弹窗里的摄影师关注按钮接真实状态和接口。
- 不做互关、关注申请、私密账号、拉黑、通知、关注流。
- 暂不启用 `followers` 内容可见性；这放到第二期做，避免权限过滤覆盖不完整。

## 数据模型

继续使用 `user_follow`：

- `follower_id`：关注者账号 ID。
- `following_id`：被关注者账号 ID。
- `status`：`1` 表示关注中，`0` 表示已取消。
- `uk_user_follow_pair(follower_id, following_id)` 保证同一关系只有一条记录。

取关不硬删除，只把 `status` 置为 `0`。再次关注复用原记录并把 `status` 改回 `1`。
这样关注 / 取关接口可以做成幂等操作，也方便以后做关注历史或通知去重。

为计数和分页补充组合索引：

```sql
KEY `idx_user_follow_follower_status_id` (`follower_id`, `status`, `id`),
KEY `idx_user_follow_following_status_id` (`following_id`, `status`, `id`)
```

## 后端接口

新增 JWT 保护的 `follow` 分组，保持项目现有 POST 风格：

- `POST /api/follow/create`
- `POST /api/follow/cancel`
- `POST /api/follow/status`
- `POST /api/follow/follower/list`
- `POST /api/follow/following/list`

基础请求：

```go
type FollowTargetRequest struct {
    TargetUserId string `json:"targetUserId"`
}
```

状态响应：

```go
type FollowStatusResponse struct {
    TargetUserId   string `json:"targetUserId"`
    IsFollowing   bool   `json:"isFollowing"`
    FollowerCount int64  `json:"followerCount"`
    FollowingCount int64 `json:"followingCount"`
}
```

列表响应复用公开账号摘要：

```go
type FollowUserListResponse struct {
    PageSize   int64            `json:"pageSize"`
    HasMore    bool             `json:"hasMore"`
    NextCursor string           `json:"nextCursor"`
    List       []AccountSummary `json:"list"`
}
```

业务规则：

- 未登录不能调用。
- 不能关注自己。
- 被关注者必须存在、`status='active'`、`deleted_at IS NULL`。
- 关注已关注用户返回当前状态，不报错。
- 取关未关注用户返回未关注状态，不报错。
- 公开账号摘要不返回 email/phone。

## 账号详情集成

扩展 `DetailAccountResponse`：

```go
FollowerCount  int64 `json:"followerCount"`
FollowingCount int64 `json:"followingCount"`
IsFollowing    bool  `json:"isFollowing"`
```

`loadDetailAccountResponse` 是账号详情聚合点，负责查询目标用户粉丝数和关注数。
`DetailAccountLogic.DetailAccount` 已经知道 viewer 和 target，因此在返回前计算 viewer 是否关注 target。
自己查看自己时 `isFollowing=false`。

公共账号详情仍然遵守现有隐私遮罩：访客查看别人账号时不返回 email/phone，也不返回 pending/rejected 统计。

## 前端交互

个人主页：

- 自己的主页不展示关注按钮。
- 访问其他用户主页时，在昵称区域右侧展示 `关注` / `已关注` 按钮。
- 顶部统计展示 `作品 / 粉丝 / 关注`。
- 关注操作使用乐观更新：先更新按钮和粉丝数，失败时回滚并展示错误状态。

作品详情弹窗：

- `PhotographerInfo` 已有 `isFollowing`、`followPending`、`hideFollow`、`onToggleFollow` props。
- `DiscoverPage` 将不再弹出“功能开发中”，而是调用真实关注接口。
- 当前用户打开自己的作品时隐藏关注按钮。

前端类型：

- `DetailAccountResponse` 增加 `followerCount`、`followingCount`、`isFollowing`。
- `UserProfile.followers` 和 `UserProfile.following` 从后端映射，不再写死为 `0`。
- `AccountSummary` 可选增加 `isFollowing`，用于后续列表或弹窗扩展，但第一版不要求所有列表都返回。

## 第二期边界

本期不启用 `followers` 内容权限。第二期再统一处理：

- 媒体列表和详情中的 `visibility='followers'` 过滤。
- 动态和相册的粉丝可见发布、读取、搜索过滤。
- 关注流。
- 通知和互关推荐。

## 测试

后端：

- `UserFollowModel`：关注 upsert、取关、是否关注、粉丝数、关注数。
- 关注逻辑：不能关注自己、不能关注不存在或 inactive 用户、重复关注/重复取关幂等。
- 账号详情：返回粉丝数、关注数、viewer 是否已关注目标用户；访客查看别人账号仍隐藏 email/phone。

前端：

- `toAccountProfile` 正确映射 followers/following。
- `api.ts` 封装 follow create/cancel/status。
- `AccountDetailPage` 有关注按钮和统计映射。
- `DiscoverPage` 不再使用“关注功能即将上线”的假逻辑，改接真实接口。

## 文档

更新 `docs/数据库信息.md`：

- `user_follow` 表增加组合索引。
- 补充已有数据库升级 SQL。
- 明确第一期 `followers` 可见性仍不启用。
