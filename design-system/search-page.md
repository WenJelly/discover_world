# 搜索页面设计系统

## 概述

基于 UI/UX Pro Max 设计引擎生成的 **Vibrant & Block-based** 风格设计系统，应用于 Discover World 搜索页面重新设计。

---

## 设计模式

**Pattern:** Marketplace / Directory  
**核心策略:** 搜索栏是主要 CTA，减少搜索摩擦，提供热门搜索建议

### 关键元素
1. Hero Search Bar - 大胆、突出的搜索框
2. 分组结果 - 图片、动态、相册、用户
3. 建议关键词 - 降低搜索门槛
4. 最近搜索记录 - 提升重复搜索效率

---

## 视觉风格

**Style:** Vibrant & Block-based  
**关键词:** 大胆、活力、几何形状、高对比度、现代、年轻化

### 适用场景
- 创业公司、创意机构
- 游戏、社交媒体
- 年轻用户群、娱乐、消费类产品

### 暗色模式支持
✓ 完整支持 Light/Dark 模式

---

## 配色方案

基于玫瑰红 + 活力蓝的双色系统：

| 角色 | 颜色 | Hex | 用途 |
|------|------|-----|------|
| **Primary** | 玫瑰红 | `#E11D48` | 主要品牌色、高亮、搜索按钮 |
| **Secondary** | 浅玫瑰 | `#FB7185` | 次要元素、渐变 |
| **Accent/CTA** | 活力蓝 | `#2563EB` | 行动召唤、链接、交互元素 |
| **Background** | 浅粉背景 | `#FFF1F2` | 页面背景（渐变） |
| **Foreground** | 深玫瑰 | `#881337` | 文本主色 |
| **Border** | 粉色边框 | `#FECDD3` | 分隔线、卡片边框 |

### CSS 变量
```css
--color-primary: #E11D48
--color-secondary: #FB7185
--color-accent: #2563EB
--color-background: #FFF1F2
--color-foreground: #881337
--color-border: #FECDD3
```

### 对比度标准
- 正文文本：≥ 4.5:1 (WCAG AA)
- 大标题：≥ 3:1
- 所有交互元素必须满足对比度要求

---

## 字体系统

### 标题字体
**Righteous**  
- 用途：页面标题、章节标题、CTA 按钮
- 风格：大胆、有趣、娱乐感
- 字重：Regular (400)

### 正文字体
**Poppins**  
- 用途：正文、描述、标签、辅助文本
- 风格：现代、清晰、易读
- 字重：Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700)

### Google Fonts 导入
```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Righteous&display=swap');
```

### 字体使用规范
```css
--font-heading: 'Righteous', sans-serif;
--font-sans: 'Poppins', sans-serif;

/* 应用 */
h1, h2, h3, .section-title { font-family: var(--font-heading); }
body, p, span { font-family: var(--font-sans); }
```

### 字阶系统
- H1 (页面标题): 3xl (1.875rem / 30px) - Bold
- H2 (分组标题): lg (1.125rem / 18px) - Bold  
- H3 (卡片标题): sm (0.875rem / 14px) - Bold
- Body: base (1rem / 16px) - Regular
- Small: sm (0.875rem / 14px) - Regular
- Tiny: xs (0.75rem / 12px) - Medium

---

## 间距系统

**基础单位:** 4px / 8px (Material Design 8dp 系统)

### 间距规范
```
gap-3  = 12px  - 小间距（卡片内元素）
gap-4  = 16px  - 中等间距（表单元素）
gap-6  = 24px  - 大间距（卡片之间）
gap-10 = 40px  - 特大间距（章节之间）
gap-12 = 48px  - 超大间距（页面顶部）
```

### 内边距规范
```
p-4  = 16px - 卡片内容
p-5  = 20px - 动态卡片
p-16 = 64px - 空状态容器
p-20 = 80px - 页面底部
```

---

## 圆角系统

**Vibrant & Block-based** 风格使用较大的圆角增强亲和力：

```css
rounded-lg   = 8px   - 小按钮、标签
rounded-xl   = 12px  - 输入框、小卡片
rounded-2xl  = 16px  - 主要卡片
rounded-3xl  = 24px  - 大型容器、空状态图标
rounded-full = 999px - 圆形头像、药丸按钮
```

---

## 阴影系统

### 卡片阴影
```css
/* 默认 */
shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)

/* 悬停 */
shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1)

/* 彩色阴影（玫瑰红） */
shadow-rose-500/10: 0 20px 25px -5px rgba(225, 29, 72, 0.1)

/* 彩色阴影（蓝色） */
shadow-blue-500/10: 0 20px 25px -5px rgba(37, 99, 235, 0.1)
```

---

## 动画系统

### 时间规范
- **微交互:** 200-250ms (按钮、悬停)
- **页面切换:** 220ms (标签页、结果切换)
- **加载动画:** 1.5s (骨架屏循环)

### 缓动函数
```css
/* 通用 */
ease-out: cubic-bezier(0, 0, 0.2, 1)

/* 弹簧动画（标签页） */
spring: type: "spring", stiffness: 500, damping: 35
```

### 动画应用
```css
/* 卡片悬停 */
transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
hover:translate-y(-4px)
hover:shadow-xl

/* 按钮反馈 */
transition: all 200ms ease-out;
active:scale-95
```

### 无障碍支持
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 组件规范

### 搜索框
```
高度: 56px (h-14)
圆角: rounded-2xl
边框: 2px solid
内边距: pl-12 pr-12
图标大小: size-5 (20px)
```

### 搜索按钮
```
高度: 56px (h-14)
圆角: rounded-2xl
背景: 渐变 (from-rose-600 to-pink-600)
内边距: px-8
字重: font-bold
```

### 结果卡片
```
圆角: rounded-2xl
边框: 2px solid border-slate-200
阴影: shadow-md
悬停: border-rose-300 + shadow-xl + translate-y(-4px)
```

### 标签页按钮
```
圆角: rounded-xl
内边距: px-5 py-2.5
字重: font-bold
激活: 渐变背景 (from-rose-600 to-pink-600)
```

### 头像
```
大小: size-11 (44px) / size-12 (48px)
圆角: rounded-full
装饰: ring-2 ring-slate-100 ring-offset-2
```

---

## 状态设计

### 加载状态
- **骨架屏:** 渐变动画，1.5s 循环
- **加载图标:** 玫瑰红色旋转图标
- **延迟阈值:** 300ms 后显示加载反馈

### 空状态
- **图标:** size-20 (80px), 渐变背景
- **标题:** 2xl, font-bold
- **描述:** base, 柔和灰色
- **行动:** 突出的重试按钮

### 错误状态
- **颜色:** 红色系 (red-600, red-700)
- **背景:** 渐变 (from-red-50 to-rose-50)
- **图标:** size-16 (64px)
- **重试按钮:** 明确可见

---

## 交互规范

### 触摸目标
- **最小尺寸:** 44×44pt (iOS) / 48×48dp (Android)
- **间距:** ≥ 8px 触摸目标之间

### 悬停反馈
- **卡片:** translate-y(-4px) + 阴影增强
- **按钮:** 背景加深 + 阴影
- **链接:** 颜色变化（rose-600）
- **时间:** 200-250ms

### 焦点状态
```css
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-rose-500/30
```

### cursor-pointer
所有可点击元素必须添加 `cursor-pointer` 类或样式

---

## 无障碍清单

### 必须实现
- [x] 对比度 ≥ 4.5:1 (正文)
- [x] 对比度 ≥ 3:1 (大文本)
- [x] 键盘导航支持
- [x] Focus 可见状态
- [x] Alt text 图片描述
- [x] ARIA labels 按钮标签
- [x] prefers-reduced-motion 支持
- [x] 语义化 HTML (section, article, nav)
- [x] Tab 顺序符合视觉顺序

---

## 性能优化

### 图片优化
```html
loading="lazy"              <!-- 懒加载 -->
width/height 属性           <!-- 防止 CLS -->
```

### 字体加载
```css
font-display: swap;         <!-- 避免 FOIT -->
```

### 动画性能
```css
transform: translateY()     <!-- GPU 加速 -->
opacity                     <!-- GPU 加速 -->
/* 避免 width/height/top/left */
```

---

## 代码示例

### 搜索框组件
```tsx
<Input
  type="search"
  className="h-14 cursor-text rounded-2xl border-2 border-slate-200 
    bg-white pl-12 text-base shadow-md transition-all duration-250 
    hover:border-slate-300 hover:shadow-lg 
    focus:border-rose-400 focus:ring-4 focus:ring-rose-500/20"
  placeholder="搜索图片、动态、相册、用户"
  aria-label="搜索全站内容"
/>
```

### 结果卡片
```tsx
<article className="cursor-pointer rounded-2xl border-2 border-slate-200 
  bg-white shadow-md transition-all duration-250 
  hover:-translate-y-1 hover:border-rose-300 hover:shadow-xl 
  hover:shadow-rose-500/10 motion-reduce:hover:translate-y-0">
  {/* 内容 */}
</article>
```

---

## 反模式（避免）

### 视觉
- ❌ 重度拟物化（skeuomorphism）
- ❌ 过度装饰阴影
- ❌ 混合多种风格
- ❌ 使用 emoji 作为结构性图标

### 交互
- ❌ 仅依赖悬停状态
- ❌ 瞬时状态变化（0ms）
- ❌ 阻塞性动画
- ❌ 移除焦点环

### 无障碍
- ❌ 低对比度文本
- ❌ 仅用颜色传达信息
- ❌ 缺少键盘支持
- ❌ 忽略 reduced-motion

---

## 浏览器支持

- Chrome/Edge: 最新 2 个版本
- Firefox: 最新 2 个版本
- Safari: 最新 2 个版本
- iOS Safari: 14+
- Android Chrome: 最新版本

---

## 设计工具链

- **UI 框架:** React + TypeScript
- **样式:** Tailwind CSS
- **动画:** Framer Motion
- **图标:** Lucide React
- **组件库:** shadcn/ui
- **字体:** Google Fonts

---

## 更新日志

### v1.0.0 - 2026-07-07
- 初始设计系统发布
- 基于 UI/UX Pro Max 引擎生成
- 应用 Vibrant & Block-based 风格
- 完整无障碍支持
- 响应式设计（375px - 1440px+）

---

## 参考资料

- [UI/UX Pro Max Design Intelligence](https://github.com/...)
- [Material Design 3](https://m3.material.io/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/)
- [Web.dev Performance](https://web.dev/performance/)
