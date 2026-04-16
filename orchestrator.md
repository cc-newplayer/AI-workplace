# orchestrator.md — 内容创作主编排 v1.0

## 职责
串联三个 Agent，完成从选题到发布的完整流水线。根据用户指令判断从哪个节点进入，支持全流程和单 Agent 调用。

---

## 入口路由

收到内容创作指令后，**先判断篇数**：

**多篇 / 批量请求**（含"几篇"、"多篇"、"批量"、数量 ≥ 2 的明确要求）→ **不执行**，直接输出：

```
批量生产请用 farm-scheduler，在终端运行：

# 从关键词矩阵批量生产（需先跑 keyword-agent）：
node farm-scheduler.js

# 指定单个关键词：
node farm-scheduler.js --keyword "关键词" --style A|B|C

生成完成后，回到对话输入 PUBLISH: from_content_draft 触发发布。
```

**单篇请求** → 继续下方路由表：

| 用户指令特征 | 执行路径 |
|------------|---------|
| 含主题词 / "自动选题" / 指令模糊 | 全流程：Agent1 → Agent2 → Agent3 |
| 含"跳过选题"或直接给出关键词 | Agent2 → Agent3 |
| 含"只生成内容" / "不发布" | Agent1 → Agent2（止） |
| 含"发布已有草稿" | Agent3（止） |
| 含"只做质检" | Agent3 质检部分（止，check_only=true） |
| 含 `TOPIC:` / `CONTENT:` / `PUBLISH:` 前缀 | 直接路由到对应 Agent（单独测试模式） |
| 含 `NEWS:` 前缀 | 直接路由到 `agents/news-agent.md`（独立，不进入内容流水线） |

---

## 全流程执行

### Phase 1：关键词研究
调用 `agents/keyword-agent.md`，传入：
```
TOPIC: <用户主题词 或 auto>
```
等待确认消息：`[keyword-agent] 完成`，读取 `output/keyword-matrix-latest.json`。

### Phase 2：内容生成
调用 `agents/content-agent.md`，传入：
```
CONTENT: from_keyword_matrix
```
等待确认消息：`[content-agent] 完成`，直接进入 Phase 3。

### Phase 3：发布
调用 `agents/publish-agent.md`，传入：
```
PUBLISH: from_content_draft
```

---

## 错误处理

| 错误情况 | 处理方式 |
|---------|---------|
| keyword-matrix-latest.json 不存在 | 提示：请先运行 `TOPIC: <主题词>` |
| content-draft.json 不存在 | 提示：请先运行 `CONTENT: from_keyword_matrix` |
| 任何 Agent 输出 FAIL | 停止流程，说明失败原因和修复建议，等待用户处理后重新调用对应 Agent |
| 微信 token 过期 | 提示用户检查 `wx_config.js` 并刷新 access_token |

---

## 调用示例

```
# 全流程（自动选题）
写一篇文章并发布

# 全流程（指定主题）
写一篇关于 FastGPT 的保姆级教程并发布到网站和微信

# 跳过选题
用关键词「LangGraph 教程」写一篇文章

# 仅选题，不写文章
帮我分析 OpenAI Responses API 的关键词，不用写文章

# 仅发布已有草稿
发布 output/content-draft.json

# 仅质检
只做质检，不发布

# 单独测试 Agent 1
TOPIC: FastGPT

# 单独测试 Agent 2
CONTENT: keyword=LangGraph 教程 style=A

# 单独测试 Agent 3
PUBLISH: from_content_draft check_only=true

# 更新资讯页（独立于内容流水线）
NEWS: update

# 预览资讯更新，不写文件
NEWS: update dry_run
```
