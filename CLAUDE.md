# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 工作区性质

这是一个 **AI Agent 内容创作工作区**，不含可执行代码。工作区的核心任务是：按照预定义的角色和风格，产出关于 AI Agent 的科普、教程、平台介绍等内容。

---

## 文件结构与职责

```
.clauderc.md              # 角色定义（身份、模式、搜索策略、SEO、负面约束）
GUIDE.md                  # 操作指引（每次生成内容的执行流程入口）v1.2
design-system.md          # 设计系统（唯一改动入口：CSS 令牌、样式表、HTML 模板、组件库、输出规范、发布扩展）
style-tutorial.md         # 风格 A：保姆级教程（结构模板、语言规范、图片规范、样本）
style-deep-science.md     # 风格 B：深度科普（写作节奏、图表规范、样本）
style-popular-science.md  # 风格 C：大众科普（钩子写法、场景化、利益优先、图片规范）
```

---

## 内容生成工作流

每次接到内容生成任务，必须读取 `agents/orchestrator.md` 并按其路由表执行，不可跳步。

> `GUIDE.md` 已被 agent 流水线取代，保留仅作历史参考，不再作为执行入口。

### 风格触发规则

| 触发关键词 | 风格 | 调用文件 |
|-----------|------|---------|
| 教程、怎么用、小白、手把手、保姆级、零代码 | 风格 A：保姆级教程 | `style-tutorial.md` |
| 深度、架构、原理、开发者、底层、测评、源码、性能、对比 | 风格 B：深度科普 | `style-deep-science.md` |
| 大众、科普、什么是、概念、普及、认知、入门 | 风格 C：大众科普 | `style-popular-science.md` |
| 指令模糊 | 默认风格 C | `style-popular-science.md` |
| 多类关键词同时出现 | 以目标读者为准 | — |

---

## 新增风格 SOP

当需要新增风格时：

1. 创建 `style-[风格名].md`，必须包含：风格定位、核心写作原则、文章结构模板、语言规范、图表规范、标题示例、参考样本（含选择理由）
2. 在 `GUIDE.md` 的 **STEP 2 触发表** 和 **已注册风格列表** 中各补充一行
3. 在本文件（`CLAUDE.md`）的风格触发规则表中追加对应行

---

## 脚本命令

| 脚本 | 调用方式 | 用途 |
|------|---------|------|
| `doubao_image.js` | `node doubao_image.js "提示词"` | 豆包生图，输出到 `./output/`，再手动复制到 `articles/images/` |
| `wechat_publisher.js` | `node wechat_publisher.js` | 将 HTML 文章发布到微信公众号草稿箱（需 `wx_config.js` 配置 token） |
| `coze_screenshot_flow.js` | 改顶部 `SPACE_URL` / `BOT_URL` / `OUT` 后运行 `node coze_screenshot_flow.js` | 对目标平台做操作步骤截图 |

---

## 关键约束

以下约束来自 `.clauderc.md`，优先级高于风格文件：

- 风格 A 中禁止展示复杂 JSON 配置或 Python 源码
- 风格 B 中禁止只谈表面功能而不谈技术实现
- 风格 C 中禁止放 Mermaid 架构图或 Chart.js 技术图表
- 任何风格中禁止机械堆砌关键词
- `design-system.md` 是 HTML/CSS 的**唯一改动入口**，新增组件必须先在此注册；对话框组件（§5.9）已注册，直接复用，不重新实现
