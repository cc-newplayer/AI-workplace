// ════════════════════════════════════════════════════════════════
// farm-scheduler.js — SEO Farm 批量任务调度器
//
// 功能：
//   1. 读取关键词矩阵，按评分排序，批量驱动三段 agent 流水线
//   2. 支持并发控制（默认串行，可设 --concurrency N）
//   3. 每篇文章完整走完：SERP 抓取 → keyword-agent → content-agent → publish-agent
//   4. 失败自动重试（最多 2 次），记录运行日志
//   5. 支持断点续跑（跳过已完成的关键词）
//
// 使用方法：
//   node farm-scheduler.js                        # 全自动：读 keyword-matrix-latest.json
//   node farm-scheduler.js --topic "AI Agent"     # 先跑 keyword-agent 再批量生产
//   node farm-scheduler.js --keyword "n8n 教程"   # 单关键词直接跑完整流水线
//   node farm-scheduler.js --dry-run              # 只打印计划，不执行
//   node farm-scheduler.js --status               # 查看上次运行状态
//
// 输出：
//   output/logs/farm-run-<YYYY-MM-DD>.json   每次运行日志
//   output/farm-state.json                    断点续跑状态
// ════════════════════════════════════════════════════════════════

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const aiConfig = require('./ai_config');

// 初始化 Claude 客户端
const claude = new Anthropic({
  apiKey: aiConfig.API_KEY,
  baseURL: aiConfig.BASE_URL,
});

// ── 配置区 ──────────────────────────────────────────────────────
const CONFIG = {
  outputDir: './output',
  logsDir: './output/logs',
  contentArchiveDir: './output/content-archive',
  articlesDir: './output/articles',
  // 每篇文章之间的间隔（ms），避免 API 过载
  articleDelay: 5000,
  // 最大重试次数
  maxRetries: 2,
  // 最低推荐分数（低于此分数的关键词跳过）
  minScore: 5,
  // 单次运行最多生产文章数（防止失控）
  maxArticlesPerRun: 10,
  // SERP 抓取配置
  serpEngine: 'baidu',
  serpDeep: false,
};
// ────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function now() {
  return new Date().toISOString();
}

function log(msg, level = 'INFO') {
  const prefix = { INFO: '  ', WARN: '⚠ ', ERROR: '✗ ', OK: '✓ ' }[level] || '  ';
  console.log(`[${new Date().toTimeString().slice(0, 8)}] ${prefix}${msg}`);
}

// ── 状态管理（断点续跑）────────────────────────────────────────
const STATE_FILE = path.join(CONFIG.outputDir, 'farm-state.json');

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { completed: [], failed: [] };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { completed: [], failed: [] };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function markCompleted(state, keyword) {
  if (!state.completed.includes(keyword)) state.completed.push(keyword);
  state.failed = state.failed.filter(f => f.keyword !== keyword);
  saveState(state);
}

function markFailed(state, keyword, reason) {
  state.failed = state.failed.filter(f => f.keyword !== keyword);
  state.failed.push({ keyword, reason, time: now() });
  saveState(state);
}

// ── 运行日志 ─────────────────────────────────────────────────────
function initRunLog(keywords) {
  return {
    run_id: `run-${Date.now()}`,
    started_at: now(),
    finished_at: null,
    total: keywords.length,
    completed: 0,
    failed: 0,
    skipped: 0,
    articles: [],
  };
}

function saveRunLog(runLog) {
  if (!fs.existsSync(CONFIG.logsDir)) fs.mkdirSync(CONFIG.logsDir, { recursive: true });
  const logPath = path.join(CONFIG.logsDir, `farm-run-${today()}.json`);
  runLog.finished_at = now();
  fs.writeFileSync(logPath, JSON.stringify(runLog, null, 2), 'utf8');
  return logPath;
}

// ── 读取关键词矩阵 ───────────────────────────────────────────────
function loadKeywordMatrix() {
  const matrixPath = path.join(CONFIG.outputDir, 'keyword-matrix-latest.json');
  if (!fs.existsSync(matrixPath)) {
    log('未找到 keyword-matrix-latest.json', 'ERROR');
    log('请先运行: TOPIC: <主题> 让 keyword-agent 生成关键词矩阵', 'ERROR');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
}

// ── 从 article-index.md 读取当前最大文章编号 ─────────────────────
function getNextArticleNumber() {
  const indexPath = './article-index.md';
  if (!fs.existsSync(indexPath)) return 1;
  const content = fs.readFileSync(indexPath, 'utf8');
  const matches = content.match(/^\|\s*(\d+)\s*\|/gm);
  if (!matches || matches.length === 0) return 1;
  const nums = matches.map(m => parseInt(m.replace(/\D/g, '')));
  return Math.max(...nums) + 1;
}

// ── STEP 1: SERP 抓取 ────────────────────────────────────────────
async function runSerpScraper(keyword, options = {}) {
  const { engine = CONFIG.serpEngine, deep = CONFIG.serpDeep } = options;
  log(`SERP 抓取: "${keyword}" [${engine}${deep ? '+深度' : ''}]`);

  const args = [
    'serp-scraper.js',
    keyword,
    '--engine', engine,
  ];
  if (deep) args.push('--deep');

  return runScript(args, `serp:${keyword}`);
}

// ── STEP 2: Content Agent（调用 Claude API）─────────────────────
function buildContentPrompt(keyword, style, serpDataPath) {
  // 读取 agent 规范文件，作为系统上下文
  const agentFiles = [
    './agents/content-agent.md',
    './agents/orchestrator.md',
    `./style-${style === 'A' ? 'tutorial' : style === 'B' ? 'deep-science' : 'popular-science'}.md`,
    './.clauderc.md',
  ];

  let systemContext = '';
  for (const f of agentFiles) {
    if (fs.existsSync(f)) {
      systemContext += `\n\n--- ${f} ---\n` + fs.readFileSync(f, 'utf8');
    }
  }

  // 读取 article-index.md 用于去重
  if (fs.existsSync('./article-index.md')) {
    systemContext += '\n\n--- article-index.md ---\n' + fs.readFileSync('./article-index.md', 'utf8');
  }

  let userPrompt = `CONTENT: keyword=${keyword} style=${style}`;

  // 附加 SERP 竞品数据
  if (serpDataPath && fs.existsSync(serpDataPath)) {
    try {
      const serp = JSON.parse(fs.readFileSync(serpDataPath, 'utf8'));
      if (serp.competitor_summary) {
        const s = serp.competitor_summary;
        userPrompt += `\n\n[竞品参考]\n`;
        userPrompt += `- 竞品均字数: ${s.avg_word_count} 字，本文建议 ≥ ${Math.round(s.avg_word_count * 1.2)} 字\n`;
        userPrompt += `- 竞品关键词密度: ${s.avg_keyword_density}%\n`;
        if (s.top_h2_samples && s.top_h2_samples.length > 0) {
          userPrompt += `- 竞品常见 H2 标题:\n`;
          s.top_h2_samples.forEach(h => { userPrompt += `  * ${h}\n`; });
        }
      }
    } catch { /* 忽略 */ }
  }

  return { systemContext, userPrompt };
}

async function runContentAgent(keyword, style, serpDataPath, articleNumber) {
  log(`调用 Claude API 生成文章: "${keyword}" [风格 ${style}]`);

  const { systemContext, userPrompt } = buildContentPrompt(keyword, style, serpDataPath);

  const response = await claude.messages.create({
    model: aiConfig.MODEL,
    max_tokens: 16000,
    system: systemContext,
    messages: [{ role: 'user', content: userPrompt + `

【输出格式要求 - 必须严格遵守】
你的回复必须以一个 JSON 代码块开头，格式如下：

\`\`\`json
{
  "generated_at": "...",
  "keyword": "...",
  "style": "...",
  "article_number": 23,
  "slug": "...",
  "title": "...",
  "description": "...",
  "reading_minutes": 7,
  "topic_tags": [],
  "seo_keywords": [],
  "images": [
    {
      "position": "section-1-header",
      "type": "doubao",
      "prompt": "中文生图提示词，描述画面内容和风格",
      "source_path": "output/doubao_xxx_1.jpg",
      "target_path": "C:/Users/admin/Desktop/seo-farm/articles/images/NN_img1_desc.jpg",
      "alt": "图片描述"
    }
  ],
  "注意": "doubao类型必须有prompt字段；images数组只放doubao和screenshot类型，mermaid/chartjs直接在正文Markdown里写代码块，不要放进images数组",
  "internal_links": [],
  "quality_flags": {
    "word_count": 0,
    "has_title": true,
    "has_body": true,
    "has_conclusion": true,
    "seo_keywords_embedded": true,
    "images_ready": false,
    "duplicate_checked": true
  }
}
\`\`\`

JSON 代码块之后，再输出完整文章正文（Markdown 格式）。不要把文章正文放进 JSON 的任何字段里。` }],
  });

  const content = response.content[0].text;

  // 尝试多种方式提取 content-draft JSON
  let draft = null;

  // 方式1：```json 代码块
  const codeBlockMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    try { draft = JSON.parse(codeBlockMatch[1]); } catch { /* 继续尝试 */ }
  }

  // 方式2：直接包含 quality_flags 的 JSON 对象
  if (!draft) {
    const jsonMatch = content.match(/(\{[\s\S]*?"quality_flags"[\s\S]*?\})\s*(?:\n|$)/);
    if (jsonMatch) {
      try { draft = JSON.parse(jsonMatch[1]); } catch { /* 继续尝试 */ }
    }
  }

  // 方式3：Claude 通过模拟 tool_call 写入了文件，直接读文件
  if (!draft) {
    const candidates = [
      path.join(CONFIG.outputDir, 'content-draft.json'),
      path.join(CONFIG.outputDir, 'content-draft-latest.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (parsed.quality_flags) { draft = parsed; break; }
        } catch { /* 继续 */ }
      }
    }
  }

  if (draft) {
    if (articleNumber) draft.article_number = articleNumber;
    const draftPath = path.join(CONFIG.outputDir, 'content-draft.json');
    fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2), 'utf8');
    log(`content-draft 已写入: ${draftPath}`, 'OK');
    log(`  标题: ${draft.title}`, 'OK');
    log(`  字数: ${draft.quality_flags?.word_count}，图片: ${draft.images?.length} 张`, 'OK');

    // 提取正文：找到第一个 ```json 块结束的位置，取其后所有内容
    const jsonBlockEnd = content.indexOf('```', content.indexOf('```json') + 7);
    const articleBody = jsonBlockEnd !== -1 ? content.slice(jsonBlockEnd + 3).trim() : null;
    if (articleBody) {
      if (!fs.existsSync(CONFIG.articlesDir)) fs.mkdirSync(CONFIG.articlesDir, { recursive: true });
      const num = String(draft.article_number || Date.now()).padStart(2, '0');
      const slug = draft.slug || keyword.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').slice(0, 40);
      const articlePath = path.join(CONFIG.articlesDir, `${num}_${slug}.md`);
      fs.writeFileSync(articlePath, `# ${draft.title}\n\n${articleBody}`, 'utf8');
      log(`  正文已保存: ${articlePath}`, 'OK');
      draft.article_path = articlePath;
      fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2), 'utf8');
    } else {
      log(`  未提取到正文`, 'WARN');
    }

    return { success: true, draft, rawResponse: content };
  }

  // 都没找到，保存原始回复排查
  const rawPath = path.join(CONFIG.outputDir, `content-raw-${Date.now()}.txt`);
  fs.writeFileSync(rawPath, content, 'utf8');
  log(`未提取到 JSON，原始回复已保存: ${rawPath}`, 'WARN');
  return { success: false, error: '未提取到 content-draft JSON', rawResponse: content };
}

// ── STEP 3: 图片生成 ─────────────────────────────────────────────
async function runImageGeneration(contentDraftPath) {
  if (!fs.existsSync(contentDraftPath)) {
    log('content-draft 不存在，跳过图片生成', 'WARN');
    return false;
  }

  const draft = JSON.parse(fs.readFileSync(contentDraftPath, 'utf8'));
  const images = draft.images || [];
  const doubaoImages = images.filter(img => img.type === 'doubao' && img.prompt);

  if (doubaoImages.length === 0) {
    log('无需豆包生图（无 doubao 类型图片）');
    return true;
  }

  log(`豆包生图: ${doubaoImages.length} 张`);
  let draftChanged = false;
  for (const img of doubaoImages) {
    log(`  生成: ${img.prompt.slice(0, 50)}...`);
    const result = await runScript(['doubao_image.js', img.prompt], `img:${img.prompt.slice(0, 20)}`);
    if (!result.success) {
      log(`  图片生成失败: ${result.error}`, 'WARN');
      await sleep(2000);
      continue;
    }

    // 从 stdout 解析生成的第1张图路径
    // doubao_image.js 输出格式：生成图片: ['output/doubao_xxx_1.jpg', ...]
    const match = result.stdout.match(/生成图片:\s*\[([^\]]+)\]/);
    if (!match) {
      log(`  未解析到图片路径，跳过 cp`, 'WARN');
      await sleep(2000);
      continue;
    }
    const firstImage = match[1].trim().replace(/['"]/g, '').split(',')[0].trim();

    // cp 到 target_path
    if (img.target_path) {
      const targetDir = path.dirname(img.target_path);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(firstImage, img.target_path);
      log(`  已复制: ${firstImage} → ${img.target_path}`, 'OK');
    }

    // 回写 source_path 到 draft
    img.source_path = firstImage;
    draftChanged = true;
    await sleep(2000);
  }

  // 把更新后的 source_path 写回 content-draft.json
  if (draftChanged) {
    draft.quality_flags = draft.quality_flags || {};
    draft.quality_flags.images_ready = true;
    fs.writeFileSync(contentDraftPath, JSON.stringify(draft, null, 2), 'utf8');
    log(`content-draft 已更新（source_path 回写完成）`, 'OK');
  }
  return true;
}

// ── 通用脚本执行器 ───────────────────────────────────────────────
function runScript(args, label) {
  return new Promise((resolve) => {
    const child = spawn('node', args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => {
      stdout += d.toString();
      process.stdout.write(d); // 实时透传输出
    });
    child.stderr.on('data', d => {
      stderr += d.toString();
    });

    child.on('close', code => {
      if (code === 0) {
        resolve({ success: true, stdout, label });
      } else {
        resolve({ success: false, error: stderr || `exit code ${code}`, stdout, label });
      }
    });

    child.on('error', err => {
      resolve({ success: false, error: err.message, label });
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── 单关键词完整流水线 ───────────────────────────────────────────
async function runPipeline(keyword, style, options = {}) {
  const { dryRun = false, articleNumber } = options;
  const result = { keyword, style, steps: {}, success: false, started_at: now() };

  log(`\n${'─'.repeat(60)}`);
  log(`开始处理: "${keyword}" [风格 ${style}]`);

  // STEP 1: 读取 SERP 缓存（由 keyword-agent 负责抓取，这里只读）
  let serpDataPath = null;
  const memoryModule = (() => { try { return require('./keyword-memory'); } catch { return null; } })();
  if (memoryModule) {
    const coreTerm = memoryModule.extractCoreTerm(keyword);
    const engine = options.engine || CONFIG.serpEngine;
    const cached = memoryModule.readCache(coreTerm, engine);
    if (cached) {
      // 把缓存写到 serp-latest.json 供 buildContentPrompt 读取
      const latestPath = path.join(CONFIG.outputDir, 'serp-latest.json');
      require('fs').writeFileSync(latestPath, JSON.stringify(cached, null, 2), 'utf8');
      serpDataPath = latestPath;
      log(`SERP 缓存命中: "${coreTerm}"（${cached.scraped_at?.slice(0, 10)}）`);
    } else {
      log(`无 SERP 缓存，跳过竞品数据（请先运行 keyword-agent）`, 'WARN');
    }
    result.steps.serp = cached ? 'cache_hit' : 'no_cache';
  } else {
    result.steps.serp = 'skipped';
  }

  // STEP 2: 调用 Claude API 生成文章
  let contentDraftPath = null;
  if (dryRun) {
    log('[dry-run] STEP 2: Content Agent (Claude API)');
    result.steps.content = 'dry-run';
  } else {
    const slug = keyword.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').slice(0, 50);
    serpDataPath = serpDataPath || path.join(CONFIG.outputDir, `serp-${slug}-${today()}.json`);
    const contentResult = await runContentAgent(keyword, style, serpDataPath, articleNumber);
    result.steps.content = contentResult.success ? 'ok' : 'failed';
    if (!contentResult.success) {
      log(`文章生成失败: ${contentResult.error}`, 'ERROR');
      result.success = false;
      result.finished_at = now();
      return result;
    }
    contentDraftPath = path.join(CONFIG.outputDir, 'content-draft.json');
  }

  // STEP 3: 图片生成
  if (!dryRun && contentDraftPath) {
    await runImageGeneration(contentDraftPath);
    result.steps.images = 'attempted';
  }

  result.success = true;
  result.finished_at = now();
  log(`完成: "${keyword}"`, 'OK');
  return result;
}

// ── 主调度循环 ───────────────────────────────────────────────────
async function runScheduler(options = {}) {
  const { dryRun = false, singleKeyword = null } = options;

  log('═'.repeat(60));
  log('SEO Farm Scheduler 启动');
  log(`模式: ${dryRun ? 'dry-run' : '生产'}`);
  log('═'.repeat(60));

  // 单关键词模式
  if (singleKeyword) {
    const style = options.style || 'C';
    const result = await runPipeline(singleKeyword, style, { dryRun });
    if (result.success && !dryRun) {
      log(`\n${'═'.repeat(60)}`);
      log(`[人工审核] 文章已生成，请检查后回到 Claude 对话输入：`);
      log(`  PUBLISH: from_content_draft`);
      log(`即可触发发布（更新 articles.html / script.js / article-index.md / sitemap.xml 并 git push）`);
      log('═'.repeat(60));
    }
    return;
  }

  // 读取关键词矩阵
  const matrix = loadKeywordMatrix();
  const state = loadState();

  // 过滤 + 排序
  let keywords = matrix.keywords
    .filter(k => k.recommendation_score >= CONFIG.minScore)
    .filter(k => !state.completed.includes(k.keyword))
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, CONFIG.maxArticlesPerRun);

  if (keywords.length === 0) {
    log('没有待处理的关键词（全部已完成或分数不足）', 'WARN');
    log(`已完成: ${state.completed.length} 个，失败: ${state.failed.length} 个`);
    return;
  }

  log(`待处理关键词: ${keywords.length} 个`);
  keywords.forEach((k, i) => {
    log(`  ${i + 1}. [${k.recommendation_score}分] "${k.keyword}" → 风格 ${k.recommended_style || matrix.style_suggestion}`);
  });

  if (dryRun) {
    log('\n[dry-run] 计划打印完毕，未执行任何操作');
    return;
  }

  // 完整流水线（串行）
  const runLog = initRunLog(keywords);
  let nextArticleNum = getNextArticleNumber();
  log(`文章编号从 ${nextArticleNum} 开始`);

  for (const k of keywords) {
    const style = k.recommended_style || matrix.style_suggestion || 'C';
    const articleNumber = nextArticleNum++;
    let retries = 0;
    let articleResult = null;

    while (retries <= CONFIG.maxRetries) {
      try {
        articleResult = await runPipeline(k.keyword, style, { dryRun, articleNumber });
        if (articleResult.success) {
          markCompleted(state, k.keyword);
          runLog.completed++;
          runLog.articles.push(articleResult);
          break;
        }
      } catch (err) {
        log(`流水线异常: ${err.message}`, 'ERROR');
      }
      retries++;
      if (retries <= CONFIG.maxRetries) {
        log(`重试 ${retries}/${CONFIG.maxRetries}...`, 'WARN');
        await sleep(5000);
      }
    }

    if (!articleResult || !articleResult.success) {
      markFailed(state, k.keyword, '超过最大重试次数');
      runLog.failed++;
      log(`放弃: "${k.keyword}"`, 'ERROR');
    }

    if (keywords.indexOf(k) < keywords.length - 1) {
      log(`等待 ${CONFIG.articleDelay / 1000}s 后处理下一篇...`);
      await sleep(CONFIG.articleDelay);
    }
  }

  const logPath = saveRunLog(runLog);

  log('\n' + '═'.repeat(60));
  log(`运行完成`);
  log(`  完成: ${runLog.completed} 篇`);
  log(`  失败: ${runLog.failed} 篇`);
  log(`  跳过: ${runLog.skipped} 篇`);
  log(`  日志: ${logPath}`);
  log('═'.repeat(60));
  if (runLog.completed > 0) {
    log(`\n${'═'.repeat(60)}`);
    log(`[人工审核] 请检查以下生成的文章：`);
    runLog.articles.forEach((a, i) => {
      const draft = (() => {
        try {
          const p = path.join(CONFIG.outputDir, 'content-draft.json');
          return JSON.parse(fs.readFileSync(p, 'utf8'));
        } catch { return null; }
      })();
      log(`  ${i + 1}. ${draft?.title || a.keyword} [风格 ${a.style}]`);
      if (draft?.quality_flags?.word_count) log(`     字数: ${draft.quality_flags.word_count}`);
      if (draft?.article_path) log(`     正文: ${draft.article_path}`);
    });
    log(`\n确认无误后，回到 Claude 对话输入：`);
    log(`  PUBLISH: from_content_draft`);
    log(`即可触发发布（更新 articles.html / script.js / article-index.md / sitemap.xml 并 git push）`);
    log('═'.repeat(60));
  }
}

// ── 状态查看 ─────────────────────────────────────────────────────
function showStatus() {
  const state = loadState();
  const logFiles = fs.existsSync(CONFIG.logsDir)
    ? fs.readdirSync(CONFIG.logsDir)
        .filter(f => f.startsWith('farm-run-'))
        .sort()
        .reverse()
        .slice(0, 3)
    : [];

  log('═'.repeat(60));
  log('SEO Farm 状态');
  log('═'.repeat(60));
  log(`已完成关键词 (${state.completed.length}):`);
  state.completed.forEach(k => log(`  ✓ ${k}`));

  if (state.failed.length > 0) {
    log(`\n失败关键词 (${state.failed.length}):`);
    state.failed.forEach(f => log(`  ✗ ${f.keyword}: ${f.reason}`));
  }

  if (logFiles.length > 0) {
    log(`\n最近运行日志:`);
    logFiles.forEach(f => {
      try {
        const run = JSON.parse(fs.readFileSync(path.join(CONFIG.logsDir, f), 'utf8'));
        log(`  ${f}: 完成 ${run.completed}/${run.total}，失败 ${run.failed}`);
      } catch { log(`  ${f}`); }
    });
  }
}

// ── CLI 入口 ─────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--status')) {
    showStatus();
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法:
  node farm-scheduler.js                          全自动批量生产
  node farm-scheduler.js --keyword "n8n 教程"     单关键词完整流水线
  node farm-scheduler.js --dry-run                只打印计划，不执行
  node farm-scheduler.js --status                 查看运行状态
  node farm-scheduler.js --reset                  清除断点续跑状态

注意: SERP 抓取由 keyword-agent 负责，farm-scheduler 只读缓存。
`);
    return;
  }

  if (args.includes('--reset')) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ completed: [], failed: [] }, null, 2));
    log('状态已重置', 'OK');
    return;
  }

  const options = {
    dryRun: args.includes('--dry-run'),
    engine: args.includes('--engine') ? args[args.indexOf('--engine') + 1] : CONFIG.serpEngine,
    singleKeyword: args.includes('--keyword') ? args[args.indexOf('--keyword') + 1] : null,
    style: args.includes('--style') ? args[args.indexOf('--style') + 1] : null,
  };

  // --topic 模式：提示用户先运行 keyword-agent
  if (args.includes('--topic')) {
    const topic = args[args.indexOf('--topic') + 1];
    log(`[--topic 模式] 请先在 Claude 中运行: TOPIC: ${topic}`);
    log('keyword-agent 完成后，再运行: node farm-scheduler.js');
    return;
  }

  await runScheduler(options);
}

main().catch(err => {
  log(`调度器崩溃: ${err.message}`, 'ERROR');
  console.error(err.stack);
  process.exit(1);
});
