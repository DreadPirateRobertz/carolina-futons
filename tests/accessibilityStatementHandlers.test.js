import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
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

// ── Dependency Mocks ────────────────────────────────────────────────

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Tests ───────────────────────────────────────────────────────────

describe('Accessibility Statement page', () => {
  let initPageSeo;
  let initBackToTop;

  beforeAll(async () => {
    const seoMod = await import('public/pageSeo.js');
    initPageSeo = seoMod.initPageSeo;

    const mobileMod = await import('public/mobileHelpers');
    initBackToTop = mobileMod.initBackToTop;

    await import('../src/pages/Accessibility Statement.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('calls initPageSeo with "accessibility"', async () => {
    await onReadyHandler();
    expect(initPageSeo).toHaveBeenCalledWith('accessibility');
  });

  it('calls initBackToTop with $w', async () => {
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });

  it('does not throw if initBackToTop throws', () => {
    initBackToTop.mockImplementationOnce(() => { throw new Error('boom'); });
    expect(() => onReadyHandler()).not.toThrow();
  });
});
