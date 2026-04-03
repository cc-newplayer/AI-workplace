# 发布配置 publish-config.md v1.0

> 本文件定义内容生成后的网页化规范。每次执行 GUIDE.md STEP 6 并收到用户确认后，按此文件生成 HTML。

---

## 一、发布流程概述

每篇文章发布 = 以下 5 步全部完成，缺任何一步均属发布不完整：

| 步骤 | 操作 | 目标文件 |
|------|------|---------|
| Step 1 | 生成 HTML 文件 | `seo-farm\articles\NN_slug.html` |
| Step 2 | 更新主站文章列表 | `seo-farm\articles.html` 内联 articlesData |
| Step 3 | 更新首页搜索数据 | `seo-farm\script.js` articlesData |
| Step 4 | 更新文章索引 | `article-index.md` |
| Step 5 | 推送到 GitHub + 微信（可选）| `git push` + `wechat_publisher.js` |

---

## 二、HTML 模板规范

### 2.1 样式引用

所有生成的 HTML 文件必须引用共享样式文件：

```html
<link rel="stylesheet" href="style.css">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
```

`style.css` 路径规则：与 HTML 文件在**同一目录**下，使用相对路径。

> ⚠️ 若将来需要跨目录发布，改用绝对路径或在本节修改为内联 CSS 方案。

### 2.2 页面基础结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="[文章一句话摘要，用于 SEO]">
  <title>[文章标题]</title>
  <link rel="stylesheet" href="style.css">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body>
<div class="page-wrapper">
  <!-- article-header -->
  <!-- article-body -->
  <!-- article-footer -->
</div>
<script>
  mermaid.initialize({ startOnLoad: true, theme: 'default', flowchart: { curve: 'basis' } });
</script>
</body>
</html>
```

### 2.3 文章头部区域（article-header）

```html
<header class="article-header [style-b（深度科普时加）]">
  <div class="badge-row">
    <span class="badge [badge-tutorial | badge-deep]">[风格标签]</span>
    <span class="badge badge-meta">⏱ 约 X 分钟阅读</span>
    <span class="badge badge-meta">[主题标签]</span>
  </div>
  <h1>[文章标题]</h1>
  <p class="article-lead [style-b]">[前言：本文能做到什么 / 核心问题是什么]</p>
</header>
```

**风格对应关系：**

| 风格 | header class | badge class | badge 文字 | lead class |
|------|-------------|-------------|-----------|------------|
| 风格 A（保姆级教程） | `article-header` | `badge-tutorial` | 📘 保姆级教程 | `article-lead` |
| 风格 B（深度科普） | `article-header style-b` | `badge-deep` | 🔬 深度科普 | `article-lead style-b` |
| 风格 C（大众科普） | `article-header` | `badge-tutorial` | 🌐 大众科普 | `article-lead` |

### 2.4 必须使用的组件

所有文章都必须包含以下 HTML 组件，按实际内容选用：

| 组件 | class | 使用场景 |
|------|-------|---------|
| 步骤卡片 | `<div class="steps">` + `<div class="step">` | 风格 A 的每个操作步骤 |
| 提示框（绿） | `<div class="callout callout-tip">` | 💡 小技巧、推荐做法 |
| 警告框（黄） | `<div class="callout callout-warning">` | ⚠️ 容易出错的地方 |
| 信息框（蓝） | `<div class="callout callout-info">` | ℹ️ 背景知识、概念解释 |
| 流程图 | `<div class="diagram">` + Mermaid 代码块 | 步骤流程、架构关系 |
| 数据表格 | `<div class="table-wrapper"><table>` | 对比、参数说明 |
| 效果验证框 | `<div class="verify-box">` | 风格 A 文章末尾的验证清单 |
| FAQ | `<div class="faq">` + `<div class="faq-item">` | 常见问题 |
| 进阶引导 | `<div class="next-steps [style-b]">` | 文章结尾的延伸阅读 |

### 2.5 流程图规范

- **步骤流程（上下顺序）**：使用 `flowchart TD`
- **数据流 / 节点连接（左右顺序）**：使用 `flowchart LR`
- 节点颜色规范：

```
起始节点：fill:#EFF6FF,stroke:#2563EB,color:#1D4ED8（蓝）
结束节点：fill:#F0FDF4,stroke:#16A34A,color:#166534（绿）
判断节点：fill:#FFFBEB,stroke:#D97706,color:#92400E（黄）
核心/LLM节点：fill:#F5F3FF,stroke:#7C3AED,color:#5B21B6（紫）
```

---

## 三、输出文件规范

### 3.1 输出目录

```
C:\Users\admin\Desktop\seo-farm\articles\
```

如需更改输出目录，在此处修改，保持全局一致。

### 3.2 文件命名规则

```
[序号]_[主题slug].html
```

- 序号：两位数，按已有文件递增（当前最新：19）
- 主题 slug：英文小写 + 连字符，不含空格和特殊字符
- 示例：`19_crewai-intro.html`

### 3.3 同步更新 style.css

若生成的文章用到了 `style.css` 中**尚未定义**的新样式，需在 `style.css` 末尾追加，并注释说明是哪篇文章引入的。

---

## 四、发布检查清单（每篇文章必须全部完成）

> ⚠️ 以下 5 步是完整发布流程，缺任何一步都属于发布不完整

### Step 1 — 生成 HTML 文件
- [ ] 文件写入 `seo-farm\articles\[序号]_[slug].html`
- [ ] `<title>` 与文章标题一致
- [ ] `<meta name="description">` 已填写（15-30 字摘要）
- [ ] badge 风格标签与文章风格一致（A→蓝/B→紫/C→无badge）
- [ ] 文章页脚有参考来源

### Step 2 — 更新主站文章列表（articles.html）
- [ ] 在 `seo-farm\articles.html` 的内联 `articlesData` 数组**顶部**插入新文章条目
- [ ] 格式：`{ id: N, file: 'NN_slug.html', category: 'tutorial|deep|popular', title: '...', desc: '...' }`
- [ ] 新文章排在数组第一位（最新的显示在最前面）

### Step 3 — 更新首页搜索数据（script.js）
- [ ] 在 `seo-farm\script.js` 的 `articlesData` 数组中插入相同条目
- [ ] 格式额外需要 `keywords: ['关键词1', '关键词2']` 字段

### Step 4 — 更新文章索引
- [ ] 在 `article-index.md` 总览表末尾追加新行
- [ ] 更新顶部"最后更新"日期和总篇数
- [ ] 更新"风格分布统计"中对应风格的篇数和编号
- [ ] 在"话题覆盖地图"中标记已覆盖话题

### Step 5 — 微信公众号（如用户指令包含）
- [ ] 在 `agent st - 副本` 目录下运行：`node wechat_publisher.js "C:\Users\admin\Desktop\seo-farm\articles\NN_slug.html"`
- [ ] 注意：需要当前 IP 在微信公众号白名单中
