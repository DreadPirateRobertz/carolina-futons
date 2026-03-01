#!/usr/bin/env node
// capture-social.js — Capture competitor social media pages
// Non-blocking with explicit timeouts. Run: node design-vision/capture-social.js

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'social');
const PAGE_TIMEOUT = 15000;
const SCREENSHOT_TIMEOUT = 5000;
const TOTAL_TIMEOUT = 180000; // 3 min total

const TARGETS = [
  // Pinterest boards (public, no login needed)
  { name: 'pinterest-article', url: 'https://www.pinterest.com/articlefurniture/' },
  { name: 'pinterest-joybird', url: 'https://www.pinterest.com/joybird/' },
  { name: 'pinterest-burrow', url: 'https://www.pinterest.com/buraborneo/' },
  { name: 'pinterest-westelm', url: 'https://www.pinterest.com/westelm/' },
  { name: 'pinterest-potterybarn', url: 'https://www.pinterest.com/potterybarn/' },

  // Instagram (public feeds, no login)
  { name: 'ig-article', url: 'https://www.instagram.com/article/' },
  { name: 'ig-albanypark', url: 'https://www.instagram.com/albanypark/' },
  { name: 'ig-joybird', url: 'https://www.instagram.com/joybird/' },
  { name: 'ig-floyd', url: 'https://www.instagram.com/floydhome/' },
  { name: 'ig-burrow', url: 'https://www.instagram.com/buraborneo/' },
];

async function captureOne(browser, target) {
  const start = Date.now();
  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await Promise.race([
      page.goto(target.url, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Page load timeout')), PAGE_TIMEOUT)),
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const filepath = path.join(SCREENSHOT_DIR, `${target.name}.png`);
    await Promise.race([
      page.screenshot({ path: filepath, fullPage: false }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), SCREENSHOT_TIMEOUT)),
    ]);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const size = (fs.statSync(filepath).size / 1024).toFixed(0);
    console.log(`OK  ${target.name} (${elapsed}s, ${size}KB)`);
    return { name: target.name, ok: true };
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`FAIL ${target.name} (${elapsed}s): ${err.message}`);
    return { name: target.name, ok: false, error: err.message };
  } finally {
    if (page) try { await page.close(); } catch (e) {}
  }
}

async function main() {
  console.log(`Capturing social media pages: ${TARGETS.length} targets`);
  console.log(`Output: ${SCREENSHOT_DIR}`);
  console.log('---');

  const killTimer = setTimeout(() => {
    console.log('\nTOTAL TIMEOUT (3 min). Exiting.');
    process.exit(1);
  }, TOTAL_TIMEOUT);

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const results = [];
    for (const target of TARGETS) {
      results.push(await captureOne(browser, target));
    }

    console.log('\n--- Summary ---');
    const ok = results.filter(r => r.ok).length;
    const fail = results.filter(r => !r.ok).length;
    console.log(`Captured: ${ok}/${results.length} (${fail} failed)`);
    if (fail > 0) {
      console.log('Failed:');
      results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }
  } catch (err) {
    console.error('Browser launch failed:', err.message);
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    clearTimeout(killTimer);
  }
}

main();
