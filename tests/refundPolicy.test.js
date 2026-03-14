/**
 * Tests for pages/Refund Policy.js
 * Covers: accordion sections, expand/collapse, ARIA attributes,
 * policy content validation (30-day window, warranty periods).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    data: [],
    collapsed: false,
    accessibility: { ariaLabel: '', role: '', ariaExpanded: undefined },
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Helper ──────────────────────────────────────────────────────────

async function loadPage() {
  onReadyHandler = null;
  elements.clear();
  vi.resetModules();
  await import('../src/pages/Refund Policy.js');
  if (onReadyHandler) await onReadyHandler();
  await new Promise((r) => setTimeout(r, 50));
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Refund Policy page — initialization', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('registers an onReady handler', async () => {
    await import('../src/pages/Refund Policy.js');
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls initPageSeo with refundPolicy', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('refundPolicy');
  });

  it('calls initBackToTop', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalled();
  });
});

describe('Refund Policy page — content', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('populates the policy repeater with 5 sections', async () => {
    await loadPage();
    expect(getEl('#policyRepeater').data.length).toBe(5);
  });

  it('all sections have _id, title, and content', async () => {
    await loadPage();
    for (const section of getEl('#policyRepeater').data) {
      expect(section._id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.content.length).toBeGreaterThan(20);
    }
  });

  it('includes expected policy topics', async () => {
    await loadPage();
    const titles = getEl('#policyRepeater').data.map((s) => s.title);
    expect(titles).toContain('Return Eligibility');
    expect(titles).toContain('Refund Processing');
    expect(titles).toContain('Damaged or Defective Items');
    expect(titles).toContain('Exchange Policy');
  });

  it('return eligibility mentions 30-day window', async () => {
    await loadPage();
    const section = getEl('#policyRepeater').data.find((s) => s.title === 'Return Eligibility');
    expect(section.content).toContain('30 days');
  });

  it('damaged items section mentions warranty periods', async () => {
    await loadPage();
    const section = getEl('#policyRepeater').data.find((s) => s.title === 'Damaged or Defective Items');
    expect(section.content).toContain('3-year');
    expect(section.content).toContain('5-year');
  });
});

describe('Refund Policy page — accordion behavior', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('sets up onItemReady on the repeater', async () => {
    await loadPage();
    expect(getEl('#policyRepeater').onItemReady).toHaveBeenCalled();
  });

  it('items start collapsed with + toggle', async () => {
    await loadPage();
    const itemReadyCb = getEl('#policyRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Return Eligibility', content: 'Items may be returned...' });
    expect(itemEls['#policyContent'].collapse).toHaveBeenCalled();
    expect(itemEls['#policyToggle'].text).toBe('+');
  });

  it('sets ARIA role=button on title', async () => {
    await loadPage();
    const itemReadyCb = getEl('#policyRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Test', content: 'Content' });
    expect(itemEls['#policyTitle'].accessibility.role).toBe('button');
  });

  it('sets ARIA label on toggle with section title', async () => {
    await loadPage();
    const itemReadyCb = getEl('#policyRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Refund Processing', content: 'Refunds...' });
    expect(itemEls['#policyToggle'].accessibility.ariaLabel).toBe('Toggle Refund Processing');
  });

  it('clicking title expands collapsed section', async () => {
    await loadPage();
    const itemReadyCb = getEl('#policyRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Test', content: 'Content' });
    itemEls['#policyContent'].collapsed = true;

    const clickHandler = itemEls['#policyTitle'].onClick.mock.calls[0][0];
    clickHandler();

    expect(itemEls['#policyContent'].expand).toHaveBeenCalled();
    expect(itemEls['#policyToggle'].text).toBe('\u2212');
  });

  it('clicking title collapses expanded section', async () => {
    await loadPage();
    const itemReadyCb = getEl('#policyRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Test', content: 'Content' });
    itemEls['#policyContent'].collapsed = false;

    const clickHandler = itemEls['#policyTitle'].onClick.mock.calls[0][0];
    clickHandler();

    expect(itemEls['#policyContent'].collapse).toHaveBeenCalledTimes(2);
    expect(itemEls['#policyToggle'].text).toBe('+');
  });
});
