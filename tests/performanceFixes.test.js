/**
 * @file performanceFixes.test.js
 * @description Tests for hq-r3ie performance fixes:
 * 1. masterPage.js: injectBusinessSchema() must NOT be awaited (blocks LCP)
 * 2. Product Page.js: productVideo, stockUrgency, bundleSection, backInStock,
 *    wishlistButton must be deferred (critical: false)
 * 3. Home.js: featuredProducts must be deferred (critical: false)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const masterPageContent = readFileSync('src/pages/masterPage.js', 'utf-8');
const productPageContent = readFileSync('src/pages/Product Page.js', 'utf-8');
const homePageContent = readFileSync('src/pages/Home.js', 'utf-8');

// ── masterPage.js: injectBusinessSchema must not block ──────────────

describe('masterPage.js — injectBusinessSchema not awaited (hq-r3ie)', () => {
  it('does NOT await injectBusinessSchema() in $w.onReady', () => {
    // The await on injectBusinessSchema() blocks every page load on 2 non-critical
    // backend calls (getBusinessSchema + getWebSiteSchema). Schema injection
    // doesn't affect user-visible content and should be fire-and-forget.
    const awaitPattern = /await\s+injectBusinessSchema\s*\(/;
    expect(masterPageContent).not.toMatch(awaitPattern);
  });

  it('still calls injectBusinessSchema() (just without await)', () => {
    // We want the call to remain, just not block
    expect(masterPageContent).toMatch(/injectBusinessSchema\s*\(/);
  });
});

// ── Product Page.js: move non-LCP sections to deferred ──────────────

describe('Product Page.js — critical/deferred split (hq-r3ie)', () => {
  // These sections should be deferred (critical: false) because they
  // are not LCP elements and don't need to block page readiness
  const shouldBeDeferred = [
    'productVideo',
    'stockUrgency',
    'bundleSection',
    'backInStock',
    'wishlistButton',
  ];

  for (const sectionName of shouldBeDeferred) {
    it(`"${sectionName}" section is deferred (critical: false)`, () => {
      // Match the section definition on one line (or within one object literal)
      // and verify critical: false — use [^}]* to stay within the object
      const pattern = new RegExp(
        `\\{[^}]*name:\\s*['"]${sectionName}['"][^}]*critical:\\s*false`
      );
      expect(productPageContent).toMatch(pattern);
    });
  }

  // These sections MUST remain critical — they affect LCP
  const mustRemainCritical = [
    'variantSelector',
    'imageGallery',
    'breadcrumbs',
    'addToCart',
    'quantitySelector',
    'productBadge',
    'swatchSelector',
    'productMeta',
  ];

  for (const sectionName of mustRemainCritical) {
    it(`"${sectionName}" section remains critical (critical: true)`, () => {
      const pattern = new RegExp(
        `\\{[^}]*name:\\s*['"]${sectionName}['"][^}]*critical:\\s*true`
      );
      expect(productPageContent).toMatch(pattern);
    });
  }
});

// ── Home.js: featuredProducts must be deferred ──────────────────────

describe('Home.js — featuredProducts deferred (hq-r3ie)', () => {
  it('featuredProducts section is deferred (critical: false)', () => {
    const pattern = /\{[^}]*name:\s*['"]featuredProducts['"][^}]*critical:\s*false/;
    expect(homePageContent).toMatch(pattern);
  });

  // Other critical sections must remain critical
  const mustRemainCritical = ['heroAnimation', 'categoryShowcase'];

  for (const sectionName of mustRemainCritical) {
    it(`"${sectionName}" section remains critical (critical: true)`, () => {
      const pattern = new RegExp(
        `\\{[^}]*name:\\s*['"]${sectionName}['"][^}]*critical:\\s*true`
      );
      expect(homePageContent).toMatch(pattern);
    });
  }
});
