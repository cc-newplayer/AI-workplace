# SEO Farm — AI 内容生产流水线

基于 Claude Code 的全自动 AI 科普文章生产系统。从关键词研究到文章生成、配图、发布 GitHub Pages 和微信公众号，全流程自动化。

## 架构概览

```
用户指令
  │
  ├─ 单篇 → orchestrator.md（对话驱动）
  │           keyword-agent → content-agent → publish-agent
  │
  └─ 多篇 → farm-scheduler.js（Node.js 脚本）
              ├─ 读取 keyword-matrix-latest.json
              ├─ 串行调用 Claude API 生成文章
              ├─ 调用 doubao_image.js 生成配图
              └─ 提示手动触发发布
```

**两条路线互不干扰：**
- 单篇：在 Claude Code 对话中直接触发，全程自动
- 多篇：终端运行 `node farm-scheduler.js`，生成完成后手动发布

## 快速开始

### 1. 安装依赖

```bash
npm install
npx playwright install chromium
```

### 2. 配置 API

```bash
cp ai_config.example.js ai_config.js
# 编辑 ai_config.js，填入你的 Claude API Key

cp wx_config.example.js wx_config.js
# 编辑 wx_config.js，填入微信公众号 AppID 和 AppSecret
```

### 3. 配置微信 IP 白名单

登录[微信公众平台](https://mp.weixin.qq.com) → 设置与开发 → 基本配置 → IP白名单，添加你的服务器 IP。

### 4. 运行

**单篇（在 Claude Code 对话中）：**
```
TOPIC: Llama 4 教程
```

**多篇（终端）：**
```bash
# 自动选题（读取 keyword-matrix-latest.json）
node farm-scheduler.js

# 指定关键词
node farm-scheduler.js --keyword "Llama 4 教程" --style A
```

**发布到微信：**
```bash
node wechat_publisher.js "../seo-farm/articles/30_llama4-tutorial.html"
```

## 文件结构

```
├── agents/
│   ├── orchestrator.md       # 主编排器，路由单篇任务
│   ├── keyword-agent.md      # 关键词研究，SERP 抓取，输出评分矩阵
│   ├── content-agent.md      # 文章生成，支持 A/B/C 三种风格
│   └── publish-agent.md      # 质检 + 发布（更新 HTML/sitemap/git push）
│
├── farm-scheduler.js         # 批量生产调度器（Node.js）
├── serp-scraper.js           # 百度 SERP 抓取（Playwright）
├── doubao_image.js           # 豆包 AI 生图（Playwright）
├── wechat_publisher.js       # 微信公众号发布（API + Playwright）
├── keyword-memory.js         # 关键词历史记忆库
│
├── CLAUDE.md                 # Claude Code 项目配置
├── design-system.md          # HTML/CSS 设计规范（唯一改动入口）
├── style-tutorial.md         # 风格 A：保姆级教程
├── style-deep-science.md     # 风格 B：深度科普
├── style-popular-science.md  # 风格 C：大众科普
│
├── article-index.md          # 已发布文章索引（防重复选题）
├── ai_config.example.js      # API 配置示例
└── wx_config.example.js      # 微信配置示例
```

## Agent 风格说明

| 风格 | 定位 | 触发关键词 | 典型标题 |
|------|------|-----------|---------|
| A | 保姆级教程 | 教程、怎么用、手把手、零代码 | `XXX 保姆级入门教程（2026最新版）` |
| B | 深度科普 | 深度、架构、原理、开发者 | `XXX 的底层逻辑是什么？` |
| C | 大众科普 | 科普、什么是、普及、认知 | `你可能不知道，XXX 已经在悄悄改变你的工作` |

## 输出目录结构（运行时生成，不入库）

```
output/
├── content-draft.json        # 最新文章草稿（供 publish-agent 读取）
├── keyword-matrix-latest.json # 最新关键词矩阵
├── serp-cache/               # SERP 抓取缓存（7天有效）
├── keyword-archive/          # 关键词矩阵历史归档
├── articles/                 # 文章 Markdown 草稿
└── logs/                     # farm 运行日志
```

## 依赖说明

| 包 | 用途 |
|----|------|
| `@anthropic-ai/sdk` | Claude API 调用 |
| `playwright` | 浏览器自动化（SERP 抓取、豆包生图、微信发布） |
| `cheerio` | HTML 解析（微信发布时提取文章内容） |

## 注意事项

- `doubao_image.js` 使用 Playwright 控制浏览器，**不支持并行运行**（同一时间只能有一个实例）
- 微信发布需要服务器 IP 在公众号白名单中
- `output/` 目录不入库，首次克隆后会自动创建
- SERP 抓取依赖百度搜索，建议在国内网络环境运行
