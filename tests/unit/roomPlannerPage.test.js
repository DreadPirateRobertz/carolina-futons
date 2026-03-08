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

const mockCreateRoomLayout = vi.fn().mockResolvedValue({ success: true, id: 'layout-1', shareId: 'abc12345' });
const mockAddProductToLayout = vi.fn().mockResolvedValue({ success: true, placementId: 'p-1', fits: true, dimensions: { width: 82, depth: 38, label: 'Full Futon Frame' } });
const mockSaveLayout = vi.fn().mockResolvedValue({ success: true });
const mockShareLayout = vi.fn().mockResolvedValue({ success: true, shareUrl: 'https://www.carolinafutons.com/room-planner?share=abc12345' });
const mockGetProductDimensions = vi.fn().mockResolvedValue({
  success: true,
  products: [
    { productType: 'futon-frame-full', label: 'Full Futon Frame', category: 'futon-frames', width: 82, depth: 38, depthBed: 54 },
  ],
});

vi.mock('backend/roomPlanner.web', () => ({
  getProductDimensions: mockGetProductDimensions,
  createRoomLayout: mockCreateRoomLayout,
  addProductToLayout: mockAddProductToLayout,
  saveLayout: mockSaveLayout,
  shareLayout: mockShareLayout,
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
  const actual = await vi.importActual('../../src/public/roomPlannerHelpers.js');
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
    await import('../../src/pages/Room Planner.js');
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('onReady tracks page_view event', async () => {
    const { trackEvent } = await import('public/engagementTracker');
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({ page: 'room-planner' }));
  });

  it('populates hero section', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const heading = getEl('#plannerHeroHeading');
    expect(heading.text.length).toBeGreaterThan(0);
  });

  it('sets up room presets repeater', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const repeater = getEl('#roomPresetsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThanOrEqual(3);
  });

  it('sets up product palette repeater', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const repeater = getEl('#productPaletteRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThanOrEqual(2);
  });

  it('sets up instructions steps repeater', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const repeater = getEl('#plannerStepsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThanOrEqual(3);
  });

  it('sets up room shape dropdown', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const dropdown = getEl('#roomShapeDropdown');
    expect(dropdown.options.length).toBeGreaterThanOrEqual(2);
  });

  it('initializes back-to-top', async () => {
    const { initBackToTop } = await import('public/mobileHelpers');
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalled();
  });

  it('sets aria labels on repeaters', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const presets = getEl('#roomPresetsRepeater');
    expect(presets.accessibility.ariaLabel).toBeTruthy();
  });

  // ── Room Dimension Inputs ──────────────────────────────────────────

  it('sets up room dimension inputs with onChange handlers', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const widthInput = getEl('#roomWidthInput');
    const lengthInput = getEl('#roomLengthInput');
    expect(widthInput.onChange).toHaveBeenCalled();
    expect(lengthInput.onChange).toHaveBeenCalled();
  });

  it('updates dimension display when inputs change', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const widthInput = getEl('#roomWidthInput');
    const lengthInput = getEl('#roomLengthInput');

    // Simulate dimension input change
    widthInput.value = '120';
    lengthInput.value = '144';
    const onChangeHandler = widthInput.onChange.mock.calls[0][0];
    await onChangeHandler();

    const dimDisplay = getEl('#roomDimensionDisplay');
    expect(dimDisplay.text).toMatch(/10.*12/); // 120in=10ft, 144in=12ft
  });

  // ── Preset Selection ──────────────────────────────────────────────

  it('registers onClick on preset repeater items', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();

    const repeater = getEl('#roomPresetsRepeater');
    const onItemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const $item = (sel) => getEl(`preset-item-${sel}`);
    const itemData = { name: 'Small Living Room', width: 120, length: 144, shape: 'rectangular', _id: 'preset-0' };
    onItemReadyFn($item, itemData);

    const presetBtn = getEl('preset-item-#presetName');
    expect(presetBtn.onClick).toHaveBeenCalled();
  });

  // ── Canvas / Planner Area ─────────────────────────────────────────

  it('sets up planner canvas HtmlComponent', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const canvas = getEl('#plannerCanvas');
    expect(canvas.postMessage).toBeDefined();
  });

  // ── Save Layout ───────────────────────────────────────────────────

  it('registers save button click handler', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const saveBtn = getEl('#saveLayoutBtn');
    expect(saveBtn.onClick).toHaveBeenCalled();
  });

  it('save button calls createRoomLayout with form values', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();

    getEl('#layoutNameInput').value = 'My Living Room';
    getEl('#roomWidthInput').value = '180';
    getEl('#roomLengthInput').value = '144';
    getEl('#roomShapeDropdown').value = 'rectangular';

    const saveHandler = getEl('#saveLayoutBtn').onClick.mock.calls[0][0];
    await saveHandler();

    expect(mockCreateRoomLayout).toHaveBeenCalledWith(expect.objectContaining({
      name: 'My Living Room',
      roomWidth: 180,
      roomLength: 144,
      roomShape: 'rectangular',
    }));
  });

  it('shows success message after save', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();

    getEl('#layoutNameInput').value = 'Test';
    getEl('#roomWidthInput').value = '120';
    getEl('#roomLengthInput').value = '120';

    const saveHandler = getEl('#saveLayoutBtn').onClick.mock.calls[0][0];
    await saveHandler();

    const statusText = getEl('#plannerStatusText');
    expect(statusText.text.toLowerCase()).toMatch(/saved|success/);
  });

  it('shows error message when save fails', async () => {
    mockCreateRoomLayout.mockResolvedValueOnce({ success: false, error: 'Layout name is required.' });
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();

    getEl('#layoutNameInput').value = '';
    getEl('#roomWidthInput').value = '120';
    getEl('#roomLengthInput').value = '120';

    const saveHandler = getEl('#saveLayoutBtn').onClick.mock.calls[0][0];
    await saveHandler();

    const statusText = getEl('#plannerStatusText');
    expect(statusText.text.toLowerCase()).toMatch(/error|fail|required/);
  });

  // ── Share Layout ──────────────────────────────────────────────────

  it('registers share button click handler', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const shareBtn = getEl('#shareLayoutBtn');
    expect(shareBtn.onClick).toHaveBeenCalled();
  });

  // ── Dimension Display ─────────────────────────────────────────────

  it('displays formatted dimensions using formatDimensions', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();

    getEl('#roomWidthInput').value = '168';
    getEl('#roomLengthInput').value = '192';
    const onChangeHandler = getEl('#roomWidthInput').onChange.mock.calls[0][0];
    await onChangeHandler();

    const dimDisplay = getEl('#roomDimensionDisplay');
    expect(dimDisplay.text).toMatch(/14.*16/); // 168in=14ft, 192in=16ft
  });

  // ── Accessibility ─────────────────────────────────────────────────

  it('sets aria labels on interactive elements', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();

    const widthInput = getEl('#roomWidthInput');
    const lengthInput = getEl('#roomLengthInput');
    expect(widthInput.accessibility.ariaLabel).toBeTruthy();
    expect(lengthInput.accessibility.ariaLabel).toBeTruthy();
  });

  it('sets aria label on save button', async () => {
    await import('../../src/pages/Room Planner.js');
    await onReadyHandler();
    const saveBtn = getEl('#saveLayoutBtn');
    expect(saveBtn.accessibility.ariaLabel).toBeTruthy();
  });
});
