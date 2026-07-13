# 后台运营与审计中心前端设计

日期：2026-07-13
状态：已确认
范围：前端第二阶段，实现运营概览、标签管理和操作审计，并整理现有后台面板边界

## 1. 背景与目标

第一阶段已经在 `/admin` 建立 shadcn Sidebar 管理工作区，并完成首页配置、媒体审核、举报工单与内容治理。后端还提供运营概览、标签更新与合并、精选内容、操作日志和管理员账号更新接口，但当前前端没有对应的运营与审计页面。

本阶段目标：

- 将 `/admin` 默认入口调整为运营概览。
- 增加运营概览、标签管理和操作审计栏目。
- 让待审核媒体和待处理举报成为可直接进入工作区的待办入口。
- 提供标签编辑、启停与合并流程，并要求记录操作原因。
- 提供只读、可深链接的操作日志列表与详情。
- 将现有首页配置和媒体审核从 `AdminPage.tsx` 拆为独立面板，避免后台入口继续膨胀。

本阶段不实现账号管理、标签创建或删除、操作日志导出，也不单独建立“精选内容”页面。

## 2. 后台信息架构

后台继续使用单一路由 `/admin`，栏目由查询参数保存：

```text
/admin?tab=dashboard
/admin?tab=homepage
/admin?tab=media-review
/admin?tab=reports
/admin?tab=moderation
/admin?tab=tags
/admin?tab=audit
```

缺少或无法识别的 `tab` 回退到 `dashboard`。原有显式链接 `/admin?tab=homepage`、`/admin?tab=media-review`、`/admin?tab=reports` 和 `/admin?tab=moderation` 保持兼容。

侧边栏分组：

- 运营概览
  - 数据概览
- 内容管理
  - 首页配置
  - 媒体审核
  - 举报工单
  - 内容治理
- 运营管理
  - 标签管理
  - 操作审计

### 2.1 页面与文件边界

- `frontend/src/pages/AdminPage.tsx`：管理员权限守卫、Sidebar、URL 状态和面板分发。
- `frontend/src/components/admin/AdminDashboardPanel.tsx`：统计、待办入口和最近操作。
- `frontend/src/components/admin/AdminTagManagementPanel.tsx`：标签列表、编辑和合并。
- `frontend/src/components/admin/AdminAuditPanel.tsx`：操作日志列表、筛选和详情。
- `frontend/src/components/admin/AdminHomepagePanel.tsx`：承接现有首页配置逻辑和界面。
- `frontend/src/components/admin/AdminMediaReviewPanel.tsx`：承接现有媒体审核逻辑和界面。
- `frontend/src/components/admin/AdminSidebar.tsx`：分组导航和移动端侧边栏关闭行为。
- `frontend/src/lib/admin-navigation.ts`：栏目与审计日志 URL 参数解析、构建。
- `frontend/src/lib/admin-operation.ts`：操作名称映射和 JSON 安全解析纯函数。
- `frontend/src/lib/types.ts`：新增运营、标签和操作日志类型。
- `frontend/src/lib/api.ts`：新增管理端运营与审计请求函数。

首页配置和媒体审核只做职责迁移，不在本阶段进行视觉重做或业务增强。

## 3. 运营概览

运营概览由待办事项、站点规模和最近操作三部分组成。

### 3.1 待办事项

- 待审核媒体数，点击进入 `/admin?tab=media-review`。
- 待处理举报数，点击进入 `/admin?tab=reports`。

待办项使用明确的数字、名称和跳转提示，不使用趋势箭头或虚构变化率。

### 3.2 站点规模

- 活跃用户数。
- 公开作品数，点击进入公开发现页。
- 公开动态数，点击进入公开动态页。

当前没有管理员账号列表接口，因此活跃用户卡片只展示数据，不提供后台跳转。

`AdminDashboardResponse` 虽然包含 `recentMediaCount`、`recentPostCount` 和 `recentReportCount`，但当前后端未填充这些字段。本阶段不展示这三个指标，避免将缺失数据表现为真实的零增长。

### 3.3 最近操作

最近操作通过操作日志列表接口获取最新 5 条记录，显示：

- 操作管理员。
- 中文操作名称。
- 目标类型和目标 ID。
- 原因摘要。
- 操作时间。

点击记录跳转到：

```text
/admin?tab=audit&logId=<日志ID>
```

页面提供“查看全部操作日志”入口。概览统计与最近操作并行加载，其中一块失败不影响另一块展示。

## 4. 标签管理

标签管理使用“筛选、表格、编辑对话框、合并对话框”结构。

### 4.1 列表与筛选

- 标签名称模糊搜索。
- 标签类型筛选。
- 状态筛选：启用或停用，默认启用。
- 服务端分页，每页 20 条。

表格列：名称、slug、类型、状态、创建时间和操作。

当前后端的 `status` 使用 `int64` 数值零值，无法区分“未传 status”和“status=0”。为避免本阶段扩大到后端契约修改，前端只提供启用与停用筛选，不提供全部状态。

### 4.2 编辑标签

可修改：

- 名称。
- slug。
- 标签类型。
- 启用状态。
- 修改原因。

修改原因由前端设为必填。提交时始终发送标签的完整当前值，尤其始终发送当前 `status`，避免未修改状态被 Go 数值零值解释为停用。

成功后使用接口返回值原地更新对应表格行并显示 Sonner 反馈；失败时保留表单输入，允许直接重试。

### 4.3 合并标签

- 从标签行发起，源标签不可更换。
- 目标标签只能选择其他启用标签。
- 源标签与目标标签不能相同。
- 合并原因必填。
- 提交前明确说明：标签关联将迁移到目标标签，源标签会被停用。

合并成功后刷新当前页并优先选中或突出目标标签。失败时保留目标选择和原因。

本阶段不提供标签创建、删除、批量编辑或批量合并，因为后端没有对应接口或明确语义。

## 5. 操作审计

操作审计使用与举报工单一致的列表与详情分栏。桌面端左右布局，移动端上下布局。

### 5.1 列表与筛选

- 操作管理员 ID。
- 操作类型。
- 目标类型。
- 目标 ID。
- 创建时间范围。
- 服务端分页，每页 20 条。

列表项显示管理员、中文操作名称、目标、原因摘要和时间。没有 `logId` 的首次加载自动选择当前页第一条。管理员主动提交筛选、清除筛选或翻页时先清除旧选择，再选择新列表第一条。

### 5.2 详情与深链接

详情显示：

- 管理员账号摘要和 ID。
- 操作类型、目标类型和目标 ID。
- 操作原因、客户端 IP 和操作时间。
- `BeforeJson`、`AfterJson`、`MetadataJson`。

点击列表项时同步更新 `logId`。刷新或直接访问 `/admin?tab=audit&logId=<日志ID>` 时保留该初始深链接；即使记录不在当前列表页，详情接口也独立加载，不强制改变当前筛选条件。管理员随后主动筛选或翻页时结束该深链接保留状态，清除旧 `logId` 并选择新结果第一条。切换离开审计栏目时移除 `logId`。

JSON 能正常解析时使用格式化代码块展示；解析失败时展示原始字符串。Before/After 在桌面端左右排列，在移动端上下排列。本阶段不引入复杂 JSON diff 库。

### 5.3 操作名称

已知操作映射为中文，包括：

- `tag.update`：更新标签。
- `tag.merge`：合并标签。
- `content.feature`：设为精选。
- `content.unfeature`：取消精选。
- 举报处理、动态治理、评论治理和论坛治理操作。

未知操作保留后端原始值，不映射为“其他”或空白。

操作日志保持只读，不提供编辑、删除或导出功能。

## 6. 精选内容与账号管理边界

后端精选接口当前只接受 `media_asset`，并操作与首页精选相同的站点精选关系。现有首页配置已经支持批量选择和排序，因此本阶段不创建重复的精选页面，也不新增精选接口封装。后续如增强媒体审核，可将设为精选或取消精选作为审核后的快捷操作。

后端账号管理当前只有 `/api/admin/account/update`，没有管理员账号列表、搜索或详情接口，无法建立可靠的账号管理工作区。账号管理留到后端补齐查询能力后再设计。

## 7. API 与类型

新增前端请求函数：

```text
fetchAdminDashboard
fetchAdminTagList
updateAdminTag
mergeAdminTag
fetchAdminOperationLogList
fetchAdminOperationLogDetail
```

对应类型与 `api/discover_world.api` 保持一致：

- `AdminDashboardRequest`
- `AdminDashboardResponse`
- `AdminTagQueryRequest`
- `AdminTagUpdateRequest`
- `AdminTagMergeRequest`
- `AdminTagResponse`
- `AdminTagPageResponse`
- `AdminOperationLogQueryRequest`
- `AdminOperationLogDetailRequest`
- `AdminOperationLogResponse`
- `AdminOperationLogPageResponse`

所有 ID 保持字符串类型。前端不解析或转换为 JavaScript `number`。

## 8. 加载、空状态与错误处理

- 首次加载使用与最终结构一致的骨架。
- 筛选和翻页期间保留当前数据并降低透明度。
- 概览统计与最近操作独立处理加载和错误状态。
- 标签更新或合并期间禁用重复提交，失败时保留用户输入。
- 审计列表失败不清空已经打开的详情，详情失败也不清空列表。
- 合法 JSON、非法 JSON 和空 JSON 均必须安全展示。
- 401/403 沿用统一 API 错误和管理员权限守卫。
- 空列表提供清除筛选或返回默认筛选入口。

## 9. 视觉与响应式

继续使用第一阶段确定的中性、克制、内容优先风格：

- 状态和主操作使用有限强调色。
- 不使用渐变文字、玻璃效果或装饰性图表。
- 数据卡片强调数字和跳转关系，不展示伪趋势。
- 标签表格在窄屏允许横向滚动，编辑和合并使用适配移动端的 Dialog。
- 审计列表与详情在小屏改为上下排列。
- 所有图标按钮提供可访问名称，表单控件具有标签和错误提示。

## 10. 测试与验收

遵循测试先行：

1. 增加新 tab、默认 dashboard、`logId` 解析和 URL 构建纯函数测试。
2. 增加操作名称映射、合法 JSON、非法 JSON 和空 JSON 安全解析测试。
3. 增加 API 路径、请求参数和响应类型契约测试。
4. 增加三个新面板、侧边栏分组及首页/媒体面板拆分的源码契约测试。
5. 标签合并覆盖源目标相同、原因为空、提交失败和成功刷新。
6. 审计详情覆盖当前页选择、跨页深链接和详情独立失败。

最终执行：

```bash
cd frontend
npm test
npm run lint
npm run build
```

浏览器验收：

- 桌面端验证侧边栏分组、默认 dashboard、概览跳转和列表/详情分栏。
- 移动端验证侧边栏抽屉、标签表格、编辑/合并 Dialog 和审计上下布局。
- 验证 `/admin?tab=audit&logId=...` 刷新和直接访问。
- 验证概览局部失败、标签写入失败、日志 JSON 解析失败等错误状态。

## 11. 明确不做

- 不新增或修改后端接口。
- 不展示后端未填充的 Recent 指标。
- 不提供标签全部状态筛选。
- 不提供标签创建、删除或批量操作。
- 不实现复杂 JSON diff、日志编辑、删除或导出。
- 不实现账号管理。
- 不创建独立精选内容页面。
- 不对首页配置和媒体审核进行视觉重做或业务增强。
