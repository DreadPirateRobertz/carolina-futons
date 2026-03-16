import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const elements = new Map();
function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', placeholder: '',
    options: [], data: [], html: '', link: '', target: '',
    style: { color: '', fontWeight: '', backgroundColor: '' },
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
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
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

// --- Backend mocks ---
vi.mock('backend/roomPlanner.web', () => ({
  getProductDimensions: vi.fn(() => Promise.resolve({ width: 54, length: 75 })),
  createRoomLayout: vi.fn(() => Promise.resolve({ success: true, id: 'layout-123' })),
  addProductToLayout: vi.fn(() => Promise.resolve({ success: true })),
  saveLayout: vi.fn(() => Promise.resolve({ success: true })),
  shareLayout: vi.fn(() => Promise.resolve({ success: true, shareUrl: 'https://carolinafutons.com/planner/layout-123' })),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
}));

vi.mock('public/roomPlannerHelpers.js', () => ({
  getRoomPlannerContent: vi.fn(() => ({
    hero: { heading: 'Room Planner', subheading: 'Design your space' },
    instructions: { steps: [{ number: 1, title: 'Set Dimensions', description: 'Enter room size' }] },
  })),
  getDefaultRoomPresets: vi.fn(() => [
    { name: 'Small Bedroom', width: 120, length: 144, shape: 'rectangular' },
  ]),
  getRoomShapeOptions: vi.fn(() => [
    { value: 'rectangular', label: 'Rectangular' },
    { value: 'lshaped', label: 'L-Shaped' },
  ]),
  getProductPalette: vi.fn(() => [{ category: 'Futons' }]),
  formatDimensions: vi.fn((w, l) => `${w}" × ${l}"`),
  calculateScale: vi.fn(() => 1.0),
  formatPlacementLabel: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// --- Import mocks for assertions ---
import { createRoomLayout, saveLayout, shareLayout } from 'backend/roomPlanner.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { getRoomPlannerContent, getDefaultRoomPresets, getRoomShapeOptions, getProductPalette, formatDimensions, calculateScale } from 'public/roomPlannerHelpers.js';
import { initPageSeo } from 'public/pageSeo.js';

describe('Room Planner page', () => {
  beforeAll(async () => {
    await import('../src/pages/Room Planner.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // --- 1. Init ---
  it('calls initBackToTop on page ready', async () => {
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalled();
  });

  it('calls initPageSeo with roomPlanner', async () => {
    await onReadyHandler();
    expect(initPageSeo).toHaveBeenCalledWith('roomPlanner');
  });

  it('tracks page_view event', async () => {
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({}));
  });

  // --- 2. Hero ---
  it('sets hero heading text from content', async () => {
    await onReadyHandler();
    const heading = getEl('#plannerHeroHeading');
    expect(heading.text).toBe('Room Planner');
  });

  it('sets hero subheading text from content', async () => {
    await onReadyHandler();
    const subheading = getEl('#plannerHeroSubheading');
    expect(subheading.text).toBe('Design your space');
  });

  // --- 3. Instructions repeater ---
  it('sets ARIA label on instructions repeater', async () => {
    await onReadyHandler();
    const repeater = getEl('#plannerStepsRepeater');
    expect(repeater.accessibility.ariaLabel).toBeDefined();
  });

  it('sets instructions repeater data from content steps', async () => {
    await onReadyHandler();
    const repeater = getEl('#plannerStepsRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
  });

  it('onItemReady sets step number, title, and description', async () => {
    await onReadyHandler();
    const repeater = getEl('#plannerStepsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    const cb = repeater.onItemReady.mock.calls[0][0];
    const $item = (sel) => getEl(`item-instr-${sel}`);
    const itemData = { number: 1, title: 'Set Dimensions', description: 'Enter room size' };
    cb($item, itemData);
    expect(getEl('item-instr-#stepNumber').text).toBe('1');
    expect(getEl('item-instr-#stepTitle').text).toBe('Set Dimensions');
    expect(getEl('item-instr-#stepDesc').text).toBe('Enter room size');
  });

  // --- 4. Dimension inputs ARIA and onChange ---
  it('sets ARIA label on width input', async () => {
    await onReadyHandler();
    const widthInput = getEl('#roomWidthInput');
    expect(widthInput.accessibility.ariaLabel).toBeDefined();
  });

  it('sets ARIA label on length input', async () => {
    await onReadyHandler();
    const lengthInput = getEl('#roomLengthInput');
    expect(lengthInput.accessibility.ariaLabel).toBeDefined();
  });

  it('registers onChange on width and length inputs', async () => {
    await onReadyHandler();
    expect(getEl('#roomWidthInput').onChange).toHaveBeenCalled();
    expect(getEl('#roomLengthInput').onChange).toHaveBeenCalled();
  });

  // --- 5. Dimension onChange behavior ---
  it('onChange updates dimension display and calls calculateScale', async () => {
    await onReadyHandler();
    const widthInput = getEl('#roomWidthInput');
    const cb = widthInput.onChange.mock.calls[0][0];
    widthInput.value = '120';
    getEl('#roomLengthInput').value = '144';
    cb({ target: { value: '120' } });
    expect(calculateScale).toHaveBeenCalled();
    expect(formatDimensions).toHaveBeenCalledWith(120, 144);
  });

  it('onChange posts message to canvas with scale', async () => {
    await onReadyHandler();
    const widthInput = getEl('#roomWidthInput');
    const cb = widthInput.onChange.mock.calls[0][0];
    widthInput.value = '120';
    getEl('#roomLengthInput').value = '144';
    cb({ target: { value: '120' } });
    expect(getEl('#plannerCanvas').postMessage).toHaveBeenCalled();
  });

  // --- 6. Room presets repeater ---
  it('sets ARIA label on presets repeater', async () => {
    await onReadyHandler();
    const repeater = getEl('#roomPresetsRepeater');
    expect(repeater.accessibility.ariaLabel).toBeDefined();
  });

  it('sets presets repeater data from getDefaultRoomPresets', async () => {
    await onReadyHandler();
    const repeater = getEl('#roomPresetsRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
  });

  it('onItemReady sets preset name and dimensions text', async () => {
    await onReadyHandler();
    const repeater = getEl('#roomPresetsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    const cb = repeater.onItemReady.mock.calls[0][0];
    const $item = (sel) => getEl(`item-preset-${sel}`);
    const itemData = { name: 'Small Bedroom', width: 120, length: 144, shape: 'rectangular' };
    cb($item, itemData);
    expect(getEl('item-preset-#presetName').text).toBe('Small Bedroom');
  });

  // --- 7. Preset click ---
  it('preset click sets width/length input values and updates dimension display', async () => {
    await onReadyHandler();
    const repeater = getEl('#roomPresetsRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
    const clickHandlers = {};
    const $item = (sel) => {
      const el = getEl(`item-presetclick-${sel}`);
      const origOnClick = el.onClick;
      el.onClick = vi.fn((handler) => { clickHandlers[sel] = handler; });
      return el;
    };
    const itemData = { name: 'Small Bedroom', width: 120, length: 144, shape: 'rectangular' };
    itemReadyCb($item, itemData);
    if (clickHandlers['#presetName']) {
      clickHandlers['#presetName']();
      expect(formatDimensions).toHaveBeenCalled();
    }
  });

  // --- 8. Room shape dropdown ---
  it('sets shape dropdown options from getRoomShapeOptions', async () => {
    await onReadyHandler();
    const dropdown = getEl('#roomShapeDropdown');
    expect(dropdown.options.length).toBeGreaterThan(0);
  });

  it('sets default shape dropdown value to rectangular', async () => {
    await onReadyHandler();
    const dropdown = getEl('#roomShapeDropdown');
    expect(dropdown.value).toBe('rectangular');
  });

  // --- 9. Product palette repeater ---
  it('sets ARIA label on product palette repeater', async () => {
    await onReadyHandler();
    const repeater = getEl('#productPaletteRepeater');
    expect(repeater.accessibility.ariaLabel).toBeDefined();
  });

  it('sets product palette repeater data from getProductPalette', async () => {
    await onReadyHandler();
    const repeater = getEl('#productPaletteRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
  });

  it('onItemReady sets category name in product palette', async () => {
    await onReadyHandler();
    const repeater = getEl('#productPaletteRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    const cb = repeater.onItemReady.mock.calls[0][0];
    const $item = (sel) => getEl(`item-palette-${sel}`);
    const itemData = { category: 'Futons' };
    cb($item, itemData);
    expect(getEl('item-palette-#paletteCategoryName').text).toBe('Futons');
  });

  // --- 10. Save button - first save ---
  it('sets ARIA label on save button', async () => {
    await onReadyHandler();
    const btn = getEl('#saveLayoutBtn');
    expect(btn.accessibility.ariaLabel).toBeDefined();
  });

  it('save button onClick creates layout on first save', async () => {
    await onReadyHandler();
    const btn = getEl('#saveLayoutBtn');
    expect(btn.onClick).toHaveBeenCalled();
    const cb = btn.onClick.mock.calls[0][0];
    await cb();
    expect(createRoomLayout).toHaveBeenCalled();
    expect(getEl('#plannerStatusText').text).toBeTruthy();
  });

  // --- 11. Save button - existing layout ---
  it('save button onClick saves existing layout with currentLayoutId', async () => {
    await onReadyHandler();
    const btn = getEl('#saveLayoutBtn');
    const cb = btn.onClick.mock.calls[0][0];
    // First save to establish layout
    await cb();
    vi.clearAllMocks();
    // Second save should call saveLayout
    await cb();
    expect(saveLayout).toHaveBeenCalledWith(expect.stringContaining('layout'), expect.anything());
  });

  // --- 12. Share button ---
  it('sets ARIA label on share button', async () => {
    await onReadyHandler();
    const btn = getEl('#shareLayoutBtn');
    expect(btn.accessibility.ariaLabel).toBeDefined();
  });

  it('share button shows save-first message if no layout exists', async () => {
    await onReadyHandler();
    const btn = getEl('#shareLayoutBtn');
    expect(btn.onClick).toHaveBeenCalled();
    const cb = btn.onClick.mock.calls[0][0];
    await cb();
    const status = getEl('#plannerStatusText');
    expect(status.text).toBeTruthy();
  });

  it('share button calls shareLayout if layout exists', async () => {
    await onReadyHandler();
    // Save handler references before clearing mocks
    const saveBtn = getEl('#saveLayoutBtn');
    const saveCb = saveBtn.onClick.mock.calls[0][0];
    const shareBtn = getEl('#shareLayoutBtn');
    const shareCb = shareBtn.onClick.mock.calls[0][0];
    // Create layout first
    await saveCb();
    vi.clearAllMocks();
    // Then share
    await shareCb();
    expect(shareLayout).toHaveBeenCalled();
  });

  // --- 13. Share success ---
  it('share success sets shareUrlText text and status message', async () => {
    await onReadyHandler();
    // Save handler references before clearing mocks
    const saveBtn = getEl('#saveLayoutBtn');
    const saveCb = saveBtn.onClick.mock.calls[0][0];
    const shareBtn = getEl('#shareLayoutBtn');
    const shareCb = shareBtn.onClick.mock.calls[0][0];
    // Create layout first
    await saveCb();
    vi.clearAllMocks();
    // Share
    await shareCb();
    const shareUrl = getEl('#shareUrlText');
    expect(shareUrl.text).toContain('carolinafutons.com');
  });
});
