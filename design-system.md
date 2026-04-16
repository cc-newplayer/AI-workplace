# 设计系统 design-system.md v1.0
# ——网页样式 · 组件规范 · 发布配置 · 唯一改动入口

#
# ╔══════════════════════════════════════════════════════════╗
# ║  如何使用这个文件                                         ║
# ║                                                          ║
# ║  想改网页外观？  →  修改「二、设计令牌」里的变量值           ║
# ║  想改页面结构？  →  修改「四、页面结构模板」                 ║
# ║  想改某个组件？  →  修改「五、组件库」里对应组件的 HTML      ║
# ║  想改流程图颜色？ →  修改「六、流程图规范」里的颜色值         ║
# ║  想改输出路径？  →  修改「七、输出文件规范」                 ║
# ║  确定部署方式？  →  填写「八、发布扩展」里的对应行           ║
# ║                                                          ║
# ║  改完后告诉 Claude，它会自动同步更新 web/style.css          ║
# ╚══════════════════════════════════════════════════════════╝
#
# ⚠️  web/style.css 是自动生成的文件，请勿直接编辑
#     所有改动统一在本文件中进行，保持单一入口
#


---

## 一、概念边界

> 搞清楚两件事的区别，避免混淆：

| 动作 | 含义 | 谁来做 |
|------|------|--------|
| **生成网页** | 把内容渲染成可在浏览器打开的 `.html` 文件 | Claude 自动完成 |
| **发布到网站** | 把 HTML 文件上传到服务器，让外网用户能访问 | 需要额外部署步骤（见第八节） |

两者是流水线的前后两步。本文件目前只负责第一步，第二步在确定部署方式后填写第八节。

---

## 二、设计令牌（改颜色/字体从这里动手）

> 这里定义了整个网站的视觉基础变量。
> 改一个变量，所有用到它的地方都会跟着变。

```css
:root {

  /* ── 主色：保姆级教程风格的强调色（蓝色系）──────────────────
     用于：文章顶部色条、步骤编号圆圈、链接颜色、信息框边框
     想换主色？把下面三行的颜色值统一替换即可
     ── */
  --primary:       #2563EB;   /* 主蓝，用于重点强调 */
  --primary-light: #EFF6FF;   /* 浅蓝底，用于信息框背景 */
  --primary-dark:  #1D4ED8;   /* 深蓝，用于文字（确保对比度） */

  /* ── 辅色：深度科普风格的强调色（紫色系）──────────────────
     用于：深度科普文章的顶部色条、badge、lead 边框
     ── */
  --purple:        #7C3AED;
  --purple-light:  #F5F3FF;

  /* ── 功能色：固定用途，一般不需要改 ──────────────────────
     绿色 → 成功/提示/验证框
     黄色 → 警告/注意事项
     红色 → 错误（当前版本暂未使用）
     ── */
  --green:         #16A34A;
  --green-light:   #F0FDF4;
  --amber:         #D97706;
  --amber-light:   #FFFBEB;
  --red:           #DC2626;
  --red-light:     #FEF2F2;

  /* ── 文字色：三个层级 ──────────────────────────────────
     --text          → 标题、正文主体（最深）
     --text-secondary → 列表、表格内容（次级）
     --text-muted    → 辅助信息、时间戳、来源（最浅）
     ── */
  --text:           #111827;
  --text-secondary: #374151;
  --text-muted:     #6B7280;

  /* ── 背景与边框 ────────────────────────────────────────
     --bg           → 卡片/文章主体背景（纯白）
     --bg-secondary → 页面底色、步骤卡片底色（浅灰）
     --border       → 所有边框、分割线
     ── */
  --border:        #E5E7EB;
  --bg:            #FFFFFF;
  --bg-secondary:  #F9FAFB;

  /* ── 字体 ──────────────────────────────────────────────
     --font → 正文字体，优先使用系统字体（加载快，中英文都好看）
     --mono → 代码字体
     想换字体？替换引号内的字体名称
     ── */
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --mono: 'JetBrains Mono', Consolas, monospace;

  /* ── 圆角与阴影 ─────────────────────────────────────────
     --radius    → 卡片、按钮、代码块的圆角大小
     --shadow    → 卡片默认阴影（轻）
     --shadow-md → 卡片 hover 阴影（稍重）
     ── */
  --radius:    8px;
  --shadow:    0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06);
}
```

---

## 三、完整样式表（同步到 web/style.css）

> ⚠️ 这个代码块的内容 = `web/style.css` 的完整内容
> 在「二、设计令牌」里改了变量后，Claude 会用这个代码块重新生成 `web/style.css`

```css
/* =====================================================
   Aitetech 内容网站 —— 统一样式表

   ⚠️  请勿直接编辑此文件（web/style.css）
   ✅  所有改动请在 design-system.md 中进行，
       改完后告知 Claude 同步更新此文件
   ===================================================== */

/* ── 设计令牌（从 design-system.md 第二节同步） ───────── */
:root {
  --primary:        #2563EB;
  --primary-light:  #EFF6FF;
  --primary-dark:   #1D4ED8;
  --purple:         #7C3AED;
  --purple-light:   #F5F3FF;
  --green:          #16A34A;
  --green-light:    #F0FDF4;
  --amber:          #D97706;
  --amber-light:    #FFFBEB;
  --red:            #DC2626;
  --red-light:      #FEF2F2;
  --text:           #111827;
  --text-secondary: #374151;
  --text-muted:     #6B7280;
  --border:         #E5E7EB;
  --bg:             #FFFFFF;
  --bg-secondary:   #F9FAFB;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --mono: 'JetBrains Mono', Consolas, monospace;
  --radius:    8px;
  --shadow:    0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06);
}

/* ── Reset & Base ─────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; scroll-behavior: smooth; }
body {
  font-family: var(--font);
  color: var(--text);
  background: var(--bg-secondary);
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
}

/* ── 页面容器
   max-width 控制正文最大宽度（当前 780px，适合长文阅读）
   想要更宽的版式？改大这个值，如 960px 或 1100px
   ─────────────────────────────────────────────────── */
.page-wrapper { max-width: 780px; margin: 0 auto; padding: 40px 24px 80px; }

/* ── 文章头部卡片
   border-top 的颜色区分两种内容风格：
   - 无 style-b → 蓝色（保姆级教程）
   - 加 style-b → 紫色（深度科普）
   ─────────────────────────────────────────────────── */
.article-header {
  background: var(--bg);
  border-radius: 12px;
  padding: 40px 40px 32px;
  margin-bottom: 8px;
  box-shadow: var(--shadow);
  border-top: 4px solid var(--primary);   /* 蓝色顶部色条 */
}
.article-header.style-b { border-top-color: var(--purple); } /* 紫色顶部色条 */

/* ── 标签行（风格/阅读时长/主题标签） ──────────────────── */
.badge-row { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 600; padding: 3px 10px;
  border-radius: 20px; letter-spacing: .3px;
}
.badge-tutorial { background: var(--primary-light); color: var(--primary-dark); } /* 蓝色 badge */
.badge-deep     { background: var(--purple-light);  color: var(--purple); }        /* 紫色 badge */
.badge-meta     { background: var(--bg-secondary);  color: var(--text-muted); border: 1px solid var(--border); }

/* ── 文章大标题 ─────────────────────────────────────── */
.article-header h1 {
  font-size: 28px; font-weight: 800; line-height: 1.3;
  color: var(--text); margin-bottom: 14px; letter-spacing: -.3px;
}

/* ── 前言区块（文章开头的目标说明） ───────────────────── */
.article-lead {
  font-size: 15px; color: var(--text-muted);
  background: var(--bg-secondary); border-radius: var(--radius);
  padding: 14px 16px;
  border-left: 3px solid var(--primary);  /* 蓝色左边框 */
}
.article-lead.style-b { border-left-color: var(--purple); } /* 深度科普用紫色 */

/* ── 正文主卡片 ─────────────────────────────────────── */
.article-body {
  background: var(--bg);
  border-radius: 12px;
  padding: 40px;
  box-shadow: var(--shadow);
}

/* ── 正文排版 ───────────────────────────────────────── */
.article-body h2 {
  font-size: 20px; font-weight: 700;
  color: var(--text); margin: 40px 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border); /* 章节标题下划线 */
  display: flex; align-items: center; gap: 8px;
}
.article-body h2:first-child { margin-top: 0; }
.article-body h3 {
  font-size: 16px; font-weight: 700;
  color: var(--text-secondary); margin: 28px 0 12px;
}
.article-body p  { margin-bottom: 16px; font-size: 15px; line-height: 1.8; }
.article-body ul,
.article-body ol { padding-left: 22px; margin-bottom: 16px; }
.article-body li { margin-bottom: 6px; font-size: 15px; line-height: 1.8; }
.article-body strong { font-weight: 700; color: var(--text); }
.article-body a { color: var(--primary); text-decoration: none; }
.article-body a:hover { text-decoration: underline; }

/* ── 步骤卡片（保姆级教程专用）
   每个 Step 由编号圆圈 + 内容区两列组成
   ─────────────────────────────────────────────────── */
.steps { display: flex; flex-direction: column; gap: 16px; margin: 24px 0; }
.step {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  transition: box-shadow .15s;
}
.step:hover { box-shadow: var(--shadow-md); }
.step-num {
  width: 40px; height: 40px;
  background: var(--primary); color: #fff;  /* 编号圆圈颜色跟随主色 */
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 800; flex-shrink: 0;
}
.step-content h4 { font-size: 15px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
.step-content p  { margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.7; }
.step-content ul { margin: 8px 0 0; padding-left: 18px; }
.step-content li { font-size: 14px; color: var(--text-secondary); }

/* ── Callout 提示框（三种颜色对应三种语义）
   .callout-tip     → 绿色，💡 小技巧/推荐做法
   .callout-warning → 黄色，⚠️ 注意事项/容易出错
   .callout-info    → 蓝色，ℹ️ 背景知识/概念说明
   ─────────────────────────────────────────────────── */
.callout {
  border-radius: var(--radius); padding: 14px 16px;
  margin: 20px 0; display: flex; gap: 10px; align-items: flex-start;
  font-size: 14px; line-height: 1.7;
}
.callout-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
.callout-body { flex: 1; }
.callout-body > strong:first-child { display: block; margin-bottom: 4px; }
.callout-tip     { background: var(--green-light); border: 1px solid #BBF7D0; }
.callout-tip .callout-body     { color: #166534; }
.callout-warning { background: var(--amber-light); border: 1px solid #FDE68A; }
.callout-warning .callout-body { color: #92400E; }
.callout-info    { background: var(--primary-light); border: 1px solid #BFDBFE; }
.callout-info .callout-body    { color: #1E40AF; }

/* ── 代码块
   深色背景（#1E293B）+ 浅色文字，适合代码展示
   行内代码（<code>）用浅背景区分正文
   ─────────────────────────────────────────────────── */
pre {
  background: #1E293B; color: #E2E8F0;
  border-radius: var(--radius); padding: 18px 20px;
  overflow-x: auto; margin: 16px 0;
  font-family: var(--mono); font-size: 13px; line-height: 1.6;
}
code {
  font-family: var(--mono); font-size: 13px;
  background: var(--bg-secondary); color: var(--primary-dark);
  padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);
}
pre code { background: none; color: inherit; padding: 0; border: none; font-size: inherit; }

/* ── 表格 ───────────────────────────────────────────── */
.table-wrapper { overflow-x: auto; margin: 16px 0; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
thead tr { background: var(--bg-secondary); }
th {
  text-align: left; padding: 10px 14px;
  font-weight: 700; color: var(--text-secondary);
  border-bottom: 2px solid var(--border);
}
td { padding: 10px 14px; border-bottom: 1px solid var(--border); color: var(--text-secondary); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--bg-secondary); }

/* ── 流程图容器（Mermaid.js 渲染区域） ─────────────────── */
.diagram {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 16px; margin: 24px 0; text-align: center;
}
.diagram-title {
  font-size: 13px; font-weight: 600; color: var(--text-muted);
  text-align: center; margin-bottom: 12px;
  text-transform: uppercase; letter-spacing: .5px;
}
.mermaid { display: flex; justify-content: center; max-width: 100%; overflow-x: auto; }
.mermaid svg { max-width: 100%; height: auto; }

/* ── FAQ 折叠问答 ───────────────────────────────────── */
.faq { margin: 8px 0; }
.faq-item { border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 10px; overflow: hidden; }
.faq-q {
  padding: 14px 18px; font-size: 14px; font-weight: 700;
  color: var(--text); background: var(--bg-secondary);
  cursor: pointer; display: flex; justify-content: space-between; align-items: center;
}
.faq-q::after { content: '▾'; font-size: 16px; color: var(--text-muted); }
.faq-a { padding: 14px 18px; font-size: 14px; color: var(--text-secondary); line-height: 1.7; border-top: 1px solid var(--border); }

/* ── 效果验证框（绿色边框，文章结尾用） ─────────────────── */
.verify-box {
  border: 2px solid var(--green); background: var(--green-light);
  border-radius: var(--radius); padding: 20px 24px; margin: 24px 0;
}
.verify-box h3 { color: var(--green); margin: 0 0 12px; font-size: 15px; }
.verify-box li { font-size: 14px; color: #166534; margin-bottom: 6px; }

/* ── 进阶引导框（渐变背景，文章结尾用）
   保姆级教程 → 蓝色渐变；深度科普 → 紫色渐变
   ─────────────────────────────────────────────────── */
.next-steps {
  background: linear-gradient(135deg, var(--primary-light) 0%, #F0F7FF 100%);
  border: 1px solid #BFDBFE; border-radius: var(--radius);
  padding: 24px; margin: 32px 0 0;
}
.next-steps h3 { color: var(--primary-dark); margin-bottom: 12px; font-size: 15px; }
.next-steps li { font-size: 14px; color: #1E40AF; margin-bottom: 8px; }
.next-steps.style-b { background: linear-gradient(135deg, var(--purple-light) 0%, #FAF5FF 100%); border-color: #DDD6FE; }
.next-steps.style-b h3 { color: var(--purple); }
.next-steps.style-b li  { color: #5B21B6; }

/* ── 数据图表容器（Chart.js，仅在有数据对比时引入）────────
   使用场景：市场份额、效率对比、增长趋势等量化数据
   不使用场景：流程/架构/步骤图 → 继续用 Mermaid
   ─────────────────────────────────────────────────── */
.chart-container {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px 20px 16px;
  margin: 24px 0;
}
.chart-title {
  font-size: 13px; font-weight: 600; color: var(--text-muted);
  text-align: center; margin-bottom: 16px;
  text-transform: uppercase; letter-spacing: .5px;
}

/* ── 文章页脚 ───────────────────────────────────────── */
.article-footer {
  margin-top: 12px; padding: 16px 20px;
  font-size: 13px; color: var(--text-muted);
  border-top: 1px solid var(--border);
}
.article-footer a { color: var(--text-muted); }

/* ── 响应式：手机端适配 ─────────────────────────────── */
@media (max-width: 600px) {
  .page-wrapper { padding: 16px 16px 60px; }
  .article-header, .article-body { padding: 24px 20px; }
  .article-header h1 { font-size: 22px; }
  .step { grid-template-columns: 32px 1fr; gap: 12px; padding: 16px; }
  .step-num { width: 32px; height: 32px; font-size: 13px; }
}
```

---

## 四、页面结构模板（HTML 骨架）

> 每次生成新 HTML 文件时，以此为基础骨架展开内容

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- ══ SEO v1（原版）══════════════════════════════════════════
  <meta name="description" content="[文章一句话摘要]">
  <title>[文章标题]</title>
  ══════════════════════════════════════════════════════════════ -->

  <!-- ══ SEO v2（2026-04-03）════════════════════════════════════
       title：核心关键词靠前，控制在 50-60 字符；不要和 H1 完全一样
       description：核心词 + 利益点 + 行动召唤，120-150 字符
       canonical：防止 GitHub Pages / 镜像站产生重复收录
       schema：Article 结构化数据，帮助 Google 理解文章类型
  ══════════════════════════════════════════════════════════════ -->
  <title>[核心关键词] — [利益点]｜AI前沿</title>
  <meta name="description" content="[核心关键词出现在前半句]，[利益点一句话]。[行动召唤，如：5分钟读懂/免费上手/本文全拆解]。">
  <link rel="canonical" href="https://cc-newplayer.github.io/seo-farm/articles/[NN_slug].html">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "[文章标题，对应 content_draft.title，不截断]",
    "description": "[meta description 的完整内容，对应 content_draft.description，不得为空]",
    "url": "https://cc-newplayer.github.io/seo-farm/articles/[NN_slug].html",
    "datePublished": "[YYYY-MM-DD，取 content_draft.generated_at 的日期部分]",
    "inLanguage": "zh-CN",
    "keywords": "[content_draft.seo_keywords 数组，逗号+空格连接为单个字符串]",
    "image": "[images[0] 的完整 URL；若 images 数组为空则删除此行]",
    "author": { "@type": "Organization", "name": "AI前沿", "url": "https://cc-newplayer.github.io/seo-farm/" },
    "publisher": { "@type": "Organization", "name": "AI前沿", "url": "https://cc-newplayer.github.io/seo-farm/" }
  }
  </script>

  <!-- style.css 与 HTML 文件放在同一目录下，使用相对路径 -->
  <link rel="stylesheet" href="style.css">
  <!-- Mermaid.js 通过 CDN 加载，用于渲染流程图（所有文章必须引入） -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <!-- Chart.js：仅在文章中有数据对比图时引入，否则删除此行 -->
  <!-- <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script> -->
</head>
<body>
<div class="page-wrapper">

  <!-- ① 文章头部：标签 + 标题 + 前言 -->
  <header class="article-header">            <!-- 深度科普时改为：article-header style-b -->
    <div class="badge-row">
      <span class="badge badge-tutorial">📘 保姆级教程</span>  <!-- 深度科普改为：badge-deep + 🔬 深度科普 -->
      <span class="badge badge-meta">⏱ 约 X 分钟阅读</span>
      <span class="badge badge-meta">[主题标签]</span>
    </div>
    <h1>[文章标题]</h1>
    <p class="article-lead">[前言：读完本文你能做到什么 / 核心要回答的问题]</p>
                                            <!-- 深度科普改为：article-lead style-b -->
  </header>

  <!-- ② 正文主体 -->
  <div class="article-body">
    <!-- 内容在这里展开，按各风格的结构模板组织 -->
    <!-- ══ H2 SEO 规范（v2）══════════════════════════════════════
         H2 应包含关键词变体或长尾词，避免纯序号式（如"一、二、三"）
         ✅ 好例子：Gemma 4 和 DeepSeek 有什么区别？
         ❌ 差例子：一、先说结果
    ══════════════════════════════════════════════════════════ -->
  </div>

  <!-- ③ 参考来源 -->
  <footer class="article-footer">
    参考来源：[来源1] · [来源2] · [来源3]
  </footer>

</div>
<!-- Mermaid 初始化，固定写法，不需要改 -->
<script>mermaid.initialize({ startOnLoad: true, theme: 'default', flowchart: { curve: 'basis', useMaxWidth: true, htmlLabels: true } });</script>
</body>
</html>
```

---

## 五、组件库（HTML 模板 + 使用说明）

### 5.1 步骤卡片（保姆级教程必用）

```html
<div class="steps">

  <div class="step">
    <div class="step-num">1</div>      <!-- 数字改成对应步骤号 -->
    <div class="step-content">
      <h4>步骤标题（动词开头，如"注册并登录"）</h4>
      <p>步骤说明文字，简洁明确，告诉用户做什么、在哪里点。</p>
      <!-- 步骤里可以嵌套 callout，但不要嵌套另一个 step -->
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-content">
      <h4>下一步标题</h4>
      <p>说明文字……</p>
    </div>
  </div>

</div>
```

---

### 5.2 提示框 Callout（三种语义）

```html
<!-- 💡 绿色：小技巧、推荐做法、有用的补充信息 -->
<div class="callout callout-tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>可选标题（可省略）</strong>
    提示内容文字……
  </div>
</div>

<!-- ⚠️ 黄色：容易出错的地方、需要特别注意的操作 -->
<div class="callout callout-warning">
  <span class="callout-icon">⚠️</span>
  <div class="callout-body">
    <strong>注意</strong>
    警告内容文字……
  </div>
</div>

<!-- ℹ️ 蓝色：背景知识、概念解释、名词说明 -->
<div class="callout callout-info">
  <span class="callout-icon">ℹ️</span>
  <div class="callout-body">
    <strong>小知识</strong>
    说明内容文字……
  </div>
</div>
```

---

### 5.3 流程图（Mermaid.js）

```html
<div class="diagram">
  <div class="diagram-title">流程图标题（说明这张图展示的是什么）</div>
  <div class="mermaid">
<!-- 方向选择规则：
     LR（默认）→ 线性步骤流、决策树、数据流、节点连接图
     TD（例外）→ 多个 subgraph 需要横向并排对比时（如「三种架构模式对比」）
               → 改用 LR 会让 subgraph 变成竖排，破坏对比布局，此时保留 TD -->
flowchart LR
    A["节点文字"] --> B["节点文字"]
    B --> C{"判断节点？"}
    C -->|"是"| D["结果节点"]
    C -->|"否"| A
  </div>
</div>
```

---

### 5.4 数据表格

```html
<div class="table-wrapper">   <!-- 外层 wrapper 处理手机端横向滚动 -->
  <table>
    <thead>
      <tr><th>列标题1</th><th>列标题2</th><th>列标题3</th></tr>
    </thead>
    <tbody>
      <tr><td>内容</td><td>内容</td><td>内容</td></tr>
      <tr><td>内容</td><td>内容</td><td>内容</td></tr>
    </tbody>
  </table>
</div>
```

---

### 5.5 效果验证框（保姆级教程末尾）

```html
<div class="verify-box">
  <h3>✅ 效果验证</h3>
  <ul>
    <li>验证条件1，操作成功的标志 ✓</li>
    <li>验证条件2 ✓</li>
    <li>验证条件3 ✓</li>
  </ul>
</div>
```

---

### 5.6 FAQ 问答

```html
<div class="faq">
  <div class="faq-item">
    <div class="faq-q">问题一？</div>
    <div class="faq-a">回答内容……</div>
  </div>
  <div class="faq-item">
    <div class="faq-q">问题二？</div>
    <div class="faq-a">回答内容……</div>
  </div>
</div>
```

---

### 5.7 进阶引导框（文章结尾）

```html
<!-- 保姆级教程用蓝色版本 -->
<div class="next-steps">
  <h3>🔗 下一步可以尝试</h3>
  <ul>
    <li><strong>方向1</strong>：说明……</li>
    <li><strong>方向2</strong>：说明……</li>
  </ul>
</div>

<!-- 深度科普用紫色版本（加 style-b） -->
<div class="next-steps style-b">
  <h3>🔗 延伸阅读</h3>
  <ul>
    <li>……</li>
  </ul>
</div>
```

---

### 5.8 数据对比图（Chart.js）

> **使用判断**：文章中出现可量化的对比数据时使用（效率提升倍数、市场份额占比、多方案性能横评）。
> 纯流程说明、架构图、步骤图 → 继续用 Mermaid，不用 Chart.js。

**引入 Chart.js（在需要图表的 HTML 文件 `<head>` 中取消注释）：**
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
```

---

**① 横向条形图（方案/平台/模型对比，推荐首选）**

```html
<div class="chart-container">
  <div class="chart-title">图表标题（如「五大框架性能对比」）</div>
  <canvas id="barChart" height="200"></canvas>
</div>
<script>
new Chart(document.getElementById('barChart'), {
  type: 'bar',
  data: {
    labels: ['方案A', '方案B', '方案C', '方案D'],
    datasets: [{
      label: '指标名称（如：任务完成率 %）',
      data: [92, 78, 65, 54],
      backgroundColor: ['#2563EB', '#7C3AED', '#16A34A', '#D97706'],
      borderRadius: 4,
      borderSkipped: false,
    }]
  },
  options: {
    indexAxis: 'y',          /* 横向条形图 */
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.raw}` } }
    },
    scales: {
      x: {
        grid: { color: '#F3F4F6' },
        border: { display: false },
        ticks: { color: '#6B7280', font: { size: 12 } }
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#374151', font: { size: 13 } }
      }
    }
  }
});
</script>
```

---

**② 竖向柱状图（效率提升、前后对比）**

```html
<div class="chart-container">
  <div class="chart-title">图表标题（如「引入 MAS 前后处理时效对比」）</div>
  <canvas id="columnChart" height="220"></canvas>
</div>
<script>
new Chart(document.getElementById('columnChart'), {
  type: 'bar',
  data: {
    labels: ['场景A', '场景B', '场景C'],
    datasets: [
      {
        label: '改进前',
        data: [60, 45, 80],
        backgroundColor: '#BFDBFE',
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: '改进后',
        data: [20, 12, 25],
        backgroundColor: '#2563EB',
        borderRadius: 4,
        borderSkipped: false,
      }
    ]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#374151', font: { size: 12 }, boxWidth: 12, boxHeight: 12 }
      }
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#374151', font: { size: 12 } } },
      y: { grid: { color: '#F3F4F6' }, border: { display: false }, ticks: { color: '#6B7280', font: { size: 12 } } }
    }
  }
});
</script>
```

---

**③ 环形图（市场份额、占比分布）**

```html
<div class="chart-container" style="max-width: 420px; margin: 24px auto;">
  <div class="chart-title">图表标题（如「主流 MAS 框架 GitHub Star 占比」）</div>
  <canvas id="donutChart" height="260"></canvas>
</div>
<script>
new Chart(document.getElementById('donutChart'), {
  type: 'doughnut',
  data: {
    labels: ['LangGraph', 'CrewAI', 'AutoGen', 'Others'],
    datasets: [{
      data: [38, 27, 22, 13],
      backgroundColor: ['#2563EB', '#7C3AED', '#16A34A', '#E5E7EB'],
      borderWidth: 2,
      borderColor: '#FFFFFF',
      hoverOffset: 6
    }]
  },
  options: {
    responsive: true,
    cutout: '62%',
    plugins: {
      legend: {
        position: 'right',
        labels: { color: '#374151', font: { size: 12 }, boxWidth: 12, boxHeight: 12, padding: 16 }
      },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}%` } }
    }
  }
});
</script>
```

---

**色板（与设计令牌对齐，多系列时按顺序取色）**

| 顺序 | 颜色 | 色值 | 使用场景 |
|------|------|------|---------|
| 1 | 主蓝 | `#2563EB` | 重点项、改进后 |
| 2 | 紫色 | `#7C3AED` | 次要项 |
| 3 | 绿色 | `#16A34A` | 正面指标 |
| 4 | 琥珀 | `#D97706` | 警示/成本类 |
| 5 | 浅蓝 | `#BFDBFE` | 对比组的"改进前" |
| 6 | 灰色 | `#E5E7EB` | Others/其他 |

---

### 5.9 对话框组件（混合受众文章的概念入门专用）

#### 何时使用

文章标题/钩子面向大众，但正文含技术门槛词汇时，在**正文开头**集中用 2~3 个对话框解释核心概念。每个对话框只讲一个概念，3~4 轮对话结束，不拖长。

技术拆解章节内部**不使用**对话框——用括号注释或短句内嵌解释即可，避免打断阅读节奏。

#### 两个角色

| 角色 | emoji | 气泡颜色 | 职责 |
|------|-------|---------|------|
| 小白 | 🙋 | 蓝色 `#eff6ff` | 提"蠢问题"，代表零基础读者 |
| 老Q | 🤖 | 紫色 `#f3f0ff` | 一句话讲清楚，不说废话 |

对话要点：小白问的问题要真实（读者真的会有这个疑惑），老Q的回答要有信息量但不超过3句，最后一轮老Q的回答以**粗体关键结论**收尾。

#### CSS（写在文章 `<head>` 的 `<style>` 标签里）

```css
.dialogue-wrap {
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.1em 1.2em 0.9em;
  margin: 1.3em 0;
}
.dialogue-label {
  font-size: 0.75em;
  color: #9ca3af;
  margin-bottom: 0.8em;
  letter-spacing: 0.04em;
}
.dialogue { display: flex; flex-direction: column; gap: 0.65em; }
.dl { display: flex; align-items: flex-start; gap: 0.55em; }
.dl.r { flex-direction: row-reverse; }
.dl-av {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.15em; flex-shrink: 0; line-height: 1;
}
.av-xb { background: #dbeafe; }
.av-lq { background: #ede9fe; }
.dl-content { max-width: 82%; }
.dl-name { font-size: 0.7em; color: #9ca3af; margin-bottom: 0.18em; font-weight: 500; }
.dl.r .dl-name { text-align: right; }
.dl-bubble {
  display: inline-block; padding: 0.5em 0.85em;
  border-radius: 10px; font-size: 0.93em; line-height: 1.65; color: #1f2937;
}
.dl:not(.r) .dl-bubble { background: #eff6ff; border-top-left-radius: 2px; }
.dl.r .dl-bubble { background: #f3f0ff; border-top-right-radius: 2px; }
```

#### HTML 模板

```html
<div class="dialogue-wrap">
  <div class="dialogue-label">💬 [这个对话框在解释什么概念]</div>
  <div class="dialogue">

    <!-- 小白提问（左侧，蓝色） -->
    <div class="dl">
      <div class="dl-av av-xb">🙋</div>
      <div class="dl-content">
        <div class="dl-name">小白</div>
        <div class="dl-bubble">问题文字……</div>
      </div>
    </div>

    <!-- 老Q回答（右侧，紫色） -->
    <div class="dl r">
      <div class="dl-av av-lq">🤖</div>
      <div class="dl-content">
        <div class="dl-name" style="text-align:right">老Q</div>
        <div class="dl-bubble">回答文字，结尾加 <strong>粗体结论</strong>。</div>
      </div>
    </div>

    <!-- 可继续添加轮次，建议不超过4轮 -->

  </div>
</div>
```

#### 微信发布注意

对话框的 CSS（flexbox + 自定义类）**不兼容微信公众号**。`wechat_publisher.js` 会自动截图 `.dialogue-wrap` 元素并上传为图片替换，无需手动处理。

---

## 六、流程图颜色规范

> 修改这里的颜色值，所有新生成的流程图都会跟着变

| 节点类型 | fill（背景）| stroke（边框）| color（文字）| 使用场景 |
|---------|------------|--------------|-------------|---------|
| 起始节点 | `#EFF6FF` | `#2563EB` | `#1D4ED8` | 流程图的第一个节点 |
| 结束节点 | `#F0FDF4` | `#16A34A` | `#166534` | 流程图的最终结果节点 |
| 判断节点 | `#FFFBEB` | `#D97706` | `#92400E` | 菱形判断框（是/否分支）|
| 核心节点 | `#F5F3FF` | `#7C3AED` | `#5B21B6` | 架构图中的 LLM/主控模块 |

**写法示例：**
```
style A fill:#EFF6FF,stroke:#2563EB,color:#1D4ED8
```

---

## 七、输出文件规范

### 7.1 输出目录

```
C:\Users\admin\Desktop\cc web test exp\articles\
```

> 需要更换目录？修改上面这行路径即可，全局生效。

### 7.2 文件命名规则

```
[两位序号]_[主题-slug].html
```

- 序号按已有文件递增（当前已有 01–05，下一篇从 06 开始）
- slug 用英文小写 + 连字符，不含空格和特殊字符
- 示例：`06_crewai-intro.html`、`07_langchain-vs-autogen.html`

### 7.3 style.css 同步规则

- 修改本文件第二节或第三节 → 告知 Claude → Claude 重新生成 `web/style.css`
- 新文章用到了现有 CSS 没有的组件 → Claude 在 `web/style.css` 末尾追加并注释来源

---

## 八、生成检查清单

> 每次生成 HTML 文件前逐项确认，防止遗漏

<!-- ══ 检查清单 v1（原版）══════════════════════════════════════
- [ ] `<title>` 与文章标题完全一致
- [ ] `<meta name="description">` 已填写（15-30 字摘要）
- [ ] Header 的 badge 风格标签与实际内容风格一致（A→蓝/B→紫）
- [ ] 保姆级教程：每个主要步骤用步骤卡片，操作前后有 callout
- [ ] 深度科普：核心论点有流程图或对比表，结尾有可带走的判断框架
- [ ] 涉及数据对比的文章：已按 5.8 规范加入 Chart.js 图表，并在 `<head>` 中取消注释 Chart.js CDN；无数据对比的文章未引入 Chart.js
- [ ] 所有流程图节点颜色符合第六节规范
- [ ] 文章页脚有参考来源
- [ ] 文件命名符合 7.2 规则，序号不重复
══════════════════════════════════════════════════════════════ -->

<!-- ══ 检查清单 v2（2026-04-03）════════════════════════════════ -->
**结构与风格**
- [ ] Header 的 badge 风格标签与实际内容风格一致（A→蓝/B→紫）
- [ ] 保姆级教程：每个主要步骤用步骤卡片，操作前后有 callout
- [ ] 深度科普：核心论点有流程图或对比表，结尾有可带走的判断框架
- [ ] 涉及数据对比的文章：已按 5.8 规范加入 Chart.js 图表，并在 `<head>` 中取消注释 Chart.js CDN；无数据对比的文章未引入 Chart.js
- [ ] 所有流程图节点颜色符合第六节规范
- [ ] 文章页脚有参考来源
- [ ] 文件命名符合 7.2 规则，序号不重复

**SEO（v2 新增）**
- [ ] `<title>` 核心关键词靠前，50-60 字符以内，末尾加 `｜AI前沿`
- [ ] `<meta description>` 核心词在前半句，120-150 字符，含行动召唤
- [ ] `<link rel="canonical">` 已填写正确 URL
- [ ] Article schema 已填写 headline / datePublished
- [ ] H1 唯一，包含核心关键词
- [ ] H2 含关键词变体或长尾词，避免纯序号式标题
- [ ] 正文前 100 字出现核心关键词

---

## 九、发布扩展（确定部署方式后填写）

> 填好某一行后，「生成网页」和「上传发布」就可以打通为一个自动化流水线
> 推荐优先考虑「静态托管」方案，配置最简单

| 发布方式 | 状态 | 需要填写的信息 |
|---------|------|--------------|
| **静态托管**（Vercel / Netlify / GitHub Pages） | 🔲 待配置 | Git 仓库地址、部署分支名、输出目录 |
| **CMS API 推送**（WordPress / Strapi 等） | 🔲 待配置 | API Endpoint、认证 Token、文章分类 ID |
| **手动上传**（FTP / SFTP） | 🔲 待配置 | 服务器地址、端口、目标目录路径 |
| **n8n 自动化触发**（接入本工作区已有配置） | 🔲 待配置 | n8n Webhook URL、触发条件 |
