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
    options: [],
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: { ariaLabel: '', ariaLive: undefined, role: undefined },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
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

vi.mock('backend/roomPlanner.web', () => ({
  getProductDimensions: vi.fn().mockResolvedValue({
    success: true,
    products: [
      { productType: 'futon-frame-full', label: 'Full Futon Frame', category: 'futon-frames', width: 82, depth: 38, depthBed: 54 },
    ],
  }),
  createRoomLayout: vi.fn().mockResolvedValue({ success: true, id: 'layout-1', shareId: 'abc12345' }),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn().mockResolvedValue(null),
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

vi.mock('public/roomPlannerHelpers.js', async () => {
  const actual = await vi.importActual('../src/public/roomPlannerHelpers.js');
  return actual;
});

// ── Tests ───────────────────────────────────────────────────────────

describe('Room Planner Page', () => {
  beforeEach(() => {
    elements.clear();
    onReadyHandler = null;
    vi.resetModules();
  });

  it('registers $w.onReady handler', async () => {
    await import('../src/pages/Room Planner.js');
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('onReady tracks page_view event', async () => {
    const { trackEvent } = await import('public/engagementTracker');
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({ page: 'room-planner' }));
  });

  it('populates hero section', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    const heading = getEl('#plannerHeroHeading');
    expect(heading.text.length).toBeGreaterThan(0);
  });

  it('sets up room presets repeater', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    const repeater = getEl('#roomPresetsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThanOrEqual(3);
  });

  it('sets up product palette repeater', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    const repeater = getEl('#productPaletteRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThanOrEqual(2);
  });

  it('sets up instructions steps repeater', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    const repeater = getEl('#plannerStepsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThanOrEqual(3);
  });

  it('sets up room shape dropdown', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    const dropdown = getEl('#roomShapeDropdown');
    expect(dropdown.options.length).toBeGreaterThanOrEqual(2);
  });

  it('initializes back-to-top', async () => {
    const { initBackToTop } = await import('public/mobileHelpers');
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalled();
  });

  it('sets aria labels on repeaters', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    const presets = getEl('#roomPresetsRepeater');
    expect(presets.accessibility.ariaLabel).toBeTruthy();
  });
});
