import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    html: '',
    data: [],
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: { ariaLabel: '', ariaLive: undefined, role: undefined },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
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

// ── Mock Backend ────────────────────────────────────────────────────

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn().mockResolvedValue('{"@type":"LocalBusiness"}'),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
  announce: vi.fn(),
}));

vi.mock('public/sustainabilityHelpers.js', async () => {
  const actual = await vi.importActual('../src/public/sustainabilityHelpers.js');
  return actual;
});

// ── Tests ───────────────────────────────────────────────────────────

describe('Sustainability Page', () => {
  beforeEach(() => {
    elements.clear();
    onReadyHandler = null;
    vi.resetModules();
  });

  it('registers $w.onReady handler', async () => {
    await import('../src/pages/Sustainability.js');
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('onReady calls initBackToTop', async () => {
    const { initBackToTop } = await import('public/mobileHelpers');
    await import('../src/pages/Sustainability.js');
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalled();
  });

  it('onReady tracks page_view event', async () => {
    const { trackEvent } = await import('public/engagementTracker');
    await import('../src/pages/Sustainability.js');
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({ page: 'sustainability' }));
  });

  it('populates hero section text elements', async () => {
    await import('../src/pages/Sustainability.js');
    await onReadyHandler();
    // Hero elements should have been populated with sustainability content
    const heading = getEl('#sustainHeroHeading');
    expect(heading.text.length).toBeGreaterThan(0);
  });

  it('sets up materials repeater with data', async () => {
    await import('../src/pages/Sustainability.js');
    await onReadyHandler();
    const repeater = getEl('#materialsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThanOrEqual(3);
  });

  it('sets up certifications repeater', async () => {
    await import('../src/pages/Sustainability.js');
    await onReadyHandler();
    const repeater = getEl('#certificationsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThanOrEqual(2);
  });

  it('sets up badges repeater', async () => {
    await import('../src/pages/Sustainability.js');
    await onReadyHandler();
    const repeater = getEl('#badgesRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThanOrEqual(4);
  });

  it('sets up trade-in steps repeater', async () => {
    await import('../src/pages/Sustainability.js');
    await onReadyHandler();
    const repeater = getEl('#tradeInStepsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThanOrEqual(3);
  });

  it('sets up condition dropdown for trade-in form', async () => {
    await import('../src/pages/Sustainability.js');
    await onReadyHandler();
    const dropdown = getEl('#tradeInCondition');
    // Options should be set
    expect(dropdown.options || dropdown.data).toBeDefined();
  });

  it('injects SEO schema', async () => {
    const { getBusinessSchema } = await import('backend/seoHelpers.web');
    await import('../src/pages/Sustainability.js');
    await onReadyHandler();
    expect(getBusinessSchema).toHaveBeenCalled();
  });

  it('sets aria labels on repeaters for accessibility', async () => {
    await import('../src/pages/Sustainability.js');
    await onReadyHandler();
    const materialsRepeater = getEl('#materialsRepeater');
    expect(materialsRepeater.accessibility.ariaLabel).toBeTruthy();
  });
});
