# Product

## Register

product

## Users

中文世界的摄影创作者与图片发现者。他们在桌面与移动端浏览器中使用本站：浏览公开图库、管理个人主页、上传自己的作品。上传场景下用户已登录，处于"分享一张作品"的专注任务流中——选图、填信息、确认、等待审核结果。他们熟悉 500px / 图虫 / Instagram 一类的图片社区，对标准上传交互有明确预期。

## Product Purpose

discover_world 是一个摄影发现与分享平台：用户上传作品 → 进入社区审核 → 通过后向所有人公开浏览与下载。上传是这个产品最关键的"贡献"动作——它把私有图片变成公共内容。上传体验必须让人放心：清晰的状态反馈、可预览、可修正、失败可恢复、成功有明确确认，且视觉上与图库/主页一致，不让人怀疑"这是不是另一个产品"。

## Brand Personality

克制、内容优先、可信。三个词：calm / credible / content-first。照片才是主角，UI 不抢戏。情绪目标是"平静的自信"——用户觉得自己在一个工整、专业的场所做一件正经事，而不是在一个花哨的社交 app 里博眼球。

## Anti-references

- 不要 indigo→purple 渐变按钮 / emerald 成功大色块这类"AI 上传卡片"套路（当前 ImageUploadCard 即是此问题）。
- 不要 cream / sand / 暖白底——本站是中性灰系统，不是 2026 AI 暖中性默认。
- 不要为上传动作发明非标准模态或自定义滚动条 / 怪异表单控件。
- 不要装饰性动效（无关的 pulse / ping / 渐变呼吸）；动效只传达状态。
- 不要卡片套卡片（dialog 里再嵌一个带边框 card）。

## Design Principles

1. **内容优先，UI 退让** — 照片预览是上传流的视觉中心，chrome 用中性灰退到背景。
2. **earned familiarity** — 用标准 dialog / input / button 词汇，做到无可挑剔，而非发明新 affordance。Linear / Figma 那一级的"熟悉的精确"。
3. **克制即品牌** — 全站中性色系统（OKLCH 零色度），强调色仅用于主行动与状态指示，不做装饰用色。
4. **show, don't tell** — 上传前预览图、自动从文件名填标题、成功后展示资源标题而非只给一个 toast。
5. **practice what you preach** — 上传 UI 的打磨程度必须等同于图库与主页，不能因为是"工具页"就降级。

## Accessibility & Inclusion

- WCAG 2.1 AA：正文 ≥4.5:1，大字 ≥3:1，占位符同样 4.5:1（不用 muted-gray 默认）。
- 所有交互键盘可达：dialog 焦点陷阱、ESC 关闭、Enter/Space 触发选图、Tab 顺序合理。
- `prefers-reduced-motion`：动效降级为淡入或瞬时（项目已全局支持，组件层遵守）。
- 表单 label 与控件正确关联（htmlFor + id），错误用 `aria-invalid` + 文字说明，不仅靠颜色。
- 上传中阻止误关弹窗（关闭按钮 disabled，backdrop/ESC 忽略），避免丢失进行中的请求。
