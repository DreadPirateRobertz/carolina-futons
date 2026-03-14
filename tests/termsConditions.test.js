/**
 * Tests for pages/Terms & Conditions.js
 * Covers: terms section data, accordion expand/collapse, TOC navigation,
 * ARIA attributes, collapseOnMobile wiring.
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
  collapseOnMobile: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Helper ──────────────────────────────────────────────────────────

async function loadPage() {
  onReadyHandler = null;
  elements.clear();
  vi.resetModules();
  await import('../src/pages/Terms & Conditions.js');
  if (onReadyHandler) await onReadyHandler();
  await new Promise((r) => setTimeout(r, 50));
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Terms & Conditions page — initialization', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('registers an onReady handler', async () => {
    await import('../src/pages/Terms & Conditions.js');
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls initPageSeo with termsConditions', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('termsConditions');
  });

  it('calls initBackToTop', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalled();
  });

  it('calls collapseOnMobile for TOC repeater', async () => {
    await loadPage();
    const { collapseOnMobile } = await import('public/mobileHelpers');
    expect(collapseOnMobile).toHaveBeenCalledWith($w, ['#termsTocRepeater']);
  });
});

describe('Terms & Conditions page — content', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('sets the page title', async () => {
    await loadPage();
    expect(getEl('#termsTitle').text).toBe('Terms & Conditions');
  });

  it('sets the effective date', async () => {
    await loadPage();
    expect(getEl('#termsEffectiveDate').text).toMatch(/Effective Date:/);
  });

  it('sets the intro text mentioning Carolina Futons', async () => {
    await loadPage();
    expect(getEl('#termsIntro').text).toContain('carolinafutons.com');
  });

  it('populates the terms repeater with 10 sections', async () => {
    await loadPage();
    expect(getEl('#termsRepeater').data.length).toBe(10);
  });

  it('all sections have _id, title, anchor, and content', async () => {
    await loadPage();
    for (const section of getEl('#termsRepeater').data) {
      expect(section._id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.anchor).toMatch(/^#terms/);
      expect(section.content.length).toBeGreaterThan(20);
    }
  });

  it('includes all expected legal topics', async () => {
    await loadPage();
    const titles = getEl('#termsRepeater').data.map((s) => s.title);
    expect(titles).toContain('Acceptance of Terms');
    expect(titles).toContain('Products & Pricing');
    expect(titles).toContain('Orders & Payment');
    expect(titles).toContain('Shipping & Delivery');
    expect(titles).toContain('Returns & Refunds');
    expect(titles).toContain('Warranties');
    expect(titles).toContain('Governing Law');
  });

  it('warranties section mentions Night & Day and KD Frames', async () => {
    await loadPage();
    const section = getEl('#termsRepeater').data.find((s) => s.title === 'Warranties');
    expect(section.content).toContain('Night & Day');
    expect(section.content).toContain('KD Frames');
  });

  it('governing law section specifies North Carolina', async () => {
    await loadPage();
    const section = getEl('#termsRepeater').data.find((s) => s.title === 'Governing Law');
    expect(section.content).toContain('North Carolina');
  });
});

describe('Terms & Conditions page — accordion behavior', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('sets up onItemReady on the terms repeater', async () => {
    await loadPage();
    expect(getEl('#termsRepeater').onItemReady).toHaveBeenCalled();
  });

  it('items start collapsed with + toggle', async () => {
    await loadPage();
    const itemReadyCb = getEl('#termsRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Test', content: 'Content' });
    expect(itemEls['#sectionContent'].collapse).toHaveBeenCalled();
    expect(itemEls['#sectionToggle'].text).toBe('+');
  });

  it('sets ARIA role=button on section title', async () => {
    await loadPage();
    const itemReadyCb = getEl('#termsRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Test', content: 'Content' });
    expect(itemEls['#sectionTitle'].accessibility.role).toBe('button');
  });

  it('clicking title expands collapsed section', async () => {
    await loadPage();
    const itemReadyCb = getEl('#termsRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Test', content: 'Content' });
    itemEls['#sectionContent'].collapsed = true;

    const clickHandler = itemEls['#sectionTitle'].onClick.mock.calls[0][0];
    clickHandler();

    expect(itemEls['#sectionContent'].expand).toHaveBeenCalled();
    expect(itemEls['#sectionToggle'].text).toBe('\u2212');
  });

  it('clicking title collapses expanded section', async () => {
    await loadPage();
    const itemReadyCb = getEl('#termsRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Test', content: 'Content' });
    itemEls['#sectionContent'].collapsed = false;

    const clickHandler = itemEls['#sectionTitle'].onClick.mock.calls[0][0];
    clickHandler();

    expect(itemEls['#sectionContent'].collapse).toHaveBeenCalledTimes(2);
    expect(itemEls['#sectionToggle'].text).toBe('+');
  });
});

describe('Terms & Conditions page — TOC navigation', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('sets up onItemReady on the TOC repeater', async () => {
    await loadPage();
    expect(getEl('#termsTocRepeater').onItemReady).toHaveBeenCalled();
  });

  it('populates TOC repeater with 10 sections', async () => {
    await loadPage();
    expect(getEl('#termsTocRepeater').data.length).toBe(10);
  });

  it('sets TOC link text to section title', async () => {
    await loadPage();
    const itemReadyCb = getEl('#termsTocRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Warranties', anchor: '#termsWarranties' });
    expect(itemEls['#tocLink'].text).toBe('Warranties');
  });

  it('TOC link has accessible aria label', async () => {
    await loadPage();
    const itemReadyCb = getEl('#termsTocRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '6', title: 'Warranties', anchor: '#termsWarranties' });
    expect(itemEls['#tocLink'].accessibility.ariaLabel).toBe('Jump to Warranties');
  });

  it('TOC link click scrolls to the anchor element', async () => {
    await loadPage();
    const itemReadyCb = getEl('#termsTocRepeater').onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '9', title: 'Governing Law', anchor: '#termsGoverning' });
    const clickHandler = itemEls['#tocLink'].onClick.mock.calls[0][0];
    clickHandler();

    expect(getEl('#termsGoverning').scrollTo).toHaveBeenCalled();
  });

  it('sets ARIA label on TOC repeater', async () => {
    await loadPage();
    expect(getEl('#termsTocRepeater').accessibility.ariaLabel).toBe('Terms and conditions table of contents');
  });
});
