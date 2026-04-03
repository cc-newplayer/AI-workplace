// ════════════════════════════════════════════════════════════════
// 豆包生图脚本 —— 直接传提示词调用，不需要修改脚本本身
//
// 使用方法：
//   node doubao_image.js "你的提示词"
//   → 图片输出到 ./output/doubao_xxx_1.jpg（豆包默认生成4张）
//   → 手动 cp 选中的那张到 web/images/ 并改名
//
// 提示词建议：
//   - 指定风格：扁平插画 / 科技感 / 信息图
//   - 指定背景色：深蓝渐变 / 白色 / 深色
//   - 结尾加"无文字"避免生成带文字的图
// ════════════════════════════════════════════════════════════════

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

// 持久化用户数据目录，保存登录状态
const USER_DATA_DIR = path.join(os.homedir(), '.doubao-browser-data');

async function generateImage(prompt, options = {}) {
  const {
    outputDir = './output',
    waitTime = 45000,
  } = options;

  // 使用持久化上下文保留登录状态
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false, // 首次需要手动登录，所以用有头模式
    viewport: { width: 1280, height: 800 },
    args: ['--no-sandbox'],
  });

  const page = await context.newPage();

  try {
    console.log('正在打开豆包...');
    await page.goto('https://www.doubao.com', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // 检查是否需要登录
    await page.waitForTimeout(3000);
    const loginBtn = page.locator('button:has-text("登录"), a:has-text("登录")').first();
    const needsLogin = await loginBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (needsLogin) {
      console.log('⚠️  请在打开的浏览器窗口中手动登录豆包，等待登录完成...');
      await loginBtn.waitFor({ state: 'hidden', timeout: 180000 });
      console.log('登录成功，继续...');
      await page.waitForTimeout(2000);
    }

    // 用快捷键 Ctrl+K 开新对话（避免进入有历史记录的旧会话）
    console.log('新建对话...');
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(1500);

    // 点击工具栏的「图像生成」切换到生图模式
    console.log('切换到图像生成模式...');
    const imageGenBtn = page.locator('button:has-text("图像生成"), [class*="tool"]:has-text("图像生成")').first();
    await imageGenBtn.click({ timeout: 10000 });
    await page.waitForTimeout(1500);

    const inputSelector = '[contenteditable="true"]';
    await page.waitForSelector(inputSelector, { timeout: 15000 });

    const input = page.locator(inputSelector).first();
    await input.click();
    await page.waitForTimeout(500);

    // 清空并输入提示词（用 pressSequentially 触发 React 状态）
    console.log(`输入提示词: ${prompt}`);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await input.pressSequentially(prompt, { delay: 30 });
    console.log('提示词已输入');

    await page.waitForTimeout(800);

    // 发送前：快照页面上所有已存在的图片 URL（用于后续差集过滤）
    const snapshotAllImages = () => page.evaluate(() => {
      const urls = new Set();
      document.querySelectorAll('img').forEach(img => {
        if (img.src) urls.add(img.src);
        if (img.getAttribute('data-src')) urls.add(img.getAttribute('data-src'));
      });
      return Array.from(urls);
    });

    const beforeUrls = new Set(await snapshotAllImages());
    console.log(`发送前页面已有 ${beforeUrls.size} 张图片`);

    // 网络拦截作为备用，仅记录发送后的请求
    const capturedImageUrls = [];
    let trackingEnabled = false;
    await page.route('**/*', async (route) => {
      if (trackingEnabled) {
        const url = route.request().url();
        const resourceType = route.request().resourceType();
        if (resourceType === 'image' && (url.includes('tos-cn') || url.includes('byteimg') || url.includes('volccdn'))) {
          capturedImageUrls.push(url);
        }
      }
      await route.continue();
    });

    // 等待发送按钮可用并点击（不依赖 Enter 键）
    console.log('查找并点击发送按钮...');
    const sendSelectors = [
      'button[aria-label*="发送"]',
      'button[data-testid*="send"]',
      '[class*="send-button"]:not([disabled])',
      '[class*="SendButton"]:not([disabled])',
      'button:has(svg):not([disabled])',
    ];

    let sent = false;
    for (const sel of sendSelectors) {
      try {
        const btn = page.locator(sel).last();
        const visible = await btn.isVisible({ timeout: 1000 });
        const disabled = await btn.isDisabled({ timeout: 500 }).catch(() => false);
        if (visible && !disabled) {
          trackingEnabled = true; // 发送后才开始记录
          await btn.click({ timeout: 3000 });
          console.log(`已点击发送按钮: ${sel}`);
          sent = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!sent) {
      console.log('未找到发送按钮，尝试键盘提交...');
      trackingEnabled = true;
      await page.keyboard.press('Enter');
    }

    // 等待生成完成
    console.log(`等待生图完成（最多 ${waitTime / 1000} 秒）...`);
    await page.waitForTimeout(waitTime);

    // 滚动到底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // 保存截图
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(outputDir, `doubao_${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`截图已保存: ${screenshotPath}`);

    // ── 方案一：URL 路径区分（生成图用 rc_gen_image，推荐图用 image_generation） ──
    const generatedImgUrls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .map(img => img.src || img.getAttribute('data-src') || '')
        .filter(src => src.includes('rc_gen_image'));
    });
    console.log(`rc_gen_image 路径图片: ${generatedImgUrls.length} 张`);
    generatedImgUrls.forEach(u => console.log(`  ${u.slice(0, 100)}`));

    const savedImages = [];

    let imgUrls;
    if (generatedImgUrls.length > 0) {
      console.log(`✅ 使用 rc_gen_image URL 过滤方案`);
      imgUrls = generatedImgUrls;
    } else {
      console.log(`⚠️  rc_gen_image 未找到图片，回退到网络拦截方案（共 ${capturedImageUrls.length} 条记录）`);
      imgUrls = capturedImageUrls;
    }

    console.log(`开始下载 ${imgUrls.length} 张图片...`);
    for (let i = 0; i < imgUrls.length; i++) {
      const tmpPath = path.join(outputDir, `doubao_${timestamp}_${i + 1}.jpg`);
      try {
        await downloadFile(imgUrls[i], tmpPath);
        const size = fs.statSync(tmpPath).size;
        if (size >= 50 * 1024) {
          savedImages.push(tmpPath);
          console.log(`图片 ${savedImages.length} 已保存: ${tmpPath} (${Math.round(size / 1024)}KB)`);
        } else {
          fs.unlinkSync(tmpPath);
          console.log(`跳过小图 (${Math.round(size / 1024)}KB): ${imgUrls[i].slice(0, 80)}`);
        }
      } catch (e) {
        console.warn(`图片 ${i + 1} 下载失败: ${e.message}`);
      }
    }
    console.log(`共保存 ${savedImages.length} 张生成图片`);

    return { screenshot: screenshotPath, images: savedImages };
  } catch (error) {
    console.error('错误:', error.message);
    // 出错时也截图，方便排查
    const errPath = path.join(outputDir || './output', `doubao_error_${Date.now()}.png`);
    await page.screenshot({ path: errPath, fullPage: true }).catch(() => {});
    console.log(`错误截图: ${errPath}`);
    throw error;
  } finally {
    await context.close();
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    client.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('用法: node doubao_image.js <提示词>');
    process.exit(1);
  }
  generateImage(args.join(' ')).then(result => {
    console.log('截图:', result.screenshot);
    console.log('生成图片:', result.images);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { generateImage };
