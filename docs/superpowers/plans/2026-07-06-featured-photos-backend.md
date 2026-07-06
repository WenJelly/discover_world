# 精选照片后端实现计划

> **给执行代理的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）格式，便于跟踪。

**目标：** 为首页精选照片和个人主页精选照片补齐后端支持：首页精选只能由管理员设置；个人主页精选只能由当前用户自己设置；公开客户端可以读取优化后的精选照片列表。

**架构：** 复用现有 `asset_link` 表，不新增 `media_featured` 表。首页精选照片使用 `owner_type=site_home`、`owner_id=1`、`link_role=featured`，只能通过 `/api/admin/media/featured/update` 写入；个人主页精选媒体继续使用现有 `owner_type=user_profile`、`owner_id=user_profile.id`、`link_role=featured`，只能通过当前登录用户调用 `/api/profile/featured/media/update` 写入。公开读取时必须校验返回的每个媒体资源都是启用、公开、审核通过、未删除且不是头像。

**技术栈：** Go、go-zero REST、go-zero sqlx、MySQL、现有 `MediaAssetModel`、`AssetLinkModel`、`BuildMediaAssetListResponse`、认证和管理员中间件。

---

## 文件范围

- 修改 `api/discover_world.api`：新增公开首页精选列表路由、管理员首页精选列表/更新路由，以及个人主页精选更新路由。
- 修改 `internal/types/media.go`：如果不运行 goctl 生成代码，就手动增加请求类型。
- 修改 `internal/types/profile.go`：如果不运行 goctl 生成代码，就手动增加个人主页精选更新请求类型。
- 新建 `internal/logic/media/featured.go`：放置精选相关常量和通用辅助函数。
- 新建 `internal/logic/media/getfeaturedmediaassetlistlogic.go`：实现首页公开精选列表。
- 新建 `internal/logic/media/featured_test.go`：覆盖辅助函数和规则测试。
- 修改 `model/mediaassetmodel.go`：增加按 ID 查询公开且审核通过媒体的方法，以及按 owner 查询公开且审核通过媒体的方法。
- 修改 `model/mediaassetmodel_test.go`：增加查询约束的源码级守卫测试。
- 修改 `internal/logic/profile/getprofilefeaturedmedialistlogic.go`：让个人主页精选读取使用公开审核过滤，避免目标用户的私有/头像/未审核媒体被读出。
- 新建 `internal/logic/profile/updateprofilefeaturedmedialogic.go`：当前登录用户更新自己的个人主页精选。
- 新建 `internal/handler/profile/updateprofilefeaturedmediahandler.go`：个人主页精选更新 handler。
- 新建 `internal/logic/admin/getfeaturedmediaassetlistlogic.go`：管理员读取首页精选顺序。
- 新建 `internal/logic/admin/updatefeaturedmediaassetslogic.go`：管理员替换首页精选顺序。
- 新建对应处理器：`internal/handler/media/` 和 `internal/handler/admin/` 下各自增加处理器文件。
- 修改 `internal/handler/routes.go`：注册新增路由。
- 可选前端后续：把 `frontend/src/hooks/useInfinitePictures.ts` 首页调用从 `/api/media/list/cursor` 切到新的精选接口。

## API 契约

首页精选公开只读接口：

```text
POST /api/media/featured/list
请求体：{ "pageSize": 20, "variantOption": { "compressType": 2 } }
返回：MediaAssetPageResponse
```

个人主页精选接口：

```text
POST /api/profile/featured/media/list
请求体：{ "userId": "可选，默认当前登录用户", "pageSize": 20, "variantOption": { "compressType": 2 } }
返回：MediaAssetPageResponse

POST /api/profile/featured/media/update
请求体：{ "mediaAssetIds": ["123", "456", "789"] }
返回：MediaAssetPageResponse
```

首页精选管理员接口：

```text
POST /api/admin/media/featured/list
请求体：{ "pageSize": 20, "variantOption": { "compressType": 2 } }
返回：MediaAssetPageResponse

POST /api/admin/media/featured/update
请求体：{ "mediaAssetIds": ["123", "456", "789"] }
返回：MediaAssetPageResponse
```

规则：

- 首页精选公开只读接口返回管理员设置的人工精选照片，并保持管理员定义的顺序。
- 如果首页没有人工精选数据，首页精选公开只读接口回退到最新的公开且审核通过媒体，避免首页空白。
- 首页精选只能由管理员设置：写入口只有 `/api/admin/media/featured/update`，并且必须经过 `AdminCheck`。
- 普通用户没有任何首页精选写接口，不能写 `owner_type=site_home`。
- 首页精选管理员列表不做回退，只展示真实已选择的首页精选数据。
- 首页精选管理员更新允许传空 `mediaAssetIds`，用于清空首页人工精选。
- 首页精选管理员更新必须先验证所有 ID，再执行数据库变更。所有 ID 必须存在，并且满足 `status=active`、`visibility=public`、`audit_status=approved`、未删除、非头像用途。
- 个人主页精选列表接口已存在：`POST /api/profile/featured/media/list`。本计划需要保留它，并修正读取过滤规则。
- 个人主页精选只能由本人设置：写入口只有 `/api/profile/featured/media/update`，只允许当前登录用户修改自己的精选，不允许传 `userId` 修改别人。
- 管理员接口不提供“替别人设置个人主页精选”的能力；管理员如果要设置个人主页精选，也只能作为普通用户修改自己的个人主页精选。
- 个人主页精选更新允许传空 `mediaAssetIds`，用于清空个人精选。
- 个人主页精选更新必须校验每个 ID 都属于当前登录用户，并且满足 `status=active`、`visibility=public`、`audit_status=approved`、未删除、非头像用途。
- MVP 阶段首页精选和个人主页精选各自最多允许 20 张人工精选。公开读取 `pageSize` 默认 20，最大 60，给后续复用保留空间。

---

### 任务 1：精选通用规则

**文件：**
- 新建：`internal/logic/media/featured.go`
- 新建：`internal/logic/media/featured_test.go`

- [ ] 为 `normalizeFeaturedMediaPageSize` 先写失败测试。
  - `0` 返回 `20`。
  - `21` 返回 `21`。
  - `61` 返回 BadRequest，错误文案包含 `pageSize 不能超过 60`。

- [ ] 为 `parseFeaturedMediaAssetIDs` 先写失败测试。
  - 输入 `["7", "2", "7", ""]` 返回 `[7, 2]`。
  - 输入 `["0"]` 返回 BadRequest。
  - 输入 `["abc"]` 返回 BadRequest。
  - 输入数量超过 20 返回 BadRequest，错误文案包含 `精选照片不能超过 20 张`。

- [ ] 在 `internal/logic/media/featured.go` 中实现常量。

```go
const (
	defaultFeaturedMediaPageSize = 20
	maxFeaturedMediaPageSize     = 60
	maxManualFeaturedMediaCount  = 20

	featuredMediaOwnerTypeHome = "site_home"
	featuredMediaOwnerID       = uint64(1)
	featuredMediaLinkRole      = "featured"
	featuredMediaOwnerTypeProfile = "user_profile"
)
```

- [ ] 实现 `normalizeFeaturedMediaPageSize(pageSize int64) (int64, error)` 和 `parseFeaturedMediaAssetIDs(raw []string) ([]uint64, error)`。

- [ ] 运行：

```bash
go test ./internal/logic/media -run 'TestNormalizeFeatured|TestParseFeatured' -v
```

预期：新增测试全部通过。

---

### 任务 2：公开审核通过媒体查询

**文件：**
- 修改：`model/mediaassetmodel.go`
- 修改：`model/mediaassetmodel_test.go`

- [ ] 在 `MediaAssetModel` 增加 `FindPublicApprovedByIDs(ctx context.Context, ids []uint64) (map[uint64]*MediaAsset, error)`。

- [ ] 在 `MediaAssetModel` 增加 `FindOwnerPublicApprovedByIDs(ctx context.Context, ownerUserID uint64, ids []uint64) (map[uint64]*MediaAsset, error)`。

- [ ] 查询条件必须包含：

```sql
`id` in (...)
and `status` = 'active'
and `visibility` = 'public'
and `audit_status` = 'approved'
and `deleted_at` is null
and coalesce(json_unquote(json_extract(`metadata_json`, '$.usageType')), 'media') <> 'avatar'
```

- [ ] `FindOwnerPublicApprovedByIDs` 必须在上面的条件基础上额外包含：

```sql
and `owner_user_id` = ?
```

- [ ] 方法返回 `map[media_asset.id]*MediaAsset`；调用方通过遍历原始 ID 切片来保持请求顺序。

- [ ] 在 `model/mediaassetmodel_test.go` 增加源码级测试，守卫查询体包含 `visibility`、`audit_status`、`$.usageType`、`avatar`、`owner_user_id`。

- [ ] 运行：

```bash
go test ./model -run 'TestMediaAssetPublicApproved' -v
```

预期：查询约束守卫测试通过。

---

### 任务 3：公开首页精选列表逻辑

**文件：**
- 修改：`api/discover_world.api`
- 修改：`internal/types/media.go`
- 新建：`internal/logic/media/getfeaturedmediaassetlistlogic.go`
- 新建：`internal/handler/media/getfeaturedmediaassetlisthandler.go`
- 修改：`internal/handler/routes.go`

- [ ] 增加 API 类型：

```go
FeaturedMediaListRequest {
    PageSize int64               `json:"pageSize,optional"`
    Variant  MediaVariantRequest `json:"variantOption,optional"`
}
```

- [ ] 在现有公开 media 服务中增加路由：

```go
@handler GetFeaturedMediaAssetList
post /media/featured/list (FeaturedMediaListRequest) returns (MediaAssetPageResponse)
```

- [ ] 逻辑流程：
  - 标准化分页大小。
  - 通过 `AssetLinkModel.FindActiveAssetIDsByOwner(ctx, "site_home", 1, "featured", pageSize)` 读取精选媒体 ID。
  - 如果存在精选 ID，使用 `MediaAssetModel.FindPublicApprovedByIDs` 查询媒体。
  - 遍历 ID 切片并追加映射中存在的媒体，保持 `asset_link.sort_order` 顺序。
  - 如果不存在精选 ID，使用现有 `buildPublicMediaAssetListWhere(mediaListFilter{})` 和 `FindByWhere(..., "`id` desc", pageSize, 0, ...)` 回退到最新公开且审核通过媒体。
  - 使用 `BuildMediaAssetListResponse(ctx, svcCtx, assets, nil, req.Variant)` 构造响应。

- [ ] 返回：

```go
&types.MediaAssetPageResponse{
    PageNum:  1,
    PageSize: pageSize,
    Total:    int64(len(list)),
    List:     list,
}
```

- [ ] 运行：

```bash
go test ./internal/logic/media -run 'TestFeatured' -v
```

预期：辅助函数测试通过。路由行为在准备好数据库测试数据后再手动验证。

---

### 任务 4：个人主页精选读取和更新

**文件：**
- 修改：`api/discover_world.api`
- 修改：`internal/types/profile.go`
- 修改：`internal/logic/profile/common.go`
- 修改：`internal/logic/profile/getprofilefeaturedmedialistlogic.go`
- 新建：`internal/logic/profile/updateprofilefeaturedmedialogic.go`
- 新建：`internal/handler/profile/updateprofilefeaturedmediahandler.go`
- 修改：`internal/handler/routes.go`

- [ ] 增加 API 类型：

```go
UpdateProfileFeaturedMediaRequest {
    MediaAssetIds []string `json:"mediaAssetIds,optional"`
}
```

- [ ] 在现有 profile JWT service 中保留读接口，并新增更新接口：

```go
@handler GetProfileFeaturedMediaList
post /profile/featured/media/list (ProfileFeaturedMediaListRequest) returns (MediaAssetPageResponse)

@handler UpdateProfileFeaturedMedia
post /profile/featured/media/update (UpdateProfileFeaturedMediaRequest) returns (MediaAssetPageResponse)
```

- [ ] 在 `internal/logic/profile/common.go` 增加 `ensureProfileForAccount(ctx, svcCtx, account)`：
  - 先用 `UserProfileModel.FindOneByUserId` 查询。
  - 如果存在则返回。
  - 如果不存在则创建 `UserProfile{UserId: account.Id, Nickname: optionalString(account.Username)}`。
  - 创建失败返回 `创建用户资料失败`。
  - 创建成功后重新查询并返回完整 profile。

- [ ] 修正 `GetProfileFeaturedMediaListLogic`：
  - 保持 `userId` 可选，默认当前登录用户。
  - 继续通过 `loadProfileTarget` 支持查看指定用户。
  - 读取 `asset_link(owner_type=user_profile, owner_id=user_profile.id, link_role=featured)`。
  - 使用 `MediaAssetModel.FindPublicApprovedByIDs` 查询媒体，避免把私有、未审核、头像、已删除资源返回给其他用户。
  - 按 `asset_link.sort_order` 返回。

- [ ] 实现 `UpdateProfileFeaturedMediaLogic`：
  - 使用 `LoadRequiredLoginUser` 读取当前登录用户。
  - 调用 `ensureProfileForAccount`，确保当前用户存在 `user_profile`。
  - 使用 `parseFeaturedMediaAssetIDs` 解析并去重 ID。
  - 非空输入时调用 `FindOwnerPublicApprovedByIDs(ctx, loginUser.Id, ids)`。
  - 如果任意 ID 不属于当前用户，或不是公开审核通过媒体，返回 BadRequest：`个人精选照片必须是自己的公开且审核通过图片`。
  - 使用 `svcCtx.Transact` 包裹事务，在事务内调用 `AssetLinkModel.ReplaceActiveAssetIDsByOwner(ctx, "user_profile", userProfile.Id, "featured", ids)`。
  - 变更完成后返回当前用户保存后的有序精选列表。

- [ ] 运行：

```bash
go test ./internal/logic/profile ./internal/logic/media ./model -run 'TestFeatured|TestNormalizeFeatured|TestParseFeatured|TestMediaAssetPublicApproved' -v
```

预期：个人主页精选规则测试和媒体查询守卫测试通过。

---

### 任务 5：首页精选管理员列表和更新

**文件：**
- 修改：`api/discover_world.api`
- 修改：`internal/types/media.go`
- 新建：`internal/logic/admin/getfeaturedmediaassetlistlogic.go`
- 新建：`internal/logic/admin/updatefeaturedmediaassetslogic.go`
- 新建：`internal/handler/admin/getfeaturedmediaassetlisthandler.go`
- 新建：`internal/handler/admin/updatefeaturedmediaassetshandler.go`
- 修改：`internal/handler/routes.go`

- [ ] 增加 API 类型：

```go
UpdateFeaturedMediaRequest {
    MediaAssetIds []string `json:"mediaAssetIds,optional"`
}
```

- [ ] 在 `/api/admin` 下增加管理员路由，复用现有 `AdminCheck`：

```go
@handler GetFeaturedMediaAssetList
post /media/featured/list (FeaturedMediaListRequest) returns (MediaAssetPageResponse)

@handler UpdateFeaturedMediaAssets
post /media/featured/update (UpdateFeaturedMediaRequest) returns (MediaAssetPageResponse)
```

- [ ] 首页精选管理员列表：
  - 通过现有中间件校验管理员身份；如果逻辑需要 viewer 权限，再调用 `LoadRequiredAdminUser`。
  - 只读取 `asset_link(owner_type=site_home, owner_id=1, link_role=featured)` 中的精选 ID，不做回退。
  - 使用 `FindPublicApprovedByIDs` 查询媒体。
  - 按精选顺序返回列表。

- [ ] 首页精选管理员更新：
  - 使用 `parseFeaturedMediaAssetIDs` 解析并去重 ID。
  - 非空输入时调用 `FindPublicApprovedByIDs`，并校验每个解析后的 ID 都存在于返回映射中。
  - 如果任意 ID 缺失，返回 BadRequest：`精选照片必须是公开且审核通过的图片`。
  - 使用 `svcCtx.Transact` 包裹事务，在事务内调用 `AssetLinkModel.ReplaceActiveAssetIDsByOwner(ctx, "site_home", 1, "featured", ids)`。
  - 变更完成后返回保存后的有序列表。

- [ ] 运行：

```bash
go test ./internal/logic/admin ./internal/logic/media -run 'TestFeatured|TestNormalizeFeatured|TestParseFeatured' -v
```

预期：辅助函数和规则测试通过。

---

### 任务 6：验证和前端交接

**文件：**
- 所有变更过的后端文件。
- 可选后续：`frontend/src/hooks/useInfinitePictures.ts` 或新的 `fetchFeaturedMediaList` API 封装。

- [ ] 运行后端检查：

```bash
go test ./internal/logic/media ./internal/logic/admin ./model
go test ./...
go build ./...
```

- [ ] 数据库中有公开且审核通过媒体后，手动冒烟测试公开接口：

```bash
curl -X POST http://127.0.0.1:<port>/api/media/featured/list \
  -H 'Content-Type: application/json' \
  -d '{"pageSize":20,"variantOption":{"compressType":2}}'
```

预期：响应 `list` 包含公开且审核通过的媒体，每个条目都有压缩后的 URL。

- [ ] 手动冒烟测试管理员链路：
  - 使用 `/api/admin/media/list` 找到公开且审核通过的媒体 ID。
  - 携带管理员 token 调用 `/api/admin/media/featured/update`，提交这些 ID。
  - 调用 `/api/media/featured/list`，确认返回顺序与提交顺序一致。

- [ ] 手动冒烟测试个人主页精选链路：
  - 登录普通用户。
  - 使用该用户自己的公开且审核通过媒体 ID 调用 `/api/profile/featured/media/update`。
  - 调用 `/api/profile/featured/media/list`，确认返回顺序与提交顺序一致。
  - 使用另一个用户的媒体 ID 调用 `/api/profile/featured/media/update`，确认返回 BadRequest。

- [ ] 前端交接：
  - 在 `frontend/src/lib/api.ts` 增加 `fetchFeaturedMediaList`。
  - 在 `frontend/src/lib/api.ts` 增加 `updateProfileFeaturedMedia`。
  - 首页精选流请求 `{ pageSize: 20, variantOption: { compressType: 2 } }`。
  - 个人主页“精选”管理使用 `/api/profile/featured/media/update` 保存顺序。
  - 保持 `PictureCard` 只展示图片的行为，并避免使用带原图 URL 的 `srcSet`，防止高 DPR 浏览器绕过压缩图。
