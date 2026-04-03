// ════════════════════════════════════════════════════════════════
// serp-scraper.js — SERP 竞品数据抓取器
//
// 功能：
//   1. 抓取 Google / 百度 搜索结果（标题、URL、摘要、排名）
//   2. 可选：进入每个结果页抓取字数、H 标签、关键词密度
//   3. 关键词聚类：同核心词只抓一次，结果共享
//   4. 缓存：同一核心词 7 天内不重复抓取
//   5. 结果写入 keyword-memory.js 记忆库
//
// 使用方法：
//   node serp-scraper.js "关键词"                    # 抓 Google，只抓 SERP
//   node serp-scraper.js "关键词" --engine baidu     # 抓百度（全量结果）
//   node serp-scraper.js "关键词" --engine baidu --time-filter  # 限定近7天
//   node serp-scraper.js "关键词" --deep             # 进入每个结果页深度分析
//   node serp-scraper.js "关键词" --pages 2          # 抓前 2 页（默认 1 页）
//   node serp-scraper.js "关键词" --force            # 忽略缓存强制重新抓
//   node serp-scraper.js --batch                     # 批量模式：读 keyword-matrix-latest.json
//
// 输出：
//   output/serp-cache/<core-term>-<engine>.json      缓存文件（7天有效）
//   output/serp-latest.json                          最新结果（供 farm-scheduler 读取）
// ════════════════════════════════════════════════════════════════

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const memory = require('./keyword-memory');

// ── 配置区 ──────────────────────────────────────────────────────
const CONFIG = {
  outputDir: './output',
  logsDir: './output/logs',
  userDataDir: path.join(os.homedir(), '.serp-browser-data'),
  // 每次请求间隔（ms），避免被封
  requestDelay: { min: 1500, max: 3500 },
  // 深度抓取时每个页面超时（ms）
  pageTimeout: 15000,
  // 每页结果数上限
  resultsPerPage: 10,
  // User-Agent 轮换池
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  ],
};
// ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay() {
  const { min, max } = CONFIG.requestDelay;
  return sleep(min + Math.random() * (max - min));
}

function toSlug(keyword) {
  return keyword
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Google SERP 抓取 ─────────────────────────────────────────────
async function scrapeGoogle(page, keyword, pageNum = 1) {
  const start = (pageNum - 1) * 10;
  const url = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&start=${start}&hl=zh-CN&num=10`;

  console.log(`  [Google] 第 ${pageNum} 页: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await randomDelay();

  // 检测验证码
  const captcha = await page.locator('form#captcha-form, #recaptcha').isVisible({ timeout: 2000 }).catch(() => false);
  if (captcha) {
    console.warn('  [警告] 检测到 Google 验证码，请手动通过后按 Enter 继续...');
    await page.waitForTimeout(30000);
  }

  const results = await page.evaluate((startRank) => {
    const items = [];
    // Google 有机结果选择器
    const nodes = document.querySelectorAll('div.g, div[data-sokoban-container]');
    let rank = startRank + 1;

    nodes.forEach(node => {
      const titleEl = node.querySelector('h3');
      const linkEl = node.querySelector('a[href]');
      const snippetEl = node.querySelector('div[data-sncf], div.VwiC3b, span.aCOpRe');

      if (!titleEl || !linkEl) return;
      const href = linkEl.getAttribute('href');
      if (!href || href.startsWith('/search') || href.startsWith('#')) return;

      items.push({
        rank,
        title: titleEl.innerText.trim(),
        url: href,
        snippet: snippetEl ? snippetEl.innerText.trim().slice(0, 200) : '',
        source: 'google',
      });
      rank++;
    });

    return items;
  }, start);

  return results;
}

// ── 百度 SERP 抓取 ───────────────────────────────────────────────
async function scrapeBaidu(page, keyword, pageNum = 1, timeFilter = false) {
  const pn = (pageNum - 1) * 10;
  // gpc=stf 限定时间范围：stf=<起始时间戳>,<结束时间戳>（默认关闭，用 --time-filter 开启）
  let timeParam = '';
  if (timeFilter) {
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 24 * 3600;
    timeParam = `&gpc=stf%3D${weekAgo}%2C${now}%7Cstftype%3D1`;
  }
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}&pn=${pn}&rn=10${timeParam}`;

  console.log(`  [百度] 第 ${pageNum} 页${timeFilter ? '（近7天）' : ''}: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await randomDelay();

  const { items, totalResultCount } = await page.evaluate((startRank) => {
    const items = [];
    const nodes = document.querySelectorAll('.result.c-container, .result-op.c-container');
    let rank = startRank + 1;

    nodes.forEach(node => {
      const titleEl = node.querySelector('h3 a, .t a');
      const snippetEl = node.querySelector('.c-abstract, .content-right_8Zs40');
      // 百度在 snippet 或 c-color-gray 里常带日期，格式如 "2026年4月1日" 或 "4天前"
      const dateEl = node.querySelector('.c-color-gray, .newTimeFactor_tMjpS, .c-abstract');
      let date = '';
      if (dateEl) {
        const dateMatch = dateEl.innerText.match(/(\d{4}年\d{1,2}月\d{1,2}日|\d+天前|\d+小时前|\d{4}-\d{2}-\d{2})/);
        if (dateMatch) date = dateMatch[1];
      }

      if (!titleEl) return;
      const href = titleEl.getAttribute('href');
      if (!href) return;

      items.push({
        rank,
        title: titleEl.innerText.trim(),
        url: href,
        snippet: snippetEl ? snippetEl.innerText.trim().slice(0, 200) : '',
        date,
        source: 'baidu',
      });
      rank++;
    });

    // 抓取百度显示的总结果数，如"百度为您找到相关结果约1,230,000个"
    let totalResultCount = null;
    const countEl = document.querySelector('#tsn_inner .nums, .nums_text');
    if (countEl) {
      const match = countEl.innerText.match(/[\d,，]+/);
      if (match) totalResultCount = parseInt(match[0].replace(/[,，]/g, ''), 10);
    }

    return { items, totalResultCount };
  }, pn);

  return { results: items, totalResultCount };
}

// ── 深度分析：进入结果页抓取内容特征 ────────────────────────────
async function deepAnalyzePage(page, item, keyword) {
  try {
    await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: CONFIG.pageTimeout });
    await randomDelay();

    const analysis = await page.evaluate((kw) => {
      const text = document.body.innerText || '';
      const wordCount = text.replace(/\s+/g, '').length; // 中文按字符计

      // H 标签提取
      const headings = [];
      document.querySelectorAll('h1,h2,h3').forEach(h => {
        headings.push({ tag: h.tagName, text: h.innerText.trim().slice(0, 80) });
      });

      // 关键词密度（简单计算）
      const kwCount = (text.match(new RegExp(kw, 'gi')) || []).length;
      const density = wordCount > 0 ? ((kwCount / wordCount) * 100).toFixed(2) : '0';

      // 内链数量
      const internalLinks = Array.from(document.querySelectorAll('a[href]'))
        .filter(a => {
          try {
            const href = a.getAttribute('href');
            return href && !href.startsWith('http') || (new URL(a.href).hostname === location.hostname);
          } catch { return false; }
        }).length;

      // meta description
      const metaDesc = document.querySelector('meta[name="description"]');

      return {
        word_count: wordCount,
        headings: headings.slice(0, 10),
        keyword_density: parseFloat(density),
        internal_links: internalLinks,
        meta_description: metaDesc ? metaDesc.getAttribute('content') : '',
        has_images: document.querySelectorAll('img').length,
        title_tag: document.title,
      };
    }, keyword);

    return { ...item, deep: analysis };
  } catch (err) {
    return { ...item, deep: { error: err.message } };
  }
}

// ── 主抓取流程 ───────────────────────────────────────────────────
async function scrapeKeyword(keyword, options = {}) {
  const { engine = 'google', deep = false, pages = 1, timeFilter = false } = options;

  console.log(`\n[serp-scraper] 关键词: "${keyword}" | 引擎: ${engine} | 深度: ${deep} | 页数: ${pages}${timeFilter ? ' | 近7天' : ''}`);

  const ua = CONFIG.userAgents[Math.floor(Math.random() * CONFIG.userAgents.length)];
  const context = await chromium.launchPersistentContext(CONFIG.userDataDir, {
    headless: true,
    viewport: { width: 1366, height: 768 },
    userAgent: ua,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = await context.newPage();
  // 隐藏 webdriver 特征
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  let allResults = [];
  let totalResultCount = null;

  try {
    for (let p = 1; p <= pages; p++) {
      let pageResults;
      if (engine === 'baidu') {
        const { results, totalResultCount: cnt } = await scrapeBaidu(page, keyword, p, timeFilter);
        pageResults = results;
        // 只取第一页的总结果数
        if (p === 1 && cnt !== null) totalResultCount = cnt;
      } else {
        pageResults = await scrapeGoogle(page, keyword, p);
      }

      allResults = allResults.concat(pageResults);

      if (p < pages) await randomDelay();
    }

    // 深度分析
    if (deep && allResults.length > 0) {
      console.log(`  [深度分析] 开始分析 ${allResults.length} 个结果页...`);
      const analyzed = [];
      for (const item of allResults) {
        console.log(`    分析 #${item.rank}: ${item.url.slice(0, 60)}`);
        const result = await deepAnalyzePage(page, item, keyword);
        analyzed.push(result);
        await randomDelay();
      }
      allResults = analyzed;
    }
  } finally {
    await context.close();
  }

  return { results: allResults, totalResultCount };
}

// ── 竞品摘要统计 ─────────────────────────────────────────────────
function buildCompetitorSummary(results) {
  const deepResults = results.filter(r => r.deep && !r.deep.error);
  if (deepResults.length === 0) return null;

  const wordCounts = deepResults.map(r => r.deep.word_count).filter(n => n > 0);
  const avgWordCount = wordCounts.length
    ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
    : 0;

  const avgDensity = deepResults.length
    ? (deepResults.reduce((a, r) => a + (r.deep.keyword_density || 0), 0) / deepResults.length).toFixed(2)
    : 0;

  // 高频 H2 词汇（粗略提取）
  const allHeadings = deepResults.flatMap(r => r.deep.headings || [])
    .filter(h => h.tag === 'H2')
    .map(h => h.text);

  return {
    analyzed_count: deepResults.length,
    avg_word_count: avgWordCount,
    avg_keyword_density: parseFloat(avgDensity),
    top_h2_samples: allHeadings.slice(0, 10),
    recommendation: avgWordCount > 0
      ? `竞品均字数约 ${avgWordCount} 字，建议本文 ≥ ${Math.round(avgWordCount * 1.2)} 字`
      : null,
  };
}

// ── 从结果中提取 recency（前3名最新日期） ────────────────────────
function extractRecency(results) {
  const dates = results.slice(0, 3)
    .map(r => r.date)
    .filter(Boolean);
  if (dates.length === 0) return null;
  // 优先返回最新的一条
  return dates[0];
}

// ── 输出 JSON ────────────────────────────────────────────────────
function saveResults(keyword, results, totalResultCount, options) {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const slug = toSlug(keyword);
  const date = today();
  const output = {
    scraped_at: new Date().toISOString(),
    keyword,
    engine: options.engine || 'google',
    deep_analysis: options.deep || false,
    total_results: results.length,
    total_result_count: totalResultCount,   // 百度页面显示的"约X条"真实数字
    recency: extractRecency(results),       // 前3名中最新的发布日期
    competitor_summary: buildCompetitorSummary(results),
    results,
  };

  // 写入缓存（按核心词存储）
  const coreTerm = memory.extractCoreTerm(keyword);
  memory.writeCache(coreTerm, options.engine || 'google', output);

  // 更新记忆库
  memory.updateFromSerp(keyword, output);

  // 同时写一份 serp-latest.json 供 farm-scheduler 读取
  const latest = path.join(CONFIG.outputDir, 'serp-latest.json');
  fs.writeFileSync(latest, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n[serp-scraper] 完成`);
  console.log(`  核心词: ${coreTerm}`);
  console.log(`  抓取条目: ${results.length}`);
  console.log(`  总结果数: ${totalResultCount !== null ? totalResultCount.toLocaleString() : '未获取'}`);
  console.log(`  最新内容: ${output.recency || '未获取'}`);
  if (output.competitor_summary) {
    console.log(`  竞品均字数: ${output.competitor_summary.avg_word_count}`);
    console.log(`  关键词密度: ${output.competitor_summary.avg_keyword_density}%`);
  }
  console.log(`  缓存: output/serp-cache/${coreTerm}-${options.engine || 'google'}.json`);

  return output;
}

// ── 批量模式：读 keyword-matrix-latest.json ──────────────────────
async function batchMode(options) {
  const matrixPath = path.join(CONFIG.outputDir, 'keyword-matrix-latest.json');
  if (!fs.existsSync(matrixPath)) {
    console.error('[错误] 未找到 output/keyword-matrix-latest.json，请先运行 keyword-agent');
    process.exit(1);
  }

  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const keywords = matrix.keywords.map(k => k.keyword);

  // 聚类：同核心词只抓一次
  const clusters = memory.clusterKeywords(keywords);
  const coreTerms = Object.keys(clusters);

  console.log(`[批量模式] ${keywords.length} 个关键词 → 聚类后 ${coreTerms.length} 个核心词`);
  coreTerms.forEach(core => {
    const variants = clusters[core];
    if (variants.length > 1) {
      console.log(`  [聚类] "${core}": ${variants.join(' / ')}`);
    }
  });

  const allOutputs = [];
  for (const core of coreTerms) {
    const variants = clusters[core];
    const representative = variants[0]; // 用第一个变体词作为搜索词

    // 检查缓存
    if (!options.force) {
      const cached = memory.readCache(core, options.engine || 'google');
      if (cached) {
        console.log(`\n[缓存命中] "${core}"，跳过抓取（${cached.scraped_at?.slice(0, 10)}）`);
        allOutputs.push({ keyword: representative, core_term: core, source: 'cache', total: cached.total_results });
        continue;
      }
    }

    const { results, totalResultCount } = await scrapeKeyword(representative, options);
    const output = saveResults(representative, results, totalResultCount, options);
    allOutputs.push({ keyword: representative, core_term: core, source: 'scraped', total: output.total_results });
    await sleep(3000);
  }

  // 汇总写入
  const summaryPath = path.join(CONFIG.logsDir, `serp-batch-${today()}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(allOutputs, null, 2), 'utf8');
  console.log(`\n[批量完成] 汇总: ${summaryPath}`);
  console.log(`  实际抓取: ${allOutputs.filter(o => o.source === 'scraped').length} 个`);
  console.log(`  缓存命中: ${allOutputs.filter(o => o.source === 'cache').length} 个`);
}

// ── CLI 入口 ─────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法:');
    console.log('  node serp-scraper.js "关键词"');
    console.log('  node serp-scraper.js "关键词" --engine baidu');
    console.log('  node serp-scraper.js "关键词" --deep');
    console.log('  node serp-scraper.js "关键词" --pages 2');
    console.log('  node serp-scraper.js --batch [--engine baidu] [--deep]');
    process.exit(0);
  }

  const options = {
    engine: args.includes('--engine') ? args[args.indexOf('--engine') + 1] : 'google',
    deep: args.includes('--deep'),
    pages: args.includes('--pages') ? parseInt(args[args.indexOf('--pages') + 1]) || 1 : 1,
    force: args.includes('--force'),
    timeFilter: args.includes('--time-filter'),  // 默认关闭，显式传 --time-filter 才开启
  };

  if (args[0] === '--batch') {
    await batchMode(options);
  } else {
    const keyword = args[0];
    const coreTerm = memory.extractCoreTerm(keyword);

    // 检查缓存（单词条模式）
    if (!options.force) {
      const cached = memory.readCache(coreTerm, options.engine);
      if (cached) {
        console.log(`[缓存命中] "${keyword}" (核心词: ${coreTerm})，上次抓取: ${cached.scraped_at?.slice(0, 10)}`);
        console.log(`  结果数: ${cached.total_results}，使用 --force 可强制重新抓取`);
        return;
      }
    }

    const { results, totalResultCount } = await scrapeKeyword(keyword, options);
    saveResults(keyword, results, totalResultCount, options);
  }
}

main().catch(err => {
  console.error('[serp-scraper] 错误:', err.message);
  process.exit(1);
});
