# 运营与审核后台后端增强设计

日期：2026-07-10
状态：已确认
范围：只改后端，不包含前端页面实现

## 背景

Discover World 当前已经有后台入口和一批管理能力：

- `AdminCheckMiddleware` 通过 `user_account.role = admin` 判断管理员。
- 后台已有首页 Hero / 精选配置、媒体审核、基础内容治理和账号更新接口。
- 媒体审核使用 `media_asset.audit_status`，审核备注写入 `metadata_json`。
- 动态治理可以隐藏 / 恢复 `post.status`，论坛治理可以锁帖和分区置顶。
- 用户举报可以创建 `moderation_report`，但缺少管理端列表、处理、关闭和关联治理动作。
- 通知表已经可用于给作者发送审核结果或治理结果通知。
- `site_config`、`asset_link`、`tag`、`tagging`、`entity_stat` 已经能支撑一部分运营配置和数据统计。

本次增强把后台后端能力分成三条线一起设计：

- A 审核治理：举报工单、媒体审核、动态 / 评论 / 论坛治理。
- B 运营管理：运营看板、首页推荐、标签管理、内容精选。
- C 后台基础设施：权限能力、操作审计、处理原因、管理端查询模型。

整体仍保持 go-zero REST 单体，不拆微服务，不引入 MQ。

## 设计取舍

采用“统一后台内核 + 三条业务线”方案。

后台内核提供统一的管理员加载、权限判断、分页解析、处理原因规范化和操作日志写入。审核治理、运营管理、账号管理都调用同一套内核，避免每个模块各自写一套审计和权限逻辑。

暂不采用完整 RBAC 多表体系。当前项目只有 `user_account.role`，先用轻量的 `admin_role_policy` 承载 role 到 capability 的映射，并保留 `admin` 角色拥有全部权限。这样后续能扩展 `moderator`、`operator`，但第一期实现成本不会过高。

## 后端模块边界

新增或扩展模块：

- `internal/logic/admin/common.go`：后台通用 helper。
- `internal/logic/adminaudit`：管理端审计日志查询和写入封装。
- `internal/logic/adminmoderation` 或继续扩展 `internal/logic/moderation`：举报工单和内容治理。
- `internal/logic/adminoperation` 或继续扩展 `internal/logic/admin`：运营看板、标签和精选管理。
- `model/adminoperationlogmodel.go`：后台操作日志模型。
- `model/adminrolepolicymodel.go`：角色权限策略模型。

现有 `AdminCheckMiddleware` 保留，只做“必须是管理员用户”这一层校验。具体能力校验下沉到 logic，例如：

- `admin.media.review`
- `admin.content.moderate`
- `admin.operation.manage`
- `admin.account.manage`
- `admin.audit.read`

## 数据模型

### admin_operation_log

记录所有后台写操作，作为审计和问题追溯的基础表。

核心字段：

- `id`
- `operator_user_id`
- `action`
- `target_type`
- `target_id`
- `reason`
- `before_json`
- `after_json`
- `metadata_json`
- `client_ip`
- `created_at`

建议索引：

- `idx_admin_operation_operator_created(operator_user_id, created_at)`
- `idx_admin_operation_target(target_type, target_id, created_at)`
- `idx_admin_operation_action_created(action, created_at)`

日志只追加，不更新，不删除。后台写操作失败时不写成功日志；如果业务操作成功但日志写入失败，应返回失败，避免敏感操作不可追溯。

### admin_role_policy

轻量权限策略表。

核心字段：

- `id`
- `role`
- `capability`
- `status`
- `created_at`
- `updated_at`

`admin` 角色作为内置超级管理员，即使没有策略记录也拥有全部能力。其他角色必须命中启用策略。

### moderation_report 扩展

现有举报表只记录创建，不记录处理人和处理结论。扩展字段：

- `handler_user_id`
- `resolution`
- `resolution_note`
- `resolved_at`

状态语义：

- `open`：待处理。
- `accepted`：举报采纳，通常已经触发隐藏、锁定、删除等治理动作。
- `rejected`：举报驳回，不对目标做治理。
- `resolved`：已处理但不严格区分采纳 / 驳回时使用。

## A 审核治理

### 举报工单

新增接口：

- `POST /api/admin/moderation/report/list`
- `POST /api/admin/moderation/report/detail`
- `POST /api/admin/moderation/report/resolve`

列表支持：

- `status`
- `targetType`
- `targetId`
- `reporterUserId`
- `createdAtFrom`
- `createdAtTo`
- `pageNum`
- `pageSize`

处理接口请求字段：

- `id`
- `resolution`
- `resolutionNote`
- `action`
- `targetType`
- `targetId`

`action` 可为空。为空时只关闭举报；有值时同时执行治理动作，例如隐藏动态、隐藏评论、锁帖、恢复内容。

处理流程：

1. 通过 `AdminCheckMiddleware` 和 `RequireAdminCapability("admin.content.moderate")`。
2. 查询举报和目标内容。
3. 根据 action 执行治理动作。
4. 更新 `moderation_report` 的处理人、状态、处理说明和处理时间。
5. 写 `admin_operation_log`，metadata 里包含 `reportId`。
6. 必要时给内容作者写通知。

### 媒体审核

保留现有接口：

- `POST /api/admin/media/list`
- `POST /api/media/review`

调整点：

- `ReviewMediaAssetRequest` 增加 `reason` 或复用 `reviewMessage` 作为统一处理原因。
- 媒体审核写 `admin_operation_log`，target 为 `media_asset`。
- 审核通过 / 拒绝继续写 `notification(event_type='media_review')`。
- 后续可以把 `/api/media/review` 迁移到 `/api/admin/media/review`，但第一期保留兼容路由。

### 内容治理

保留现有接口：

- `POST /api/admin/moderation/post/hide`
- `POST /api/admin/moderation/post/restore`
- `POST /api/admin/forum/post/lock`
- `POST /api/admin/forum/post/unlock`
- `POST /api/admin/forum/post/pin`
- `POST /api/admin/forum/post/unpin`

扩展请求体：

- `id`
- `reason`
- `reportId`

新增接口：

- `POST /api/admin/moderation/comment/hide`
- `POST /api/admin/moderation/comment/restore`
- `POST /api/admin/moderation/content/list`

`content/list` 用于后台统一查动态、评论和论坛帖，不复用公开列表，因为公开列表会过滤 hidden / inactive / private 内容，不适合审核后台。

## B 运营管理

### 运营看板

新增接口：

- `POST /api/admin/operation/dashboard`

返回核心计数：

- 待审核媒体数。
- 待处理举报数。
- 活跃用户数。
- 公开作品数。
- 公开动态数。
- 近 24 小时新增作品 / 动态 / 举报。
- 热门作品和热门动态摘要。

实现上复用 `entity_stat` 和现有 `site_stats` 查询模式，不为第一期新增实时聚合表。

### 标签管理

新增接口：

- `POST /api/admin/operation/tag/list`
- `POST /api/admin/operation/tag/update`
- `POST /api/admin/operation/tag/merge`

规则：

- `tag/list` 支持按 `name`、`tagType`、`status` 过滤。
- `tag/update` 可修改 `name`、`slug`、`tagType`、`status`。
- `tag/merge` 把 source tag 的 tagging 迁移到 target tag，然后禁用 source tag。
- 所有标签写操作记录 `admin_operation_log`。

### 内容精选

已有首页精选使用：

```text
asset_link.owner_type = site
asset_link.owner_id = 0
asset_link.link_role = homepage_featured
```

保留现有 `UpdateHomepageFeatured`，新增通用精选接口时仍复用 `asset_link`：

- `POST /api/admin/operation/content/feature`
- `POST /api/admin/operation/content/unfeature`

第一期只支持 `targetType=media_asset`。运营精选不改变 `media_asset.audit_status`，只允许选择 active、approved、work 类型作品，避免运营和审核语义混用。

## C 权限与审计

### 能力校验

后台写操作必须满足：

1. JWT 认证通过。
2. `AdminCheckMiddleware` 判断是后台用户。
3. logic 层判断具体 capability。

内置能力：

- `admin.account.manage`
- `admin.media.review`
- `admin.content.moderate`
- `admin.operation.manage`
- `admin.audit.read`

`admin` 角色默认全能力。其他角色通过 `admin_role_policy` 授权。

### 审计日志查询

新增接口：

- `POST /api/admin/audit/operation/list`
- `POST /api/admin/audit/operation/detail`

查询能力需要 `admin.audit.read`。

过滤项：

- `operatorUserId`
- `action`
- `targetType`
- `targetId`
- `createdAtFrom`
- `createdAtTo`
- `pageNum`
- `pageSize`

### 操作日志写入规则

所有后台写操作必须包含：

- 操作人。
- 操作类型。
- 目标类型和 ID。
- 原因或备注。
- 操作前快照。
- 操作后快照。

对密码重置、账号禁用、角色变更等敏感操作，`before_json` 和 `after_json` 不记录密码哈希，只记录字段名和状态变化。

## API 变更清单

新增请求 / 响应类型：

- `AdminPageRequest`
- `AdminOperationLogResponse`
- `AdminOperationLogPageResponse`
- `AdminModerationReportQueryRequest`
- `AdminModerationReportResolveRequest`
- `AdminModerationReportResponse`
- `AdminContentQueryRequest`
- `AdminTagQueryRequest`
- `AdminTagUpdateRequest`
- `AdminTagMergeRequest`
- `AdminDashboardRequest`
- `AdminDashboardResponse`

扩展现有类型：

- `AdminModeratePostRequest` 增加 `reason`、`reportId`。
- `ReviewMediaAssetRequest` 明确 `reviewMessage` 是审核原因，并写入审计日志。

## 错误处理

通用错误语义：

- 未登录：保持现有认证错误。
- 非管理员：保持 `AdminCheckMiddleware` 返回。
- 无具体权限：`403 Forbidden`。
- 目标不存在：`404 Not Found`。
- 参数错误：`400 Bad Request`。
- 并发处理已关闭举报：返回当前举报状态，不重复执行治理动作。

举报处理和治理动作应尽量放入事务：

- 更新目标内容。
- 更新举报状态。
- 写操作日志。

通知写入可以 best-effort，但失败要记录 logx error，不阻断主流程。

## 测试计划

后端 model 测试：

- `AdminOperationLogModel` 插入、分页查询、按目标查询。
- `AdminRolePolicyModel` 判断 role capability。
- `ModerationReportModel` 查询、处理、重复处理。
- `TagModel` 列表、更新、合并。

后端 logic 测试：

- 非 admin 不能访问后台接口。
- admin 但缺 capability 时返回 403。
- 举报处理会更新举报状态、执行目标治理动作、写审计日志。
- 媒体审核会更新 `audit_status`、写 `metadata_json`、写审计日志、发送通知。
- 评论隐藏 / 恢复只影响 `comment_record.status` 和 `deleted_at`。
- 标签合并会迁移 `tagging`，并禁用 source tag。

路由测试：

- 新增 `/api/admin/moderation/*`、`/api/admin/operation/*`、`/api/admin/audit/*` 路由全部挂 `AdminCheck`。
- 兼容现有 `/api/media/review`。

文档测试：

- `docs/数据库信息.md` 和 `sql/*.sql` 中新增表 / 字段保持一致。
- `docs/后端功能与逻辑说明.md` 覆盖新增后台接口和权限语义。

## 实施顺序

1. 建表和 model：`admin_operation_log`、`admin_role_policy`，扩展 `moderation_report`。
2. 后台通用 helper：管理员能力判断、分页、原因规范化、审计日志写入。
3. 审核治理：举报列表 / 处理、评论隐藏恢复、现有治理动作接入原因和审计。
4. 媒体审核接入审计，并保持现有通知逻辑。
5. 运营管理：dashboard、标签管理、内容精选。
6. 审计查询：操作日志列表 / 详情。
7. 更新 `api/discover_world.api`、路由、types、docs，并跑后端测试。

## 明确不做

- 不改前端页面。
- 不拆微服务。
- 不引入 MQ。
- 不做完整菜单级 RBAC 管理页面。
- 不改变公开接口的可见性过滤规则。
- 不把运营精选等同于审核通过。
