/**
 * @file cf-44qt-logError-batch9.test.js
 * @description Static source-pin for cf-44qt batch9 modules: confirms
 * canonical logError import and correct tag usage. No source changes —
 * test-only PR per cf-d24u.
 *
 * Modules covered (5):
 *   - facebookCatalog.web.js  (6 logError sites, colon-namespace)
 *   - googleMerchantFeed.web.js (2 logError sites, colon-namespace)
 *   - guideSeoService.web.js  (2 logError sites, bracket-style — current main state)
 *   - inventoryService.web.js  (3 logError sites, colon-namespace, via batch-M)
 *   - inventorySync.web.js     (3 logError sites, colon-namespace, via batch-M)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const IMPORT_RE =
  /import\s*\{[^}]*\blogError\b[^}]*\}\s*from\s*['"]backend\/utils\/errorHandler['"]/;

// ── facebookCatalog ───────────────────────────────────────────────────────────

describe('facebookCatalog.web.js — logError pins', () => {
  const src = read('src/backend/facebookCatalog.web.js');

  it('imports logError from backend/utils/errorHandler', () => {
    expect(src).toMatch(IMPORT_RE);
  });

  it('has no raw console.error calls', () => {
    expect(src).not.toMatch(/console\.error/);
  });

  it('uses tag facebookCatalog:buildCatalogBatch', () => {
    expect(src).toMatch(/logError\(\s*['"]facebookCatalog:buildCatalogBatch['"]/);
  });

  it('uses tag facebookCatalog:refreshFacebookCatalog-notifyOwnerFailed', () => {
    expect(src).toMatch(/logError\(\s*['"]facebookCatalog:refreshFacebookCatalog-notifyOwnerFailed['"]/);
  });

  it('uses tag facebookCatalog:refreshFacebookCatalog (failure path)', () => {
    expect(src).toMatch(/logError\(\s*`facebookCatalog:refreshFacebookCatalog(?:\s|msg=)/);
  });

  it('uses tag facebookCatalog:exportCustomerAudienceData', () => {
    expect(src).toMatch(/logError\(\s*['"]facebookCatalog:exportCustomerAudienceData['"]/);
  });
});

// ── googleMerchantFeed ────────────────────────────────────────────────────────

describe('googleMerchantFeed.web.js — logError pins', () => {
  const src = read('src/backend/googleMerchantFeed.web.js');

  it('imports logError from backend/utils/errorHandler', () => {
    expect(src).toMatch(IMPORT_RE);
  });

  it('has no raw console.error calls', () => {
    expect(src).not.toMatch(/console\.error/);
  });

  it('uses tag googleMerchantFeed:generateFeed', () => {
    expect(src).toMatch(/logError\(\s*['"]googleMerchantFeed:generateFeed['"]/);
  });

  it('uses tag googleMerchantFeed:generateFeedData', () => {
    expect(src).toMatch(/logError\(\s*['"]googleMerchantFeed:generateFeedData['"]/);
  });
});

// ── guideSeoService ───────────────────────────────────────────────────────────

describe('guideSeoService.web.js — logError pins', () => {
  const src = read('src/backend/guideSeoService.web.js');

  it('imports logError from backend/utils/errorHandler', () => {
    expect(src).toMatch(IMPORT_RE);
  });

  it('has no raw console.error calls', () => {
    expect(src).not.toMatch(/console\.error/);
  });

  it('uses logError for getRelatedProducts failure path', () => {
    expect(src).toMatch(/logError\(\s*['"`][^'"]*guideSeoService[^'"]*getRelatedProducts/);
  });

  it('uses logError for getGuidePageSeoData failure path', () => {
    expect(src).toMatch(/logError\(\s*['"`][^'"]*guideSeoService[^'"]*getGuidePageSeoData/);
  });
});

// ── inventoryService ──────────────────────────────────────────────────────────

describe('inventoryService.web.js — logError pins (batch-M)', () => {
  const src = read('src/backend/inventoryService.web.js');

  it('imports logError from backend/utils/errorHandler', () => {
    expect(src).toMatch(IMPORT_RE);
  });

  it('has no raw console.error calls', () => {
    expect(src).not.toMatch(/console\.error/);
  });

  it('uses tag inventoryService:getStockStatus', () => {
    expect(src).toMatch(/logError\(\s*['"]inventoryService:getStockStatus['"]/);
  });

  it('uses tag inventoryService:signUpBackInStock', () => {
    expect(src).toMatch(/logError\(\s*['"]inventoryService:signUpBackInStock['"]/);
  });

  it('uses tag inventoryService:getInventoryUrgency', () => {
    expect(src).toMatch(/logError\(\s*['"]inventoryService:getInventoryUrgency['"]/);
  });
});

// ── inventorySync ─────────────────────────────────────────────────────────────

describe('inventorySync.web.js — logError pins (batch-M)', () => {
  const src = read('src/backend/inventorySync.web.js');

  it('imports logError from backend/utils/errorHandler', () => {
    expect(src).toMatch(IMPORT_RE);
  });

  it('has no raw console.error calls', () => {
    expect(src).not.toMatch(/console\.error/);
  });

  it('uses tag inventorySync:syncProduct', () => {
    expect(src).toMatch(/logError\(\s*`inventorySync:syncProduct/);
  });

  it('uses tag inventorySync:syncFailed', () => {
    expect(src).toMatch(/logError\(\s*['"]inventorySync:syncFailed['"]/);
  });

  it('uses tag inventorySync:syncComplete-info', () => {
    expect(src).toMatch(/logError\(\s*`inventorySync:syncComplete-info/);
  });
});
