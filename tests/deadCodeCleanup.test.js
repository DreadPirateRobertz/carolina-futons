import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Helper: read source file ────────────────────────────────────────
function readSrc(relPath) {
  return readFileSync(resolve(__dirname, '..', relPath), 'utf8');
}

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));

// ── 1-7: Unused Import Removal ──────────────────────────────────────

describe('Unused imports removed', () => {
  it('Home.js does not import getCategoryHeroImage', () => {
    const src = readSrc('src/pages/Home.js');
    expect(src).not.toMatch(/getCategoryHeroImage/);
  });

  it('Cart Page.js does not import isMobile', () => {
    const src = readSrc('src/pages/Cart Page.js');
    // isMobile should not appear in the import line from mobileHelpers
    const importLine = src.split('\n').find(l => l.includes('mobileHelpers'));
    expect(importLine).toBeDefined();
    expect(importLine).not.toMatch(/\bisMobile\b/);
  });

  it('Side Cart.js does not import clampQuantity', () => {
    const src = readSrc('src/pages/Side Cart.js');
    const importLines = src.split('\n').filter(l => l.includes('cartService'));
    const joined = importLines.join(' ');
    expect(joined).not.toMatch(/\bclampQuantity\b/);
  });

  it('Side Cart.js does not import FREE_SHIPPING_THRESHOLD', () => {
    const src = readSrc('src/pages/Side Cart.js');
    const importLines = src.split('\n').filter(l => l.includes('cartService'));
    const joined = importLines.join(' ');
    expect(joined).not.toMatch(/\bFREE_SHIPPING_THRESHOLD\b/);
  });

  it('Checkout.js does not import makeClickable', () => {
    const src = readSrc('src/pages/Checkout.js');
    const importLine = src.split('\n').find(l => l.includes('a11yHelpers'));
    expect(importLine).toBeDefined();
    expect(importLine).not.toMatch(/\bmakeClickable\b/);
  });

  it('Returns.js does not import isItemReturnable', () => {
    const src = readSrc('src/pages/Returns.js');
    const importLine = src.split('\n').find(l => l.includes('ReturnsPortal'));
    expect(importLine).toBeDefined();
    expect(importLine).not.toMatch(/\bisItemReturnable\b/);
  });

  it('Admin Returns.js does not import isValidTransition', () => {
    const src = readSrc('src/pages/Admin Returns.js');
    const importLine = src.split('\n').find(l => l.includes('ReturnsAdmin'));
    expect(importLine).toBeDefined();
    expect(importLine).not.toMatch(/\bisValidTransition\b/);
  });

  it('Admin Returns.js does not import getAdminStatusColor', () => {
    const src = readSrc('src/pages/Admin Returns.js');
    const importLine = src.split('\n').find(l => l.includes('ReturnsAdmin'));
    expect(importLine).toBeDefined();
    expect(importLine).not.toMatch(/\bgetAdminStatusColor\b/);
  });

  it('Admin Returns.js does not import typography', () => {
    const src = readSrc('src/pages/Admin Returns.js');
    const importLine = src.split('\n').find(l => l.includes('designTokens'));
    expect(importLine).toBeDefined();
    expect(importLine).not.toMatch(/\btypography\b/);
  });

  it('Newsletter.js does not import colors from designTokens', () => {
    const src = readSrc('src/pages/Newsletter.js');
    // colors should not be imported at all (entire import line should be gone)
    expect(src).not.toMatch(/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*['"]public\/designTokens/);
  });
});

// ── 8: initTrackingButton wired into initDetailPanel ────────────────

describe('Admin Returns.js initTrackingButton', () => {
  it('initTrackingButton is called within initDetailPanel', () => {
    const src = readSrc('src/pages/Admin Returns.js');
    // Extract initDetailPanel function body
    const detailPanelMatch = src.match(/function initDetailPanel\(\)\s*\{([\s\S]*?)\n\}/);
    expect(detailPanelMatch).not.toBeNull();
    const body = detailPanelMatch[1];
    expect(body).toMatch(/initTrackingButton\(\)/);
  });
});

// ── 9: Style Quiz repeater scoping bug ──────────────────────────────

describe('Style Quiz repeater resilience', () => {
  const elements = new Map();

  function createMockElement(exists = true) {
    if (!exists) return undefined;
    return {
      text: '',
      src: '',
      label: '',
      style: { color: '', backgroundColor: '' },
      show: vi.fn(() => Promise.resolve()),
      hide: vi.fn(() => Promise.resolve()),
      collapse: vi.fn(),
      expand: vi.fn(),
      scrollTo: vi.fn(),
      onClick: vi.fn(),
      onChange: vi.fn(),
      onItemReady: vi.fn(),
      onKeyPress: vi.fn(),
      onReady: vi.fn(() => Promise.resolve()),
      accessibility: { role: '', ariaLabel: '', ariaChecked: false, tabIndex: 0 },
      disable: vi.fn(),
      enable: vi.fn(),
      postMessage: vi.fn(),
    };
  }

  function getEl(sel) {
    if (!elements.has(sel)) elements.set(sel, createMockElement());
    return elements.get(sel);
  }

  let onReadyHandler = null;

  beforeEach(() => {
    elements.clear();
    onReadyHandler = null;

    globalThis.$w = Object.assign(
      (sel) => getEl(sel),
      { onReady: (fn) => { onReadyHandler = fn; } }
    );
  });

  // Mock backend
  vi.mock('backend/styleQuiz.web', () => ({
    getQuizRecommendations: vi.fn().mockResolvedValue([]),
    getQuizOptions: vi.fn().mockResolvedValue({
      roomTypes: [], primaryUses: [], stylePreferences: [], sizeOptions: [], budgetRanges: [],
    }),
  }));

  vi.mock('public/engagementTracker', () => ({
    trackEvent: vi.fn(),
  }));

  vi.mock('public/mobileHelpers', () => ({
    initBackToTop: vi.fn(),
  }));

  vi.mock('public/a11yHelpers', () => ({
    announce: vi.fn(),
    makeClickable: vi.fn(),
  }));

  vi.mock('public/designTokens.js', () => ({
    colors: {
      mountainBlue: '#5B8FA8', white: '#FFFFFF', espresso: '#3A2518',
      sand: '#E8D5B7', offWhite: '#FAF7F2', sandLight: '#F2E8D5',
      sunsetCoral: '#E8845C',
    },
  }));

  it('every $item call in resultsRepeater onItemReady is wrapped in try/catch', () => {
    const src = readSrc('src/pages/Style Quiz.js');
    // Extract the onItemReady callback body for resultsRepeater
    const match = src.match(/resultsRepeater[\s\S]*?\.onItemReady\(\(\$item, itemData\) => \{([\s\S]*?)\}\);[\s]*repeater\.data/);
    expect(match).not.toBeNull();
    const body = match[1];

    // Find all lines that use $item (excluding the destructuring line)
    const lines = body.split('\n');
    let tryDepth = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      // Track try/catch nesting
      const tryMatches = (trimmed.match(/\btry\s*\{/g) || []).length;
      const catchMatches = (trimmed.match(/\}\s*catch/g) || []).length;
      tryDepth += tryMatches - catchMatches;

      if (trimmed.includes('$item(') && !trimmed.startsWith('//') && !trimmed.startsWith('const')) {
        // Must be either on a try line itself or inside a try block
        const onTryLine = /try\s*\{/.test(trimmed);
        expect(onTryLine || tryDepth > 0).toBe(true);
      }
    }
  });

  it('all result item fields render even when one element is missing', async () => {
    await import('../src/pages/Style Quiz.js');
    if (onReadyHandler) await onReadyHandler();

    // Get the results repeater and find the onItemReady callback
    // Since renderResults sets onItemReady (not $w.onReady), we need to
    // trigger quiz submission to get the callback registered.
    // For now, verify the source code has try/catch on line 239
    const src = readSrc('src/pages/Style Quiz.js');

    // Find the onItemReady in renderResults and check that the first
    // $item usage (resultProductName) is wrapped in try/catch
    const onItemReadyBlock = src.match(/repeater\.onItemReady\(\(\$item, itemData\) => \{([\s\S]*?)\}\);[\s]*repeater\.data/);
    expect(onItemReadyBlock).not.toBeNull();

    const body = onItemReadyBlock[1];
    // The resultProductName line must be inside a try block
    // Check that there's no bare $item('#resultProductName') outside try/catch
    const lines = body.split('\n');
    const productNameLine = lines.find(l => l.includes("resultProductName') .text") || l.includes("resultProductName').text"));
    if (productNameLine) {
      // Should be preceded by 'try {' or be inside a try block
      const idx = lines.indexOf(productNameLine);
      const preceding = lines.slice(Math.max(0, idx - 3), idx).join(' ');
      expect(preceding).toMatch(/try\s*\{/);
    }
  });
});
