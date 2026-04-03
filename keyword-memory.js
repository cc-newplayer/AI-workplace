// ════════════════════════════════════════════════════════════════
// keyword-memory.js — 关键词记忆库
//
// 职责：
//   - 管理 output/keyword-memory.json（跨次运行的关键词历史）
//   - 管理 output/serp-cache/（SERP 抓取缓存，按核心词存储）
//   - 提供聚类、缓存查询、记录更新等接口
//
// 被以下模块调用：
//   - serp-scraper.js（查缓存、写缓存）
//   - farm-scheduler.js（查记忆库、标记已写文章）
//   - keyword-agent 通过 farm-scheduler 间接使用
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = './output';
const MEMORY_FILE = path.join(OUTPUT_DIR, 'keyword-memory.json');
const CACHE_DIR = path.join(OUTPUT_DIR, 'serp-cache');
const KEYWORD_ARCHIVE_DIR = path.join(OUTPUT_DIR, 'keyword-archive');
// 缓存有效期（天）
const CACHE_TTL_DAYS = 7;

// ── 初始化 ───────────────────────────────────────────────────────
function ensureDirs() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(KEYWORD_ARCHIVE_DIR)) fs.mkdirSync(KEYWORD_ARCHIVE_DIR, { recursive: true });
}

// ── 记忆库读写 ───────────────────────────────────────────────────
function loadMemory() {
  ensureDirs();
  if (!fs.existsSync(MEMORY_FILE)) return { updated_at: null, keywords: {} };
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  } catch {
    return { updated_at: null, keywords: {} };
  }
}

function saveMemory(memory) {
  memory.updated_at = new Date().toISOString();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf8');
}

// ── 核心词提取（聚类基础）────────────────────────────────────────
// 去掉意图修饰词，提取可用于聚类和缓存 key 的核心词
const INTENT_SUFFIXES = [
  '是什么', '怎么用', '如何用', '教程', '入门', '保姆级', '手把手',
  '零代码', '小白', '怎么做', '使用方法', '使用教程', '详解', '指南',
  '对比', '测评', '评测', '原理', '架构', '底层', '深度', '分析',
  '2024', '2025', '2026', '最新', '趋势', '科普', '什么是',
  '国内', '国产', '免费', '平替', '推荐', '合集',
];

function extractCoreTerm(keyword) {
  let core = keyword.trim().toLowerCase();
  // 去掉意图修饰词
  for (const suffix of INTENT_SUFFIXES) {
    core = core.replace(new RegExp(suffix, 'g'), '');
  }
  // 去掉多余空格和标点
  core = core.replace(/[\s\-_,，。？?！!]+/g, '-').replace(/^-+|-+$/g, '').trim();
  return core || keyword.toLowerCase().slice(0, 20);
}

// 把一组关键词聚类，返回 { coreTerm -> [keyword, keyword, ...] }
function clusterKeywords(keywords) {
  const clusters = {};
  for (const kw of keywords) {
    const core = extractCoreTerm(kw);
    if (!clusters[core]) clusters[core] = [];
    clusters[core].push(kw);
  }
  return clusters;
}

// ── SERP 缓存 ────────────────────────────────────────────────────
function getCacheKey(coreTerm, engine) {
  const slug = coreTerm.replace(/[^\w\u4e00-\u9fa5]+/g, '-').slice(0, 40);
  return path.join(CACHE_DIR, `${slug}-${engine}.json`);
}

function isCacheValid(cacheFile) {
  if (!fs.existsSync(cacheFile)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const scraped = new Date(data.scraped_at);
    const ageMs = Date.now() - scraped.getTime();
    return ageMs < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function readCache(coreTerm, engine = 'baidu') {
  const cacheFile = getCacheKey(coreTerm, engine);
  if (!isCacheValid(cacheFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(coreTerm, engine, serpData) {
  ensureDirs();
  const cacheFile = getCacheKey(coreTerm, engine);
  const data = { ...serpData, scraped_at: new Date().toISOString(), core_term: coreTerm };
  fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf8');
  return cacheFile;
}

// ── 记忆库操作 ───────────────────────────────────────────────────

// 查询关键词记录（不存在返回 null）
function lookup(keyword) {
  const memory = loadMemory();
  const core = extractCoreTerm(keyword);
  return memory.keywords[core] || null;
}

// 更新关键词记录（SERP 抓取后调用）
function updateFromSerp(keyword, serpData) {
  const memory = loadMemory();
  const core = extractCoreTerm(keyword);

  if (!memory.keywords[core]) {
    memory.keywords[core] = {
      core_term: core,
      variants: [],
      first_seen: new Date().toISOString().slice(0, 10),
      last_scraped: null,
      serp_history: [],
      article_written: false,
      article_id: null,
      recommendation_score_history: [],
    };
  }

  const record = memory.keywords[core];

  // 添加变体词
  if (!record.variants.includes(keyword)) record.variants.push(keyword);

  // 更新抓取时间
  record.last_scraped = new Date().toISOString().slice(0, 10);

  // 追加 SERP 历史（只保留最近 5 次）
  const snapshot = {
    date: new Date().toISOString().slice(0, 10),
    total_results: serpData.total_result_count ?? serpData.total_results ?? 0,  // 优先用真实总数
    top3_titles: (serpData.results || []).slice(0, 3).map(r => r.title),
    recency: serpData.recency || null,
    avg_word_count: serpData.competitor_summary?.avg_word_count || 0,
    avg_keyword_density: serpData.competitor_summary?.avg_keyword_density || 0,
  };
  record.serp_history.push(snapshot);
  if (record.serp_history.length > 5) record.serp_history.shift();

  saveMemory(memory);
  return record;
}

// 更新评分历史
function updateScore(keyword, score) {
  const memory = loadMemory();
  const core = extractCoreTerm(keyword);
  if (!memory.keywords[core]) return;

  const record = memory.keywords[core];
  record.recommendation_score_history = record.recommendation_score_history || [];
  record.recommendation_score_history.push({
    date: new Date().toISOString().slice(0, 10),
    score,
  });
  if (record.recommendation_score_history.length > 10) {
    record.recommendation_score_history.shift();
  }

  saveMemory(memory);
}

// 标记已写文章
function markArticleWritten(keyword, articleId) {
  const memory = loadMemory();
  const core = extractCoreTerm(keyword);
  if (!memory.keywords[core]) {
    memory.keywords[core] = {
      core_term: core,
      variants: [keyword],
      first_seen: new Date().toISOString().slice(0, 10),
      last_scraped: null,
      serp_history: [],
      article_written: true,
      article_id: articleId,
      recommendation_score_history: [],
    };
  } else {
    memory.keywords[core].article_written = true;
    memory.keywords[core].article_id = articleId;
  }
  saveMemory(memory);
}

// 检查是否已写过文章
function isArticleWritten(keyword) {
  const record = lookup(keyword);
  return record ? record.article_written : false;
}

// 获取竞争趋势（连续两次抓取对比）
function getCompetitionTrend(keyword) {
  const record = lookup(keyword);
  if (!record || record.serp_history.length < 2) return null;

  const history = record.serp_history;
  const latest = history[history.length - 1];
  const prev = history[history.length - 2];

  return {
    result_count_change: latest.total_results - prev.total_results,
    word_count_change: latest.avg_word_count - prev.avg_word_count,
    trend: latest.total_results > prev.total_results ? 'increasing' : 'decreasing',
  };
}

// 打印记忆库摘要
function printSummary() {
  const memory = loadMemory();
  const records = Object.values(memory.keywords);
  const written = records.filter(r => r.article_written).length;
  const cached = fs.existsSync(CACHE_DIR)
    ? fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json')).length
    : 0;

  console.log(`[keyword-memory] 记忆库摘要`);
  console.log(`  关键词记录: ${records.length} 条`);
  console.log(`  已写文章: ${written} 个`);
  console.log(`  SERP 缓存: ${cached} 个`);
  console.log(`  最后更新: ${memory.updated_at || '从未'}`);

  if (records.length > 0) {
    console.log(`\n  已写文章的核心词:`);
    records.filter(r => r.article_written).forEach(r => {
      console.log(`    #${r.article_id} ${r.core_term} (${r.variants.join(', ')})`);
    });
  }
}

module.exports = {
  extractCoreTerm,
  clusterKeywords,
  readCache,
  writeCache,
  lookup,
  updateFromSerp,
  updateScore,
  markArticleWritten,
  isArticleWritten,
  getCompetitionTrend,
  printSummary,
  CACHE_TTL_DAYS,
};

// CLI：node keyword-memory.js --summary
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--summary')) {
    printSummary();
  } else if (args.includes('--lookup') && args[args.indexOf('--lookup') + 1]) {
    const kw = args[args.indexOf('--lookup') + 1];
    const result = lookup(kw);
    console.log(result ? JSON.stringify(result, null, 2) : `未找到: "${kw}"`);
  } else {
    console.log('用法:');
    console.log('  node keyword-memory.js --summary');
    console.log('  node keyword-memory.js --lookup "AI Agent"');
  }
}
