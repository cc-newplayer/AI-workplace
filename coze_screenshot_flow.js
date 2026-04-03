// ════════════════════════════════════════════════════════════════
// 流程截图脚本 —— 每次使用时只需修改下方「配置区」，不要新建文件
//
// 使用方法：
//   1. 修改「配置区」里的 SPACE_URL / BOT_URL / OUT / 截图流程
//   2. node coze_screenshot_flow.js
//   3. 跑完后把 SPACE_URL / BOT_URL / OUT 改回 Coze 默认值
// ════════════════════════════════════════════════════════════════

// ── 配置区（每次换平台只改这里）────────────────────────────────
const SPACE_URL  = 'https://www.coze.cn/space/7618280352339165225/develop'; // 入口页
const BOT_URL    = 'https://www.coze.cn/space/7618280352339165225/bot/7621000303068332095'; // 演示页
const OUT        = './output'; // 截图输出目录（用绝对路径指向 web/images）
// ────────────────────────────────────────────────────────────────

const { chromium } = require('playwright');
const os = require('os');
const path = require('path');
const USER_DATA_DIR = path.join(os.homedir(), '.screenshot-browser-data');

// ── 标注工具 ─────────────────────────────────────────────────────
async function ann(page) {
  // 初始化svg覆盖层
  await page.evaluate(() => {
    let s = document.getElementById('__ann__');
    if (s) s.remove();
    const NS = 'http://www.w3.org/2000/svg';
    s = document.createElementNS(NS, 'svg');
    s.id = '__ann__';
    s.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;overflow:visible';
    document.body.appendChild(s);
  });
}

async function clearAnn(page) {
  await page.evaluate(() => { const s = document.getElementById('__ann__'); if (s) s.remove(); });
}

async function addCallout(page, selector, label, color = '#FF4444') {
  try {
    const box = await page.locator(selector).first().boundingBox({ timeout: 3000 });
    if (!box) { console.log('  [callout未命中]', selector); return; }
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.evaluate(({ x, y, label, color }) => {
      const NS = 'http://www.w3.org/2000/svg';
      const s = document.getElementById('__ann__');
      if (!s) return;
      const bg = document.createElementNS(NS, 'circle');
      bg.setAttribute('cx', x); bg.setAttribute('cy', y); bg.setAttribute('r', 22);
      bg.setAttribute('fill', '#fff'); bg.setAttribute('opacity', '0.85'); s.appendChild(bg);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 20);
      c.setAttribute('fill', color); s.appendChild(c);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y + 5);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', '#fff');
      t.setAttribute('font-size', '14'); t.setAttribute('font-weight', 'bold');
      t.setAttribute('font-family', 'Arial,sans-serif');
      t.textContent = label; s.appendChild(t);
    }, { x, y, label, color });
  } catch (e) { console.log('  [callout异常]', selector, e.message); }
}

async function addHighlight(page, selector, color = '#FFB800') {
  try {
    const box = await page.locator(selector).first().boundingBox({ timeout: 3000 });
    if (!box) { console.log('  [highlight未命中]', selector); return; }
    await page.evaluate(({ x, y, w, h, color }) => {
      const NS = 'http://www.w3.org/2000/svg';
      const s = document.getElementById('__ann__');
      if (!s) return;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x - 4); r.setAttribute('y', y - 4);
      r.setAttribute('width', w + 8); r.setAttribute('height', h + 8);
      r.setAttribute('fill', color); r.setAttribute('opacity', '0.12');
      r.setAttribute('stroke', color); r.setAttribute('stroke-width', '3'); r.setAttribute('rx', '6');
      s.appendChild(r);
    }, { x: box.x, y: box.y, w: box.width, h: box.height, color });
  } catch (e) { console.log('  [highlight异常]', selector, e.message); }
}

async function shot(page, name) {
  await page.waitForTimeout(400);
  const p = path.join(OUT, name);
  await page.screenshot({ path: p });
  console.log('✅', name);
  return p;
}

// ── 主流程 ───────────────────────────────────────────────────────
(async () => {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false, viewport: { width: 1440, height: 900 }, args: ['--no-sandbox'],
  });
  const page = await context.newPage();

  try {

    // ── 截图①：Dify 官网首页 ──────────────────────────────────
    console.log('\n→ 截图①：Dify 官网首页');
    await page.goto('https://dify.ai', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    await shot(page, '13_dify_01_homepage.png');

    // ── 截图②：登录后工作台 ──────────────────────────────────
    console.log('\n→ 截图②：Dify 工作台（如需登录请在浏览器手动完成）');
    await page.goto(SPACE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    // 检测登录态：只要 URL 不在 cloud.dify.ai/apps 或 /console 就认为需要登录
    const curUrl = page.url();
    const isLoggedIn = curUrl.includes('cloud.dify.ai') && !curUrl.includes('/signin') && !curUrl.includes('google.com') && !curUrl.includes('accounts.');
    if (!isLoggedIn) {
      console.log('⚠️  检测到需要登录，请在浏览器窗口手动完成登录（最多等 10 分钟）...');
      await page.waitForFunction(
        () => window.location.href.includes('cloud.dify.ai') && !window.location.href.includes('signin') && !window.location.href.includes('google.com'),
        { timeout: 600000 }
      ).catch(() => console.log('等待超时，继续执行...'));
      console.log('✅ 登录完成，等待页面就绪...');
      await page.waitForTimeout(5000);
    }

    await page.waitForTimeout(2000);
    await ann(page);
    await addCallout(page, 'button:has-text("创建"), button:has-text("Create")', '①');
    await shot(page, '13_dify_02_dashboard.png');
    await clearAnn(page);

    // ── 截图③：模型供应商配置页 ──────────────────────────────
    console.log('\n→ 截图③：模型供应商配置');
    const curBase = page.url().split('/').slice(0, 5).join('/');
    await page.goto(curBase.replace(/\/apps.*/, '') + '/account/provider', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await ann(page);
    await addHighlight(page, '[class*="provider-card"], [class*="ProviderCard"], [class*="model-item"]', '#2563EB');
    await shot(page, '13_dify_03_model_config.png');
    await clearAnn(page);

    // ── 截图④：创建应用弹窗 ──────────────────────────────────
    console.log('\n→ 截图④：创建应用弹窗');
    await page.goto(SPACE_URL + '/apps', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() =>
      page.goto(SPACE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    );
    await page.waitForTimeout(3000);
    const createBtn = page.locator('button:has-text("创建"), button:has-text("Create"), a:has-text("创建应用")').first();
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(2000);
    }
    await ann(page);
    await addCallout(page, '[class*="modal"] input, [class*="dialog"] input, input[name="name"]', '①');
    await shot(page, '13_dify_04_create_app.png');
    await clearAnn(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // ── 截图⑤：应用编辑器（进入第一个已有应用）─────────────────
    console.log('\n→ 截图⑤：应用编辑器');
    const appCard = page.locator('[class*="app-card"], [class*="AppCard"], [class*="app-item"] a').first();
    if (await appCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await appCard.click();
      await page.waitForTimeout(4000);
    }
    await ann(page);
    await addHighlight(page, 'textarea, [class*="prompt"], [class*="Prompt"]', '#2563EB');
    await addCallout(page, 'textarea, [class*="prompt"], [class*="Prompt"]', '①', '#2563EB');
    await addCallout(page, '[class*="model-selector"], [class*="ModelSelector"], [class*="model-name"]', '②', '#FF4444');
    await shot(page, '13_dify_05_editor.png');
    await clearAnn(page);

    // ── 截图⑥：发布页 ────────────────────────────────────────
    console.log('\n→ 截图⑥：发布页');
    const publishBtn = page.locator('button:has-text("发布"), button:has-text("Publish")').first();
    if (await publishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await publishBtn.click();
      await page.waitForTimeout(2000);
    }
    await ann(page);
    await addCallout(page, '[class*="webapp"], [class*="WebApp"], [class*="publish"]', '①', '#2563EB');
    await shot(page, '13_dify_06_publish.png');
    await clearAnn(page);

    console.log('\n✅ 所有截图完成！文件已保存到:', OUT);

  } catch (e) {
    console.error('出错:', e.message);
    await page.screenshot({ path: path.join(OUT, `13_error_${Date.now()}.png`) }).catch(() => {});
  } finally {
    await context.close();
  }
})();
