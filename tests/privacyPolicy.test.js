/**
 * Tests for pages/Privacy Policy.js
 * Covers: policy section data, accordion expand/collapse, TOC navigation,
 * ARIA attributes, mobile collapse behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    data: [],
    collapsed: false,
    accessibility: { ariaLabel: '', role: '', ariaExpanded: undefined },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    postMessage: vi.fn(),
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

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Helper ──────────────────────────────────────────────────────────

async function loadPage() {
  onReadyHandler = null;
  elements.clear();
  vi.resetModules();
  await import('../src/pages/Privacy Policy.js');
  if (onReadyHandler) await onReadyHandler();
  await new Promise((r) => setTimeout(r, 50));
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Privacy Policy page — initialization', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('registers an onReady handler', async () => {
    await import('../src/pages/Privacy Policy.js');
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls initPageSeo with privacyPolicy', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('privacyPolicy');
  });

  it('calls initBackToTop', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalled();
  });

  it('calls collapseOnMobile for TOC repeater', async () => {
    await loadPage();
    const { collapseOnMobile } = await import('public/mobileHelpers');
    expect(collapseOnMobile).toHaveBeenCalledWith($w, ['#policyTocRepeater']);
  });
});

describe('Privacy Policy page — content rendering', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('sets the page title', async () => {
    await loadPage();
    expect(getEl('#policyTitle').text).toBe('Privacy Policy');
  });

  it('sets the effective date', async () => {
    await loadPage();
    expect(getEl('#policyEffectiveDate').text).toMatch(/Effective Date:/);
  });

  it('sets the intro paragraph', async () => {
    await loadPage();
    expect(getEl('#policyIntro').text).toContain('Carolina Futons');
  });

  it('populates the policy repeater with 9 sections', async () => {
    await loadPage();
    const repeater = getEl('#policyRepeater');
    expect(repeater.data.length).toBe(9);
  });

  it('all sections have _id, title, and content', async () => {
    await loadPage();
    const repeater = getEl('#policyRepeater');
    for (const section of repeater.data) {
      expect(section._id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.content.length).toBeGreaterThan(20);
    }
  });

  it('section titles include expected policy topics', async () => {
    await loadPage();
    const titles = getEl('#policyRepeater').data.map((s) => s.title);
    expect(titles).toContain('Information We Collect');
    expect(titles).toContain('Your Rights');
    expect(titles).toContain('Contact Us');
  });
});

describe('Privacy Policy page — accordion behavior', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('sets up onItemReady on the policy repeater', async () => {
    await loadPage();
    expect(getEl('#policyRepeater').onItemReady).toHaveBeenCalled();
  });

  it('accordion items start collapsed with + toggle', async () => {
    await loadPage();
    const repeater = getEl('#policyRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Test', content: 'Test content' });
    expect(itemEls['#sectionContent'].collapse).toHaveBeenCalled();
    expect(itemEls['#sectionToggle'].text).toBe('+');
  });

  it('sets ARIA role=button on section title', async () => {
    await loadPage();
    const repeater = getEl('#policyRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Info', content: 'Content' });
    expect(itemEls['#sectionTitle'].accessibility.role).toBe('button');
  });

  it('toggles section on title click — expand', async () => {
    await loadPage();
    const repeater = getEl('#policyRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Info', content: 'Content' });

    // Content starts collapsed
    itemEls['#sectionContent'].collapsed = true;
    const clickHandler = itemEls['#sectionTitle'].onClick.mock.calls[0][0];
    clickHandler();

    expect(itemEls['#sectionContent'].expand).toHaveBeenCalled();
    expect(itemEls['#sectionToggle'].text).toBe('\u2212');
  });

  it('toggles section on title click — collapse', async () => {
    await loadPage();
    const repeater = getEl('#policyRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Info', content: 'Content' });

    // Simulate expanded state
    itemEls['#sectionContent'].collapsed = false;
    const clickHandler = itemEls['#sectionTitle'].onClick.mock.calls[0][0];
    clickHandler();

    expect(itemEls['#sectionContent'].collapse).toHaveBeenCalledTimes(2); // once in init, once in toggle
    expect(itemEls['#sectionToggle'].text).toBe('+');
  });
});

describe('Privacy Policy page — TOC navigation', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('sets up onItemReady on the TOC repeater', async () => {
    await loadPage();
    expect(getEl('#policyTocRepeater').onItemReady).toHaveBeenCalled();
  });

  it('populates TOC repeater with same sections as policy repeater', async () => {
    await loadPage();
    expect(getEl('#policyTocRepeater').data.length).toBe(9);
  });

  it('sets TOC link text to section title', async () => {
    await loadPage();
    const tocRepeater = getEl('#policyTocRepeater');
    const itemReadyCb = tocRepeater.onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Your Rights', anchor: '#policyRights' });
    expect(itemEls['#tocLink'].text).toBe('Your Rights');
  });

  it('TOC link has accessible aria label', async () => {
    await loadPage();
    const tocRepeater = getEl('#policyTocRepeater');
    const itemReadyCb = tocRepeater.onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '1', title: 'Data Security', anchor: '#policySecurity' });
    expect(itemEls['#tocLink'].accessibility.ariaLabel).toBe('Jump to Data Security');
  });

  it('TOC link click scrolls to anchor', async () => {
    await loadPage();
    const tocRepeater = getEl('#policyTocRepeater');
    const itemReadyCb = tocRepeater.onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = (sel) => {
      if (!itemEls[sel]) itemEls[sel] = createMockElement();
      return itemEls[sel];
    };

    itemReadyCb($item, { _id: '5', title: 'Your Rights', anchor: '#policyRights' });
    const clickHandler = itemEls['#tocLink'].onClick.mock.calls[0][0];
    clickHandler();

    expect(getEl('#policyRights').scrollTo).toHaveBeenCalled();
  });

  it('sets ARIA label on TOC repeater', async () => {
    await loadPage();
    expect(getEl('#policyTocRepeater').accessibility.ariaLabel).toBe('Privacy policy table of contents');
  });
});
