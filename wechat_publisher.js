// ══════════════════════════════════��═════════════════════════════
// 微信公众号发布脚本
//
// 使用方法：
//   node wechat_publisher.js <html文件路径> [--draft-only]
//
//   --draft-only  只创建草稿，不发布（建议首次验证时使用）
//
// 示例：
//   node wechat_publisher.js "../AI工具入门示例/web/13_dify-tutorial.html" --draft-only
//   node wechat_publisher.js "../AI工具入门示例/web/13_dify-tutorial.html"
//
// 前置要求：
//   1. 填写 wx_config.js 中的 APP_ID 和 APP_SECRET
//   2. npm install（已含 cheerio）
// ════════════════════════════════════════════════════════════════

'use strict';

const config = require('./wx_config.js');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { load } = require('cheerio');
const { chromium } = require('playwright');

// ── 配置区 ───────────────────────────────────────────────────────
const TOKEN_CACHE_PATH = path.join(__dirname, 'output', 'wx_token.json');
const WX_API = 'api.weixin.qq.com';

// CSS 类名 → 微信兼容内联样式映射
const STYLE_MAP = {
  // 标题
  h1: 'font-size:22px;font-weight:800;color:#111827;margin:0 0 16px;line-height:1.4;',
  h2: 'font-size:19px;font-weight:700;color:#111827;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #2563EB;line-height:1.4;',
  h3: 'font-size:16px;font-weight:700;color:#111827;margin:18px 0 8px;line-height:1.4;',
  h4: 'font-size:15px;font-weight:700;color:#111827;margin:14px 0 6px;',
  // 段落 & 行内
  p:      'font-size:15px;line-height:1.85;color:#374151;margin:0 0 12px;',
  strong: 'font-weight:700;color:#111827;',
  em:     'font-style:italic;',
  a:      'color:#2563EB;text-decoration:none;',
  // 列表
  ul: 'margin:0 0 12px;padding-left:20px;',
  ol: 'margin:0 0 12px;padding-left:20px;',
  li: 'font-size:15px;line-height:1.85;color:#374151;margin-bottom:4px;',
  // 表格
  table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
  th:    'background:#EFF6FF;padding:10px 12px;text-align:left;border:1px solid #E5E7EB;font-weight:600;color:#1D4ED8;',
  td:    'padding:10px 12px;border:1px solid #E5E7EB;color:#374151;',
  // 图片
  img:   'max-width:100%;height:auto;border-radius:6px;margin:12px auto;display:block;',
  // 引用
  blockquote: 'border-left:4px solid #E5E7EB;padding:8px 16px;margin:16px 0;color:#6B7280;font-style:italic;',
  // 代码
  code: 'font-family:Consolas,monospace;font-size:13px;background:#F3F4F6;padding:2px 6px;border-radius:4px;color:#374151;',
  pre:  'font-family:Consolas,monospace;font-size:13px;background:#F3F4F6;padding:16px;border-radius:6px;overflow-x:auto;margin:16px 0;',
};

// 按 class 名打的额外样式（会叠加到元素已有 style 上）
const CLASS_STYLE_MAP = {
  'callout':          'background:#EFF6FF;border-left:4px solid #2563EB;border-radius:6px;padding:14px 16px;margin:16px 0;font-size:14px;line-height:1.7;color:#374151;',
  'callout-tip':      'background:#FFFBEB;border-left:4px solid #D97706;border-radius:6px;padding:14px 16px;margin:16px 0;font-size:14px;line-height:1.7;color:#374151;',
  'callout-warning':  'background:#FEF2F2;border-left:4px solid #DC2626;border-radius:6px;padding:14px 16px;margin:16px 0;font-size:14px;line-height:1.7;color:#374151;',
  'callout-info':     'background:#EFF6FF;border-left:4px solid #2563EB;border-radius:6px;padding:14px 16px;margin:16px 0;font-size:14px;line-height:1.7;color:#374151;',
  'callout-body':     'font-size:14px;line-height:1.7;color:#374151;',
  'callout-icon':     'font-size:18px;margin-right:8px;',
  'step':             'display:flex;gap:16px;padding:16px 0;border-bottom:1px solid #E5E7EB;align-items:flex-start;',
  'step-num':         'flex-shrink:0;min-width:28px;height:28px;background:#2563EB;color:#fff;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:14px;',
  'step-content':     'flex:1;',
  'steps':            'margin:16px 0;',
  'metric-card':      'background:#EFF6FF;border-radius:8px;padding:20px;text-align:center;margin:8px 4px;display:inline-block;min-width:140px;',
  'metric-value':     'font-size:28px;font-weight:800;color:#2563EB;',
  'metric-label':     'font-size:13px;color:#6B7280;margin-top:4px;',
  'badge':            'display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;background:#EFF6FF;color:#2563EB;margin-right:6px;',
  'badge-tutorial':   'background:#EFF6FF;color:#2563EB;',
  'table-wrapper':    'overflow-x:auto;margin:16px 0;',
  'diagram':          'background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin:16px 0;',
  'diagram-title':    'font-size:13px;font-weight:600;color:#6B7280;text-align:center;margin-bottom:12px;',
  'faq':              'margin:16px 0;',
  'faq-item':         'border-bottom:1px solid #E5E7EB;padding:16px 0;',
  'faq-q':            'font-weight:700;color:#111827;font-size:15px;margin-bottom:8px;',
  'faq-a':            'font-size:14px;color:#374151;line-height:1.7;',
  'verify-box':       'background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:20px;margin:24px 0;',
  'next-steps':       'background:#EFF6FF;border-radius:8px;padding:20px;margin:24px 0;',
  'article-lead':     'font-size:16px;line-height:1.85;color:#374151;margin-top:12px;',
};
// ────────────────────────────────────────────────────────────────

// ── HTTP 工具 ────────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function httpsPostMultipart(hostname, apiPath, filePath, filename) {
  return new Promise((resolve, reject) => {
    const boundary = '----WxBoundary' + Date.now();
    const fileData = fs.readFileSync(filePath);
    const ext = filename.split('.').pop();
    const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
    const mime = mimeTypes[ext.toLowerCase()] || 'image/jpeg';

    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileData, footer]);

    const options = {
      hostname, path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
// ────────────────────────────────────────────────────────────────

// ── 1. Access Token 管理 ─────────────────────────────────────────
async function getAccessToken() {
  // 读缓存
  if (fs.existsSync(TOKEN_CACHE_PATH)) {
    const cache = JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, 'utf8'));
    const remaining = cache.expires_at - Date.now();
    if (remaining > 5 * 60 * 1000) {
      console.log(`✅ 复用 token（剩余 ${Math.round(remaining / 60000)} 分钟）`);
      return cache.access_token;
    }
  }
  // 重新获取
  console.log('🔑 请求新 access_token...');
  const url = `https://${WX_API}/cgi-bin/token?grant_type=client_credential&appid=${config.APP_ID}&secret=${config.APP_SECRET}`;
  const res = await httpsGet(url);
  if (res.errcode) throw new Error(`获取 token 失败: ${res.errmsg} (${res.errcode})`);
  const cache = {
    access_token: res.access_token,
    expires_at: Date.now() + (res.expires_in - 60) * 1000,
  };
  fs.mkdirSync(path.dirname(TOKEN_CACHE_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(cache));
  console.log('✅ access_token 已获取并缓存');
  return cache.access_token;
}
// ────────────────────────────────────────────────────────────────

// ── 2. 图片上传 ──────────────────────────────────────────────────
const _uploadedCache = {};  // 本次运行内复用：本地路径 → media_id + url

async function uploadImageToWx(localPath, token) {
  if (_uploadedCache[localPath]) return _uploadedCache[localPath];
  if (!fs.existsSync(localPath)) {
    console.warn(`  ⚠️  图片文件不存在，跳过: ${localPath}`);
    return null;
  }
  const filename = path.basename(localPath);
  console.log(`  ↑ 上传图片: ${filename}`);
  const apiPath = `/cgi-bin/material/add_material?access_token=${token}&type=image`;
  const res = await httpsPostMultipart(WX_API, apiPath, localPath, filename);
  if (res.errcode) {
    console.warn(`  ⚠️  图片上传失败: ${res.errmsg} (${res.errcode})`);
    return null;
  }
  console.log(`  ✅ 上传成功: media_id=${res.media_id}`);
  const result = { media_id: res.media_id, url: res.url };
  _uploadedCache[localPath] = result;
  return result;
}
// ────────────────────────────────────────────────────────────────

// ── 2.5 Playwright 预渲染图表为截图 ──────────────────────────────
async function renderDiagramsToImages(htmlPath) {
  const tmpDir = path.join(__dirname, 'output', 'tmp_diagrams');
  fs.mkdirSync(tmpDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });

  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // 等待 Mermaid SVG 渲染完成
  await page.waitForSelector('.mermaid svg', { timeout: 10000 }).catch(() => {});
  // Chart.js canvas 需要额外等待
  await page.waitForTimeout(2000);

  const results = { mermaid: [], chart: [], metric: [], dialogue: [], callout: [] };

  // 截图每个 .callout 元素（带图标小方框，CSS 在微信中错位）
  const calloutEls = await page.locator('.callout').all();
  for (let i = 0; i < calloutEls.length; i++) {
    const imgPath = path.join(tmpDir, `callout_${i}_${Date.now()}.png`);
    try {
      await calloutEls[i].screenshot({ path: imgPath });
      results.callout.push(imgPath);
      console.log(`    💬 Callout[${i}] 截图完成`);
    } catch (e) {
      results.callout.push(null);
      console.warn(`    ⚠️  Callout[${i}] 截图失败: ${e.message}`);
    }
  }

  // 截图每个 .dialogue-wrap 元素（对话框组件，CSS 不兼容微信）
  const dialogueEls = await page.locator('.dialogue-wrap').all();
  for (let i = 0; i < dialogueEls.length; i++) {
    const imgPath = path.join(tmpDir, `dialogue_${i}_${Date.now()}.png`);
    try {
      await dialogueEls[i].screenshot({ path: imgPath });
      results.dialogue.push(imgPath);
      console.log(`    💬 Dialogue[${i}] 截图完成`);
    } catch (e) {
      results.dialogue.push(null);
      console.warn(`    ⚠️  Dialogue[${i}] 截图失败: ${e.message}`);
    }
  }

  // 截图每个 .mermaid 元素
  const mermaidEls = await page.locator('.mermaid').all();
  for (let i = 0; i < mermaidEls.length; i++) {
    const imgPath = path.join(tmpDir, `mermaid_${i}_${Date.now()}.png`);
    try {
      await mermaidEls[i].screenshot({ path: imgPath });
      results.mermaid.push(imgPath);
      console.log(`    📊 Mermaid[${i}] 截图完成`);
    } catch (e) {
      results.mermaid.push(null);
      console.warn(`    ⚠️  Mermaid[${i}] 截图失败: ${e.message}`);
    }
  }

  // 截图每个 .chart-container 元素
  const chartEls = await page.locator('.chart-container').all();
  for (let i = 0; i < chartEls.length; i++) {
    const imgPath = path.join(tmpDir, `chart_${i}_${Date.now()}.png`);
    try {
      await chartEls[i].screenshot({ path: imgPath });
      results.chart.push(imgPath);
      console.log(`    📈 Chart[${i}] 截图完成`);
    } catch (e) {
      results.chart.push(null);
      console.warn(`    ⚠️  Chart[${i}] 截图失败: ${e.message}`);
    }
  }

  // 截图每个 .metric-grid 元素（数据卡片组）
  const metricEls = await page.locator('.metric-grid').all();
  for (let i = 0; i < metricEls.length; i++) {
    const imgPath = path.join(tmpDir, `metric_${i}_${Date.now()}.png`);
    try {
      await metricEls[i].screenshot({ path: imgPath });
      results.metric.push(imgPath);
      console.log(`    🔢 MetricGrid[${i}] 截图完成`);
    } catch (e) {
      results.metric.push(null);
      console.warn(`    ⚠️  MetricGrid[${i}] 截图失败: ${e.message}`);
    }
  }

  await browser.close();
  return results;
}
// ────────────────────────────────────────────────────────────────
function extractArticleInfo(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const $ = load(html);

  const title = $('title').text().trim() || path.basename(htmlPath, '.html');
  const digest = $('meta[name="description"]').attr('content') || '';
  // 取文章正文区域
  const bodyEl = $('.article-body').length ? $('.article-body') : $('body');
  return { title, digest: digest.slice(0, 120), bodyHtml: bodyEl.html() || '', $, html };
}
// ────────────────────────────────────────────────────────────────

// ── 4. HTML → 微信格式转换 ───────────────────────────────────────
async function convertToWechatHtml(bodyHtml, htmlFilePath, token) {
  const imageDir = path.join(path.dirname(htmlFilePath), 'images');
  const $ = load(`<div id="root">${bodyHtml}</div>`);
  const root = $('#root');
  let articleThumbId = null;   // 文章原图（豆包生成/截图），优先用作封面
  let diagramThumbId = null;   // 图表截图，仅做后备封面
  let calloutThumbId = null;   // callout 截图，最后兜底封面

  // 4a. 预渲染 Mermaid / Chart.js 图表为图片并上传
  console.log('  🎨 用浏览器预渲染图表...');
  const diagramImages = await renderDiagramsToImages(htmlFilePath);

  // 替换 .callout 带图标小方框（截图替换，避免微信错位）
  const calloutEls = root.find('.callout').toArray();
  for (let i = 0; i < calloutEls.length; i++) {
    const imgPath = diagramImages.callout[i];
    if (imgPath && fs.existsSync(imgPath)) {
      const uploaded = await uploadImageToWx(imgPath, token);
      if (uploaded) {
        $(calloutEls[i]).replaceWith(`<img src="${uploaded.url}" style="max-width:100%;height:auto;border-radius:8px;margin:16px auto;display:block;">`);
        if (!calloutThumbId) calloutThumbId = uploaded.media_id;
      } else {
        $(calloutEls[i]).replaceWith('<p style="font-size:13px;color:#6B7280;text-align:center;padding:12px;background:#F9FAFB;border-radius:6px;margin:16px 0;">[提示框，见原文]</p>');
      }
    } else {
      $(calloutEls[i]).replaceWith('<p style="font-size:13px;color:#6B7280;text-align:center;padding:12px;background:#F9FAFB;border-radius:6px;margin:16px 0;">[提示框，见原文]</p>');
    }
  }

  // 替换 .dialogue-wrap 对话框（截图替换，保留视觉效果）
  const dialogueEls = root.find('.dialogue-wrap').toArray();
  for (let i = 0; i < dialogueEls.length; i++) {
    const imgPath = diagramImages.dialogue[i];
    if (imgPath && fs.existsSync(imgPath)) {
      const uploaded = await uploadImageToWx(imgPath, token);
      if (uploaded) {
        $(dialogueEls[i]).replaceWith(`<img src="${uploaded.url}" style="max-width:100%;height:auto;border-radius:8px;margin:16px auto;display:block;">`);
      } else {
        $(dialogueEls[i]).replaceWith('<p style="font-size:13px;color:#6B7280;text-align:center;padding:12px;background:#F9FAFB;border-radius:6px;margin:16px 0;">[对话框，见原文]</p>');
      }
    } else {
      $(dialogueEls[i]).replaceWith('<p style="font-size:13px;color:#6B7280;text-align:center;padding:12px;background:#F9FAFB;border-radius:6px;margin:16px 0;">[对话框，见原文]</p>');
    }
  }

  // 替换 Mermaid 元素
  const mermaidEls = root.find('.mermaid').toArray();
  for (let i = 0; i < mermaidEls.length; i++) {
    const imgPath = diagramImages.mermaid[i];
    if (imgPath && fs.existsSync(imgPath)) {
      const uploaded = await uploadImageToWx(imgPath, token);
      if (uploaded) {
        $(mermaidEls[i]).replaceWith(`<img src="${uploaded.url}" style="max-width:100%;height:auto;border-radius:6px;margin:16px auto;display:block;">`);
        if (!diagramThumbId) diagramThumbId = uploaded.media_id;
      } else {
        $(mermaidEls[i]).replaceWith('<p style="font-size:13px;color:#6B7280;text-align:center;padding:12px;background:#F9FAFB;border-radius:6px;margin:16px 0;">[流程图，见原文]</p>');
      }
    } else {
      $(mermaidEls[i]).replaceWith('<p style="font-size:13px;color:#6B7280;text-align:center;padding:12px;background:#F9FAFB;border-radius:6px;margin:16px 0;">[流程图，见原文]</p>');
    }
  }

  // 替换 Chart.js 容器
  const chartEls = root.find('.chart-container').toArray();
  for (let i = 0; i < chartEls.length; i++) {
    const imgPath = diagramImages.chart[i];
    if (imgPath && fs.existsSync(imgPath)) {
      const uploaded = await uploadImageToWx(imgPath, token);
      if (uploaded) {
        $(chartEls[i]).replaceWith(`<img src="${uploaded.url}" style="max-width:100%;height:auto;border-radius:6px;margin:16px auto;display:block;">`);
        if (!diagramThumbId) diagramThumbId = uploaded.media_id;
      } else {
        $(chartEls[i]).replaceWith('<p style="font-size:13px;color:#6B7280;text-align:center;padding:12px;background:#F9FAFB;border-radius:6px;margin:16px 0;">[图表，见原文]</p>');
      }
    } else {
      $(chartEls[i]).replaceWith('<p style="font-size:13px;color:#6B7280;text-align:center;padding:12px;background:#F9FAFB;border-radius:6px;margin:16px 0;">[图表，见原文]</p>');
    }
  }

  // 替换 .metric-grid 数据卡片组
  const metricEls = root.find('.metric-grid').toArray();
  for (let i = 0; i < metricEls.length; i++) {
    const imgPath = diagramImages.metric[i];
    if (imgPath && fs.existsSync(imgPath)) {
      const uploaded = await uploadImageToWx(imgPath, token);
      if (uploaded) {
        $(metricEls[i]).replaceWith(`<img src="${uploaded.url}" style="max-width:100%;height:auto;border-radius:6px;margin:16px auto;display:block;">`);
        if (!diagramThumbId) diagramThumbId = uploaded.media_id;
      } else {
        $(metricEls[i]).remove();
      }
    } else {
      $(metricEls[i]).remove();
    }
  }

  // 删除剩余不兼容标签
  root.find('script, link, style').remove();

  // 4b. 处理图片：上传到微信 CDN，替换 src
  const imgEls = root.find('img').toArray();
  for (const el of imgEls) {
    const src = $(el).attr('src') || '';
    if (!src || src.startsWith('http')) continue;  // 跳过已是 URL 的图片
    // 解析本地路径（相对于 HTML 文件所在目录）
    let localPath = src.startsWith('./') || src.startsWith('../')
      ? path.resolve(path.dirname(htmlFilePath), src)
      : path.join(path.dirname(htmlFilePath), src);
    // 也尝试 images/ 子目录
    if (!fs.existsSync(localPath)) {
      localPath = path.join(imageDir, path.basename(src));
    }
    const result = await uploadImageToWx(localPath, token);
    if (result) {
      $(el).attr('src', result.url);
      if (!articleThumbId) articleThumbId = result.media_id;  // 文章原图优先封面
    } else {
      $(el).remove();
    }
  }

  // 4c. 应用标签级内联样式
  for (const [tag, style] of Object.entries(STYLE_MAP)) {
    root.find(tag).each((_, el) => {
      const existing = $(el).attr('style') || '';
      $(el).attr('style', style + (existing ? existing : ''));
    });
  }

  // 4d. 应用 class 级内联样式（优先级更高，后写，覆盖标签级）
  for (const [cls, style] of Object.entries(CLASS_STYLE_MAP)) {
    root.find(`.${cls}`).each((_, el) => {
      $(el).attr('style', style);
    });
  }

  // 4e. 清理 class 属性（微信不依赖 class，保留也无妨但更干净）
  // root.find('[class]').removeAttr('class');  // 可选，暂时保留方便调试

  // 4f. 包裹在微信友好的外层 div 中
  const wechatHtml = `<section style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;max-width:677px;margin:0 auto;padding:0 16px;color:#374151;">${root.html()}</section>`;

  return { html: wechatHtml, firstImageMediaId: articleThumbId || diagramThumbId || calloutThumbId };
}
// ────────────────────────────────────────────────────────────────

// ── 5. 创建草稿 ──────────────────────────────────────────────────
async function createDraft(title, digest, content, thumbMediaId, token) {
  console.log('\n📝 创建草稿...');
  const body = {
    articles: [{
      title,
      author: 'Aitetech',
      digest: digest.slice(0, 120),
      content,
      thumb_media_id: thumbMediaId,
      content_source_url: '',
      need_open_comment: 0,
      only_fans_can_comment: 0,
    }],
  };
  const res = await httpsPost(WX_API, `/cgi-bin/draft/add?access_token=${token}`, body);
  if (res.errcode) throw new Error(`创建草稿失败: ${res.errmsg} (${res.errcode})`);
  console.log(`✅ 草稿创建成功，media_id: ${res.media_id}`);
  return res.media_id;
}
// ────────────────────────────────────────────────────────────────

// ── 6. 用浏览器发布草稿（适用于未认证订阅号）───────────────────
const WX_MP_DATA = path.join(os.homedir(), '.wx-mp-browser-data');

async function publishFromBrowser() {
  console.log('\n🌐 启动浏览器，登录公众号后台...');
  const context = await chromium.launchPersistentContext(WX_MP_DATA, {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--no-sandbox'],
  });
  const page = await context.newPage();

  try {
    await page.goto('https://mp.weixin.qq.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 检测是否需要扫码登录（未登录时 URL 不含 /cgi-bin/）
    const isLoggedIn = page.url().includes('/cgi-bin/');
    if (!isLoggedIn) {
      console.log('⚠️  请用微信扫描页面二维码，并在手机上点「确认登录」');
      console.log('    等待登录完成（最多5分钟）...');
      await page.waitForURL('**/cgi-bin/**', { timeout: 300000 });
      console.log('✅ 登录成功');
      await page.waitForTimeout(3000);
    }

    // 从当前 URL 提取微信后台 token
    const mpToken = (page.url().match(/[?&]token=(\d+)/) || [])[1] || '';

    // 点击左侧「草稿箱」菜单进入草稿列表
    console.log('📂 进入草稿箱...');
    // 先展开「内容管理」分组（若已展开则无影响）
    const contentMenu = page.locator('text=内容管理').first();
    if (await contentMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contentMenu.click().catch(() => {});
      await page.waitForTimeout(800);
    }
    // 点击草稿箱
    await page.locator('text=草稿箱').first().click({ force: true });
    await page.waitForTimeout(3000);

    // 截图草稿箱初始状态
    const listShotPath = path.join(__dirname, 'output', `wx_draftlist_${Date.now()}.png`);
    await page.screenshot({ path: listShotPath, fullPage: true });
    console.log(`📸 草稿箱截图: ${path.basename(listShotPath)}`);

    // 悬停第一篇草稿，触发右上角发布按钮出现
    const draftCardSelectors = [
      '.weui-desktop-media-box',
      '.appmsg_item',
      '.weui-media-box',
      'li[class*="media"]',
      '.draft_paper_item',
    ];
    let hovered = false;
    for (const sel of draftCardSelectors) {
      const card = page.locator(sel).first();
      if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
        await card.hover();
        await page.waitForTimeout(1000);
        hovered = true;
        console.log(`  ✅ 已悬停草稿卡片: ${sel}`);
        break;
      }
    }
    if (!hovered) {
      // 兜底：hover 页面中央第一张图
      const firstImg = page.locator('img').first();
      await firstImg.hover().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // hover 后截图，确认发布按钮位置
    const hoverShotPath = path.join(__dirname, 'output', `wx_hover_${Date.now()}.png`);
    await page.screenshot({ path: hoverShotPath });
    console.log(`📸 悬停后截图: ${path.basename(hoverShotPath)}`);

    // 诊断：列出 hover 后所有含"发布"的元素及坐标
    const publishEls = await page.evaluate(() => {
      const result = [];
      document.querySelectorAll('*').forEach(el => {
        if (el.children.length === 0 && el.textContent.trim() === '发布') {
          const rect = el.getBoundingClientRect();
          result.push({
            tag: el.tagName, cls: el.className,
            x: Math.round(rect.x), y: Math.round(rect.y),
            w: Math.round(rect.width), h: Math.round(rect.height),
            visible: rect.width > 0 && rect.height > 0,
          });
        }
      });
      return result;
    });
    if (publishEls.length > 0) {
      console.log('  [诊断] 含"发布"的元素:', JSON.stringify(publishEls, null, 2));
    }

    // 找发布按钮（文字 or 图标均尝试，范围限定在卡片内）
    const publishSelectors = [
      'text=发布', 'text=群发',
      'a:has-text("发布")', 'button:has-text("发布")',
      '[title="发布"]', '[aria-label="发布"]',
      '.icon-send', '.btn-publish',
    ];

    let clicked = false;

    // 优先在卡片内部找（避免匹配侧边栏的「发表记录」）
    const cardSels = ['.weui-desktop-media-box', '.appmsg_item', '.weui-media-box', 'li[class*="media"]'];
    for (const cardSel of cardSels) {
      const card = page.locator(cardSel).first();
      if (!await card.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      const cardBox = await card.boundingBox();
      if (!cardBox) continue;

      // 在卡片内部按文字找
      for (const btnText of ['发布', '发表', '群发']) {
        const btn = card.locator(`text=${btnText}`).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          clicked = true;
          console.log(`✅ 已在卡片内点击: text=${btnText}`);
          break;
        }
      }
      if (clicked) break;

      // 卡片内部按坐标点击右上角
      const iconX = cardBox.x + cardBox.width - 40;
      const iconY = cardBox.y + 15;
      await page.mouse.move(iconX, iconY);
      await page.waitForTimeout(500);
      await page.mouse.click(iconX, iconY);
      await page.waitForTimeout(1500);
      clicked = true;
      console.log(`✅ 已坐标点击卡片右上角 (${Math.round(iconX)}, ${Math.round(iconY)})`);
      break;
    }

    // 兜底：范围外找（排除侧边栏位置 x<200）
    if (!clicked) {
      for (const sel of publishSelectors) {
        const els = await page.locator(sel).all();
        for (const el of els) {
          const box = await el.boundingBox().catch(() => null);
          if (box && box.x > 200 && await el.isVisible().catch(() => false)) {
            await el.click();
            clicked = true;
            console.log(`✅ 已点击: ${sel}`);
            break;
          }
        }
        if (clicked) break;
      }
    }

    if (clicked) {
      await page.waitForTimeout(2000);
      // 处理可能的确认弹窗
      for (const confirmSel of ['text=确定', 'text=发表', '.primary_btn']) {
        const confirmEl = page.locator(confirmSel).last();
        if (await confirmEl.isVisible({ timeout: 1500 }).catch(() => false)) {
          await confirmEl.click();
          await page.waitForTimeout(2000);
          break;
        }
      }
    } else {
      console.log('⚠️  未能自动点击发布，浏览器保持打开 30 秒，请手动操作');
      await page.waitForTimeout(30000);
    }

    // 截图留存
    const shotPath = path.join(__dirname, 'output', `wx_published_${Date.now()}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`📸 结果截图: ${path.basename(shotPath)}`);

  } finally {
    await context.close();
  }
}
// ────────────────────────────────────────────────────────────────

// ── 7. 主流程 ────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const flags = process.argv.slice(2).filter(a => a.startsWith('-'));
  const draftOnly = flags.includes('--draft-only');
  if (args.length < 1) {
    console.log('用法: node wechat_publisher.js <html文件路径> [--draft-only]');
    console.log('示例: node wechat_publisher.js "../AI工具入门示例/web/13_dify-tutorial.html" --draft-only');
    process.exit(1);
  }

  const htmlPath = path.resolve(args[0]);
  if (!fs.existsSync(htmlPath)) {
    console.error(`文件不存在: ${htmlPath}`);
    process.exit(1);
  }

  if (config.APP_ID === 'YOUR_APP_ID') {
    console.error('❌ 请先在 wx_config.js 中填写 APP_ID 和 APP_SECRET');
    process.exit(1);
  }

  console.log(`\n📄 处理文件: ${path.basename(htmlPath)}`);
  console.log(draftOnly ? '🔒 模式: 仅创建草稿（不发布）' : '📢 模式: 创建草稿并发布');

  const token = await getAccessToken();

  console.log('\n📑 提取文章内容...');
  const { title, digest, bodyHtml } = extractArticleInfo(htmlPath);
  console.log(`  标题: ${title}`);
  console.log(`  摘要: ${digest.slice(0, 50)}...`);

  console.log('\n🖼️  转换内容并上传图片...');
  const { html: wechatHtml, firstImageMediaId } = await convertToWechatHtml(
    bodyHtml,
    htmlPath,
    token
  );

  if (!firstImageMediaId) {
    console.warn('⚠️  未找到可用封面图，请确保文章中有本地图片，或手动指定 thumb_media_id');
    console.warn('   草稿创建将继续，但微信要求草稿必须有封面图——发布前请在后台手动设置');
    // 仍然继续，让用户在草稿箱里补图
  }

  const thumbMediaId = firstImageMediaId || '';
  const mediaId = await createDraft(title, digest, wechatHtml, thumbMediaId, token);

  console.log('\n✅ 草稿已创建！');
  console.log('   请登录 https://mp.weixin.qq.com → 草稿箱');
  console.log('   鼠标悬停草稿卡片 → 点击右上角「发布」按钮手动发布');
}

main().catch(err => {
  console.error('\n❌ 出错:', err.message);
  process.exit(1);
});
