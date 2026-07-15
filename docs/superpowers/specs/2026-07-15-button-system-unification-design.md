# Discover World 前端按钮统一设计

日期：2026-07-15  
状态：用户已确认

## 背景

当前前端已经配置 shadcn `base-nova`，按钮基础组件位于 `frontend/src/components/ui/button.tsx`。该组件与当前 shadcn Base UI Button 的结构、variant 和 size 保持一致，但业务页面仍存在两类不一致：

1. 约 134 处 shadcn `<Button>` 用法中，部分页面通过 `className` 重新定义颜色、高度、圆角和 padding。
2. 70 处原生 `<button>` 同时承担操作按钮、标签页、列表行、图片卡片和选择项等不同职责。
3. 上传拖放区另有 1 处 `role="button"` 交互表面，需要纳入统一焦点规范。

这导致用户端和后台出现蓝色、靛蓝色、中性黑白等多套按钮风格，加载、禁用、焦点和图标尺寸也不统一。

## 目标

- 覆盖全部前端，包括用户端和后台管理页面。
- 保留现有 `base-nova` 中性黑白视觉，不引入新的品牌强调色。
- 真正的操作按钮统一使用 shadcn `<Button>`。
- 卡片、列表行、标签页和选择项保留正确的交互语义，不机械包装成普通按钮。
- 统一按钮的 variant、size、加载、禁用、焦点、选中和危险操作状态。
- 通过测试阻止业务页面重新产生独立按钮体系。

## 非目标

- 不重新设计页面布局、导航结构或信息架构。
- 不把 Tabs、Select、菜单项、图片卡片等组件全部重构为新的 shadcn 组件。
- 不修改后端接口、业务流程或文案含义。
- 不引入新的品牌色或修改现有全局主题变量。

## 已确认的设计方向

采用“语义分层统一”方案：

- 操作按钮使用 shadcn `<Button>`。
- 原生交互表面保留 `<button>`，但共享基础交互状态。
- 业务代码不再覆盖 Button 的颜色、高度、圆角和水平 padding。
- 允许业务代码设置宽度、定位、外边距、对齐和响应式布局等结构类。

## 组件架构

### shadcn Button

保留 `frontend/src/components/ui/button.tsx` 的官方 `base-nova` 实现，不创建新的业务 Button 包装层，也不添加项目专用颜色 variant。

统一使用现有 variant：

| Variant | 使用场景 |
| --- | --- |
| `default` | 页面或对话框中的唯一主操作，如发布、提交、查询、确认 |
| `outline` | 取消、重试、加载更多、返回等次要操作 |
| `secondary` | 已选中的模式、低强调切换状态 |
| `ghost` | 工具栏、清除筛选、辅助操作、无边框图标操作 |
| `destructive` | 删除、拒绝、移除等危险操作 |
| `link` | 登录/注册切换、忘记密码等内联文本操作 |

统一使用现有 size：

| Size | 使用场景 |
| --- | --- |
| `lg` | 页面级入口、空状态主操作 |
| `default` | 表单、对话框和常规页面操作 |
| `sm` | 后台工具栏、分页和紧凑区域 |
| `xs` | 极紧凑辅助操作，不用于主操作 |
| `icon` / `icon-sm` / `icon-xs` / `icon-lg` | 与对应文字按钮尺寸匹配的纯图标操作 |

### shadcn Spinner

通过官方命令安装 Spinner：

```bash
npx shadcn@latest add spinner
```

加载中的按钮遵循以下规则：

- 使用 `<Spinner aria-label="加载中" />`。
- 同时设置 `disabled` 和 `aria-busy="true"`，阻止重复提交。
- 保留明确的加载文案，如“发布中”“提交中”“加载中”。
- 不通过改变按钮宽高表示加载状态。

### 原生交互表面

新增 `frontend/src/lib/interactive-surface.ts`，只导出共享基础 class，不创建 React 包装组件。共享内容包括：

- `transition-colors`
- 统一的 `outline-none`
- `focus-visible:border-ring`
- `focus-visible:ring-3`
- `focus-visible:ring-ring/50`
- 统一禁用态

保留交互表面继续负责自身布局、hover 和 selected 外观，并使用 `aria-pressed`、`aria-selected` 或对应角色表达状态。

`frontend/src/components/ui/sidebar.tsx` 中 shadcn 生成的 `SidebarRail` 属于组件内部实现，不纳入业务按钮替换。

## 深色媒体覆盖层

图片预览、图片管理和深色媒体覆盖层中的按钮仍使用现有 Button variant。覆盖层根节点使用局部 `.dark` 主题，让 `secondary`、`ghost` 和 `destructive` 自动获得适合深色背景的颜色。

业务组件只保留定位和尺寸布局，不再分别维护 `bg-white/10`、`text-white`、自定义 focus outline 等按钮视觉规则。

## 迁移范围

### 原生按钮分类

当前 70 处原生按钮按已确认边界分为：

- 46 处操作按钮改用 shadcn Button。
- 24 处保留原生交互表面，其中包括 23 处业务交互表面和 1 处 shadcn `SidebarRail` 内部按钮。

此外，`UploadDialog` 的文件拖放区继续保留 `role="button"`，作为第 24 处业务交互表面使用共享状态规范。最终保留范围为 24 处业务交互表面和 1 处 shadcn 内部按钮。

主要替换目标包括：

- 用户端：重试、清除搜索、发布工具、通知入口、登录注册切换、导航菜单、关闭预览、轮播、下载、点赞、举报和删除。
- 后台：刷新、查询、清除筛选、媒体排序、移出精选、分页、处理和危险操作。
- 媒体区域：图片移除、图片预览操作和深色覆盖层工具。

主要保留目标包括：

- 图片卡片和媒体选择卡片。
- 通知条目、账号搜索结果和后台列表行。
- 页面标签、搜索分类标签和论坛板块选择项。
- 搜索建议和发布图片添加区域。
- 上传文件拖放区域。
- shadcn `SidebarRail`。

### 现有 shadcn Button 清理

逐项检查现有约 134 处 Button：

- 删除 `bg-blue-*`、`bg-indigo-*`、`text-white` 等业务颜色覆盖。
- 删除任意高度、圆角、水平 padding 和独立阴影覆盖。
- 将语义错误的 variant 调整为统一映射。
- 将纯图标按钮调整为对应 icon size，并补充 `aria-label`。
- 将重复的 `Loader2` / `LoaderCircle` 加载图标迁移到 Spinner。
- 保留 `w-full`、定位、间距、响应式和布局类。

## 交互与可访问性

- 每个页面区域只保留一个 `default` 主操作。
- 纯图标按钮必须有准确的中文 `aria-label`。
- 开关或选择按钮必须提供 `aria-pressed` 或 `aria-selected`。
- 菜单触发器继续提供 `aria-expanded` 和对应菜单语义。
- 加载按钮必须禁用，避免重复请求。
- 危险操作统一使用 `destructive`，不可使用普通 default 伪装。
- 键盘焦点全部使用 base-nova ring，不再混用蓝色或靛蓝色 focus ring。

## 错误和异步状态

- 页面级重试使用 `outline`，行内低强调重试使用 `ghost`。
- 提交、删除、审核和上传期间显示 Spinner，并保持加载文案。
- 异步失败继续由现有 Sonner 或页面错误区域反馈，按钮系统不增加新的通知机制。
- 请求失败后恢复按钮可操作状态，不改变原有业务回滚逻辑。

## 测试设计

实施时严格按测试先行执行。

新增按钮源码契约测试，至少覆盖：

1. 业务操作按钮不得继续使用未登记的原生 `<button>` 或 `role="button"`。
2. 保留的原生交互表面，包括 `role="button"` 拖放区，必须标记统一 `data-slot="interactive-surface"`，并使用共享状态 class。
3. shadcn Button 调用不得重新加入独立颜色、任意高度、圆角或水平 padding。
4. 纯图标 Button 必须提供 `aria-label`。
5. 已登记的加载操作必须使用 Spinner、disabled 和加载文案。

完整验证命令：

```bash
cd frontend
npm test
npm run lint
npm run build
```

视觉验收覆盖：

- 用户端：首页、发现、搜索、社区、通知、账号、上传、登录注册和图片详情。
- 后台：仪表盘、首页配置、媒体审核、内容治理、论坛治理、举报工单、标签和审计日志。
- 桌面与移动视口。
- 普通页面、对话框、加载、禁用、选中、危险操作和深色媒体覆盖层。

## 实施顺序

1. 先写按钮源码契约测试并确认按预期失败。
2. 使用 shadcn CLI 安装 Spinner。
3. 添加原生交互表面共享状态 class。
4. 迁移用户端操作按钮，并登记保留的交互表面。
5. 迁移后台操作按钮，并登记保留的列表和选择表面。
6. 清理现有 Button 的页面级视觉覆盖。
7. 运行完整测试、lint 和构建。
8. 在浏览器完成用户端、后台、桌面端和移动端视觉验收。

## 验收标准

- 全前端操作按钮均来自 `@/components/ui/button`。
- 原生 button 仅剩已登记的交互表面和 shadcn 内部实现。
- 页面中不再存在蓝色、靛蓝色或独立白色半透明按钮体系。
- variant、size、loading、disabled、focus、selected 和 destructive 状态符合本文映射。
- 所有新增契约测试和现有测试通过。
- `npm run lint` 与 `npm run build` 通过。
- 用户端和后台主要页面在桌面、移动视口下无布局回归。

## 参考

- shadcn Base UI Button：https://ui.shadcn.com/docs/components/base/button
- shadcn Base UI Spinner：https://ui.shadcn.com/docs/components/base/spinner
