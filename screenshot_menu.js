const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 持久化登录数据目录（与豆包分开，独立存储）
const USER_DATA_DIR = path.join(os.homedir(), '.screenshot-browser-data');

/**
 * 截图主函数
 *
 * @param {string} url - 目标页面 URL
 * @param {object} options
 *   outputPath      {string}   输出路径，默认 './output/screenshot.png'
 *   fullPage        {boolean}  是否截取整页，默认 false
 *   viewport        {object}   视口尺寸，默认 1920×1080
 *   waitTime        {number}   页面加载后等待毫秒数，默认 3000
 *   menuSelector    {string}   截图前需要点击展开的菜单选择器（可选）
 *   beforeShot      {function} async (page) => {}，截图前的自定义操作（可选）
 *   annotations     {Array}    标注配置数组（见下方说明）
 *
 * annotations 每项格式：
 *   { type: 'callout',   selector: '#btn',  label: '1', color: '#FF4444' }
 *   { type: 'callout',   x: 300, y: 200,    label: '2', color: '#FF4444' }
 *   { type: 'highlight', selector: '.panel', color: '#FFB800' }
 *   { type: 'highlight', x: 100, y: 150, width: 200, height: 60, color: '#FFB800' }
 *   { type: 'arrow',     selector: '#menu', direction: 'right', color: '#FF4444' }
 *   { type: 'arrow',     x: 400, y: 300,   direction: 'down',  color: '#FF4444' }
 *
 *   type:      callout（带编号圆圈）| highlight（高亮描框）| arrow（箭头指向）
 *   selector:  CSS 选择器（与 x/y 二选一）
 *   x, y:      页面坐标（与 selector 二选一）
 *   label:     callout 内显示的文字/数字
 *   direction: arrow 方向：up | down | left | right（默认 down）
 *   color:     标注颜色，默认 #FF4444
 */
async function takeScreenshot(url, options = {}) {
  const {
    outputPath = './output/screenshot.png',
    fullPage = false,
    viewport = { width: 1920, height: 1080 },
    waitTime = 3000,
    menuSelector = null,
    beforeShot = null,
    annotations = [],
  } = options;

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport,
    args: ['--no-sandbox'],
  });

  const page = await context.newPage();

  try {
    console.log(`正在打开: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(waitTime);

    // ── 登录检测 ───────────────────────────────────────────────
    const loginSelectors = [
      'input[type="password"]',
      'button:has-text("登录")',
      'button:has-text("Log in")',
      'button:has-text("Sign in")',
      'a:has-text("登录")',
      '[class*="login-btn"]',
      '[data-testid*="login"]',
    ];

    let needsLogin = false;
    for (const sel of loginSelectors) {
      const visible = await page.locator(sel).first()
        .isVisible({ timeout: 1500 }).catch(() => false);
      if (visible) { needsLogin = true; break; }
    }

    if (needsLogin) {
      console.log('⚠️  检测到需要登录，请在浏览器窗口中手动完成登录...');
      console.log('    登录完成后脚本将自动继续（最多等待 5 分钟）');
      const loginUrl = page.url();
      // 等待 URL 跳转到非登录页，且页面不再含有密码输入框
      await page.waitForFunction((originalUrl) => {
        const cur = window.location.href;
        const hasPassword = !!document.querySelector('input[type="password"]');
        const isLoginPage = cur.includes('/login') || cur.includes('/signin')
          || cur.includes('/auth') || cur === originalUrl;
        return !hasPassword && !isLoginPage;
      }, loginUrl, { timeout: 300000 }).catch(() => {
        console.log('⚠️  登录等待超时，将尝试继续截图...');
      });
      console.log('✅ 登录完成，等待页面就绪...');
      await page.waitForTimeout(3000);
    }

    // ── 菜单展开 ───────────────────────────────────────────────
    if (menuSelector) {
      try {
        const menuBtn = page.locator(menuSelector).first();
        if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`点击菜单: ${menuSelector}`);
          await menuBtn.click();
          await page.waitForTimeout(1500);
        } else {
          console.log(`未找到菜单按钮: ${menuSelector}`);
        }
      } catch (e) {
        console.log('菜单点击失败:', e.message);
      }
    }

    // ── 自定义操作 ─────────────────────────────────────────────
    if (typeof beforeShot === 'function') {
      await beforeShot(page);
    }

    // ── 注入标注 ───────────────────────────────────────────────
    if (annotations.length > 0) {
      await injectAnnotations(page, annotations);
      await page.waitForTimeout(300); // 等待 SVG 渲染
    }

    // ── 截图 ───────────────────────────────────────────────────
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await page.screenshot({ path: outputPath, fullPage });
    console.log(`✅ 截图已保存: ${outputPath}`);
    return outputPath;

  } catch (error) {
    console.error('截图失败:', error.message);
    const errPath = path.join(path.dirname(outputPath), `error_${Date.now()}.png`);
    await page.screenshot({ path: errPath, fullPage: true }).catch(() => {});
    console.log(`错误截图: ${errPath}`);
    throw error;
  } finally {
    await context.close();
  }
}

// ── 标注注入引擎 ─────────────────────────────────────────────────
async function injectAnnotations(page, annotations) {

  // 用 Playwright locator API 解析选择器（支持 :has-text() 等扩展语法）
  const resolved = [];
  for (const ann of annotations) {
    if (ann.selector) {
      try {
        const box = await page.locator(ann.selector).first()
          .boundingBox({ timeout: 3000 }).catch(() => null);
        if (box) {
          resolved.push({
            ...ann,
            x:     box.x + box.width  / 2,
            y:     box.y + box.height / 2,
            elW:   box.width,
            elH:   box.height,
            found: true,
          });
        } else {
          console.log(`[annotation] 未找到元素: ${ann.selector}`);
          resolved.push({ ...ann, found: false });
        }
      } catch (e) {
        console.log(`[annotation] 选择器异常: ${ann.selector} — ${e.message}`);
        resolved.push({ ...ann, found: false });
      }
    } else {
      resolved.push({ ...ann, found: true, elW: ann.width || 0, elH: ann.height || 0 });
    }
  }

  // 在页面中注入 SVG 覆盖层
  await page.evaluate((anns) => {
    const existing = document.getElementById('__annot_overlay__');
    if (existing) existing.remove();

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.id = '__annot_overlay__';
    svg.style.cssText = [
      'position:fixed', 'top:0', 'left:0',
      'width:100vw', 'height:100vh',
      'pointer-events:none',
      'z-index:2147483647',
      'overflow:visible',
    ].join(';');

    // ── arrowhead marker def ──────────────────────────────────
    const defs = document.createElementNS(NS, 'defs');
    ['#FF4444', '#FFB800', '#00C26F', '#2563EB'].forEach((c, i) => {
      const m = document.createElementNS(NS, 'marker');
      m.setAttribute('id', `ah_${i}`);
      m.setAttribute('markerWidth', '10');
      m.setAttribute('markerHeight', '7');
      m.setAttribute('refX', '9');
      m.setAttribute('refY', '3.5');
      m.setAttribute('orient', 'auto');
      const poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', '0 0, 10 3.5, 0 7');
      poly.setAttribute('fill', c);
      m.appendChild(poly);
      defs.appendChild(m);
    });
    svg.appendChild(defs);

    const arrowColors  = ['#FF4444', '#FFB800', '#00C26F', '#2563EB'];
    const getMarker = c => {
      const idx = arrowColors.indexOf(c);
      return idx >= 0 ? `url(#ah_${idx})` : 'url(#ah_0)';
    };

    anns.forEach(ann => {
      if (!ann.found) {
        console.warn('[screenshot] 未找到元素:', ann.selector);
        return;
      }

      const color = ann.color || '#FF4444';
      const x = ann.x || 0;
      const y = ann.y || 0;

      // ── callout：带编号圆圈 ───────────────────────────────────
      if (ann.type === 'callout') {
        const R = 20;

        // 白色描边（提升对比度）
        const bgCircle = document.createElementNS(NS, 'circle');
        bgCircle.setAttribute('cx', x);
        bgCircle.setAttribute('cy', y);
        bgCircle.setAttribute('r', R + 2);
        bgCircle.setAttribute('fill', '#ffffff');
        bgCircle.setAttribute('opacity', '0.85');
        svg.appendChild(bgCircle);

        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', R);
        circle.setAttribute('fill', color);
        svg.appendChild(circle);

        if (ann.label !== undefined && ann.label !== '') {
          const text = document.createElementNS(NS, 'text');
          text.setAttribute('x', x);
          text.setAttribute('y', y + 5);
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('fill', '#ffffff');
          text.setAttribute('font-size', '15');
          text.setAttribute('font-weight', 'bold');
          text.setAttribute('font-family', 'Arial, sans-serif');
          text.textContent = ann.label;
          svg.appendChild(text);
        }
      }

      // ── highlight：高亮描框 ───────────────────────────────────
      else if (ann.type === 'highlight') {
        const w = ann.elW || ann.width  || 120;
        const h = ann.elH || ann.height || 40;
        const pad = 5;

        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x',      x - w / 2 - pad);
        rect.setAttribute('y',      y - h / 2 - pad);
        rect.setAttribute('width',  w + pad * 2);
        rect.setAttribute('height', h + pad * 2);
        rect.setAttribute('fill',   'none');
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', '3');
        rect.setAttribute('rx', '5');
        svg.appendChild(rect);

        // 半透明填充
        const fill = document.createElementNS(NS, 'rect');
        fill.setAttribute('x',       x - w / 2 - pad);
        fill.setAttribute('y',       y - h / 2 - pad);
        fill.setAttribute('width',   w + pad * 2);
        fill.setAttribute('height',  h + pad * 2);
        fill.setAttribute('fill',    color);
        fill.setAttribute('opacity', '0.08');
        fill.setAttribute('rx', '5');
        svg.appendChild(fill);
      }

      // ── arrow：箭头指向 ───────────────────────────────────────
      else if (ann.type === 'arrow') {
        const dir    = ann.direction || 'down';
        const length = ann.length    || 50;
        const gap    = 8; // 箭头尖与目标的间距
        let x1, y1, x2, y2;

        if      (dir === 'down')  { x1=x;        y1=y-length; x2=x;        y2=y-gap; }
        else if (dir === 'up')    { x1=x;        y1=y+length; x2=x;        y2=y+gap; }
        else if (dir === 'right') { x1=x-length; y1=y;        x2=x-gap;    y2=y; }
        else                      { x1=x+length; y1=y;        x2=x+gap;    y2=y; }

        // 白色描边衬底（提升可见性）
        const shadow = document.createElementNS(NS, 'line');
        shadow.setAttribute('x1', x1); shadow.setAttribute('y1', y1);
        shadow.setAttribute('x2', x2); shadow.setAttribute('y2', y2);
        shadow.setAttribute('stroke', '#ffffff');
        shadow.setAttribute('stroke-width', '5');
        svg.appendChild(shadow);

        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '3');
        line.setAttribute('marker-end', getMarker(color));
        svg.appendChild(line);
      }
    });

    document.body.appendChild(svg);
  }, resolved);
}

// ── 命令行入口 ───────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('用法:   node screenshot_menu.js <URL> [输出路径] [菜单选择器]');
    console.log('示例:   node screenshot_menu.js https://dify.ai ./output/dify.png');
    process.exit(1);
  }
  const [url, outputPath, menuSelector] = args;
  takeScreenshot(url, {
    outputPath: outputPath || './output/screenshot.png',
    menuSelector: menuSelector || null,
  })
    .then(p => console.log('完成:', p))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { takeScreenshot };
