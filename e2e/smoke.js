/**
 * E2E smoke tests — Puppeteer against staging site.
 *
 * Validates critical page renders without asserting Wix-internal DOM IDs.
 * Run: node --test e2e/smoke.js
 * Env: E2E_BASE_URL (default: staging site)
 */

import puppeteer from 'puppeteer';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL =
  process.env.E2E_BASE_URL || 'https://halworker85.wixstudio.com/my-site';

const LAUNCH_OPTS = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
};

const NAV_OPTS = { waitUntil: 'networkidle2', timeout: 45_000 };

let browser;

before(async () => {
  browser = await puppeteer.launch(LAUNCH_OPTS);
});

after(async () => {
  await browser.close();
});

// ── Helper ─────────────────────────────────────────────────────────────────

async function openPage(url) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const response = await page.goto(url, NAV_OPTS);
  return { page, status: response ? response.status() : 0 };
}

// ── Tests ──────────────────────────────────────────────────────────────────

test('homepage: returns HTTP 200', async () => {
  const { page, status } = await openPage(BASE_URL);
  try {
    assert.equal(status, 200, 'Homepage must return HTTP 200');
  } finally {
    await page.close();
  }
});

test('homepage: title is non-empty', async () => {
  const { page } = await openPage(BASE_URL);
  try {
    const title = await page.title();
    assert.ok(title.length > 0, 'Page title must not be empty');
  } finally {
    await page.close();
  }
});

test('homepage: HTML contains Carolina Futons branding', async () => {
  const { page } = await openPage(BASE_URL);
  try {
    const html = await page.content();
    assert.ok(
      /carolina futons/i.test(html),
      'Homepage HTML must contain "Carolina Futons"'
    );
  } finally {
    await page.close();
  }
});

test('homepage: page has navigable anchor links', async () => {
  const { page } = await openPage(BASE_URL);
  try {
    const links = await page.$$('a[href]');
    assert.ok(links.length > 0, 'Homepage must have at least one <a href> link');
    // Clean up ElementHandle array
    await Promise.all(links.map((l) => l.dispose()));
  } finally {
    await page.close();
  }
});

test('category page (futon-frames): loads without 404', async () => {
  const { page, status } = await openPage(`${BASE_URL}/category/futon-frames`);
  try {
    assert.equal(status, 200, 'Futon frames category must return HTTP 200');
    const html = await page.content();
    assert.ok(
      !/page not found/i.test(html),
      'Futon frames category must not show a 404 page'
    );
  } finally {
    await page.close();
  }
});

test('category page (murphy-cabinet-beds): loads without 404', async () => {
  const { page, status } = await openPage(
    `${BASE_URL}/category/murphy-cabinet-beds`
  );
  try {
    assert.equal(status, 200, 'Murphy cabinet beds category must return HTTP 200');
    const html = await page.content();
    assert.ok(
      !/page not found/i.test(html),
      'Murphy cabinet beds category must not show a 404 page'
    );
  } finally {
    await page.close();
  }
});
