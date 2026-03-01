#!/usr/bin/env node
// capture-screenshots.js — Non-blocking competitor screenshot capture
// Run: node design-vision/capture-screenshots.js
// Explicit timeouts on ALL operations. Never hangs.

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const PAGE_TIMEOUT = 15000;   // 15s max page load
const SCREENSHOT_TIMEOUT = 5000; // 5s max screenshot
const TOTAL_TIMEOUT = 300000; // 5 min total script timeout

// Pages still needed (from research notes)
const TARGETS = [
  // Futon-specific competitors — product & category pages
  { name: 'futonland-product', url: 'https://www.futonland.com/product/queen-bifold-futon-mattress.html' },
  { name: 'futonland-category', url: 'https://www.futonland.com/futon-frames.html' },
  { name: 'thefutonshop-product', url: 'https://www.thefutonshop.com/futon-frames/albany-futon-frame' },
  { name: 'thefutonshop-category', url: 'https://www.thefutonshop.com/futon-frames' },

  // Premium competitors — product detail pages
  { name: 'article-product', url: 'https://www.article.com/product/17144/sven-charme-tan-sofa' },
  { name: 'castlery-product', url: 'https://www.castlery.com/us/products/adams-sofa' },
  { name: 'burrow-product', url: 'https://burrow.com/nomad-sofa' },
  { name: 'cb2-product', url: 'https://www.cb2.com/avec-sofa/s309025' },
  { name: 'westelm-product', url: 'https://www.westelm.com/products/hamilton-leather-sofa-h2053/' },

  // Our current site pages (before/after comparison)
  { name: 'cf-current-homepage', url: 'https://www.carolinafutons.com/' },
  { name: 'cf-current-category', url: 'https://www.carolinafutons.com/futon-frames' },
  { name: 'cf-current-product', url: 'https://www.carolinafutons.com/product-page/trinity-futon-frame' },
  { name: 'cf-current-about', url: 'https://www.carolinafutons.com/about' },
  { name: 'cf-current-contact', url: 'https://www.carolinafutons.com/contact' },
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

    // Navigate with strict timeout
    await Promise.race([
      page.goto(target.url, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Page load timeout')), PAGE_TIMEOUT)),
    ]);

    // Small delay for lazy-loaded content
    await new Promise(r => setTimeout(r, 2000));

    // Screenshot with strict timeout
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
    if (page) {
      try { await page.close(); } catch (e) {}
    }
  }
}

async function main() {
  console.log(`Starting screenshot capture: ${TARGETS.length} targets`);
  console.log(`Output: ${SCREENSHOT_DIR}`);
  console.log('---');

  // Total script timeout safety net
  const killTimer = setTimeout(() => {
    console.log('\nTOTAL TIMEOUT reached (5 min). Exiting.');
    process.exit(1);
  }, TOTAL_TIMEOUT);

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    // Run sequentially to avoid memory issues
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
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    clearTimeout(killTimer);
  }
}

main();
