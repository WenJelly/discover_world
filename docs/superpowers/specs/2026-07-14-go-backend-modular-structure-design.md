# Discover World Go 后端模块化目录设计

## 背景

Discover World 当前采用 go-zero 1.10.1。API 定义已经拆分到 `api/modules/*.api`，`goctl api go` 也会依据 `@server` 中的 `group`，生成 `internal/handler/<group>` 和 `internal/logic/<group>`。

当前后端目录仍有以下结构问题：

- `model/` 中的数据库模型全部平铺，业务归属不清晰。
- `internal/svc/servicecontext.go` 集中声明并初始化全部模型，文件会随功能增长持续膨胀。
- 多个 logic 包直接引用其他 logic 包，依赖方向缺少约束。
- 登录、注册和搜索限流通过手工修改生成的 `internal/handler/routes.go` 接入，重新生成时容易丢失。
- 部分 goctl 生成的 `*_gen.go` 被移入 `model/gen`，而自定义模型仍位于 `model`。自定义文件依赖 `model/gen` 中的未导出类型，生成文件又反向引用 `model.ErrNotFound`，形成 `model -> model/gen -> model` 循环依赖，导致服务无法编译和启动。

## 目标

- 遵循 go-zero 原生 API 服务目录与生成约定。
- 在不使用自定义 goctl 模板的前提下，按业务模块组织 handler、logic 和数据库模型。
- 保证 `goctl api go` 可以持续直接执行，生成代码不需要手工修补。
- 明确模块所有权和依赖方向，防止循环依赖重新出现。
- 拆分 ServiceContext 的模型装配代码，同时保留 go-zero 的统一依赖注入方式。
- 保持现有 API、数据库结构和业务行为不变。

## 非目标

- 不修改接口路径、HTTP 方法、JWT 规则和 JSON 字段。
- 不修改数据库表、字段、索引或数据。
- 不重写现有业务规则。
- 不引入微服务拆分、RPC 服务或新的基础设施。
- 不修改 `frontend/`。
- 不维护自定义 goctl 模板。

## 目录结构

```text
api/
  discover_world.api
  modules/
    account.api
    admin.api
    common.api
    feed.api
    follow.api
    forum.api
    homepage.api
    media.api
    moderation.api
    notification.api
    overview.api
    post.api
    profile.api
    search.api

internal/
  handler/
    <module>/
  logic/
    <module>/
  types/
  svc/
    servicecontext.go
    models.go
    models_account.go
    models_admin.go
    models_follow.go
    models_forum.go
    models_homepage.go
    models_interaction.go
    models_media.go
    models_moderation.go
    models_notification.go
    models_post.go
    models_profile.go
    models_search.go
    models_statistics.go
    models_taxonomy.go
    transaction.go
  common/
    access/
    adminsupport/
    auth/
    clientip/
    ipgeo/
    request/
    response/
  config/
  middleware/
  ranking/
  redisx/

model/
  account/
  admin/
  follow/
  forum/
  homepage/
  interaction/
  media/
  moderation/
  notification/
  post/
  profile/
  search/
  statistics/
  taxonomy/
```

`internal/handler/<module>`、`internal/logic/<module>` 和 `internal/types` 继续由 goctl 按官方约定生成或维护。数据库模型由 goctl model 命令生成到明确的 `model/<module>` 目录。

## 模型归属

| 模型模块 | 数据库模型或查询模型 |
| --- | --- |
| `account` | `user_account` |
| `profile` | `user_profile`、`album` |
| `media` | `storage_provider`、`storage_bucket`、`media_asset`、`media_object`、`media_upload_session`、`media_variant_rule`、`asset_link`、`share_link` |
| `post` | `post`、`post_discussion`、`comment_record` |
| `forum` | `forum_board` |
| `follow` | `user_follow` |
| `interaction` | `reaction`、`favorite` |
| `taxonomy` | `tag`、`tagging` |
| `statistics` | `entity_stat`、`entity_stat_hourly`、`entity_ranking`、`site_stats` |
| `moderation` | `moderation_report`、`content_ip_attribution` |
| `notification` | `notification` |
| `homepage` | `site_config` |
| `admin` | `admin_operation_log`、`admin_role_policy` |
| `search` | 跨表搜索查询模型 |

每个 goctl 生成的 `*_gen.go` 必须与对应自定义 model 文件位于同一个目录和同一个 Go package。禁止再创建 `model/gen` 这种拆分生成类型与自定义实现的子包。

## 依赖规则

允许的主要依赖方向为：

```text
main
  -> handler
  -> svc

handler/<module>
  -> logic/<module>
  -> svc
  -> types

logic/<module>
  -> svc
  -> types
  -> common
  -> model/<module>

svc
  -> config
  -> middleware
  -> redisx
  -> model/*

model/*
  -> go-zero sqlx
  -> standard library
```

具体约束：

- handler 只负责请求解析、调用同名 logic 和写回响应，不承载业务规则。
- `handler/<module>` 不得调用其他模块的 handler 或 logic。
- logic 可以通过 ServiceContext 使用公开的 Model 接口。
- 跨模块 logic 调用必须保持单向依赖。例如 `feed -> post/media`、`forum -> post` 可以存在，但 `post/media` 不得反向依赖 `feed/forum`。
- 可复用的访问控制、IP 归属、管理端辅助等能力分别归入 `internal/common/access`、`internal/common/ipgeo`、`internal/common/adminsupport`，不得继续伪装成接口 logic 模块。
- `model/<module>` 不得依赖 `internal`，也不得引用其他模型模块的具体实现。
- 公共包必须是依赖图中的底层包，不得反向依赖业务 logic。

## ServiceContext 设计

ServiceContext 继续作为 go-zero API 服务统一的依赖注入入口，不新增第二套容器。

```go
type ServiceContext struct {
	Config config.Config
	Redis  *redisx.Client

	Models ModelSet

	AdminCheck        rest.Middleware
	LoginRateLimit    rest.Middleware
	RegisterRateLimit rest.Middleware
	SearchRateLimit   rest.Middleware
	TokenRevocation   rest.Middleware

	dbConn sqlx.SqlConn
}

type ModelSet struct {
	Account      AccountModels
	Admin        AdminModels
	Follow       FollowModels
	Forum        ForumModels
	Homepage     HomepageModels
	Interaction  InteractionModels
	Media        MediaModels
	Moderation   ModerationModels
	Notification NotificationModels
	Post         PostModels
	Profile      ProfileModels
	Search       SearchModels
	Statistics   StatisticsModels
	Taxonomy     TaxonomyModels
}
```

各 `models_<module>.go` 只声明并初始化一个模块的模型集合。业务代码通过以下形式访问模型：

```go
svcCtx.Models.Account.UserAccount.FindOne(ctx, id)
svcCtx.Models.Media.MediaAsset.FindOne(ctx, id)
```

`Transact` 继续基于 `sqlx.Session` 创建事务级 ServiceContext，但模型重建统一委托给 `newModelSet(conn)`，保证普通连接和事务连接使用完全相同的模型装配路径。

## API 生成与中间件

`internal/handler/routes.go` 是 goctl 生成文件，不再允许手工修改。

登录、注册和搜索限流通过对应 API 模块中的 `middleware` 声明表达。因为三者使用不同的限流中间件，登录和注册分别使用独立的 `@server` 块；生成后的 routes 自动引用：

```text
serverCtx.LoginRateLimit
serverCtx.RegisterRateLimit
serverCtx.SearchRateLimit
```

管理员权限继续使用 API 中的 `AdminCheck` middleware，JWT 继续使用 `jwt: Auth`。所有中间件信息均由 API 定义驱动，确保重新生成可重复。

## 请求和错误处理

请求处理链保持：

```text
HTTP request
  -> middleware
  -> handler/<module>
  -> logic/<module>
  -> svc.ServiceContext
  -> model/<module>
  -> MySQL / Redis / storage
```

- handler 不转换业务错误。
- logic 负责把数据不存在、参数冲突、权限不足等情况转换成现有 `internal/common/response` 错误。
- model 只返回数据访问错误，不依赖 API 响应包。
- goctl 模型包中的 `ErrNotFound` 保持为 `sqlx.ErrNotFound` 的别名，logic 使用 `errors.Is` 判断。
- `main.go` 中现有的全局 `httpx.SetErrorHandler` 继续统一生成响应体和记录服务端错误。

## 迁移顺序

1. 增加目录和 import 边界回归测试，先确认当前结构不符合约束。
2. 消除 `model -> model/gen -> model` 循环，恢复可编译基线。
3. 按模型模块逐组迁移生成文件和自定义文件，并同步更新 ServiceContext 与 logic 引用。
4. 把 ServiceContext 模型声明和初始化拆分到 `models_<module>.go`，再统一调整调用路径为 `svcCtx.Models.<Module>.<Model>`。
5. 将 `internal/logic/access`、`internal/logic/ipgeo`、`internal/logic/adminsupport` 迁入 `internal/common`，更新单向依赖。
6. 把限流中间件写入 API 定义，使用 goctl 重新生成 routes 和 types。
7. 删除旧的根级模型文件、`model/gen` 和失效 import。
8. 完成全量测试、静态检查和构建验证。

迁移按模块逐步进行，但最终作为一次完整的后端目录调整交付；任何中间状态都不得通过删除业务代码来规避编译错误。

## 测试与验证

新增或保留以下验证：

- 每个业务 API 模块可以独立通过 `goctl api validate`。
- 聚合 API 可以通过 `goctl api validate`。
- 在临时目录执行 `goctl api go`，确认生成的 routes 和 types 与仓库版本一致。
- 使用 Go AST 或 import 扫描验证：
  - 不存在 `model/gen` import。
  - `model/*` 不导入 `discover_world/internal/*`。
  - handler 不导入其他业务模块的 logic。
  - common 不反向导入业务 logic。
- 运行现有单元测试和新增架构测试。
- 运行 `go test ./...`。
- 运行 `go vet ./...`。
- 运行 `go build ./...`。
- 运行 `git diff --check`。

## 验收标准

- 服务能够编译并启动，不再出现 import cycle。
- 所有数据库模型都归入明确的 `model/<module>`，根级 `model/*.go` 和 `model/gen` 不再承载旧模型。
- handler 和 logic 继续按 API group 生成到对应模块目录。
- ServiceContext 的模型依赖按模块访问，事务装配正常。
- `routes.go` 可以完全由 API 定义重新生成，限流和权限中间件不会丢失。
- API 路径、请求响应 JSON、数据库结构和业务规则没有变化。
- 后端测试、vet 和 build 全部通过。
- `frontend/` 不包含本次模块化产生的新改动。
