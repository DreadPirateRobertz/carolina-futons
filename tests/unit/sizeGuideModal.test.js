import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('public/a11yHelpers.js', () => ({
  setupAccessibleDialog: vi.fn(),
  announce: vi.fn(),
}));

vi.mock('public/ProductSizeGuide.js', () => ({
  initDimensionDisplay: vi.fn(),
  initRoomFitChecker: vi.fn(),
  initSizeComparisonTable: vi.fn(),
  initDimensionOverlay: vi.fn(),
  initDoorwayPresets: vi.fn(),
  initShippingDimensions: vi.fn(),
  initVisualSizeComparison: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
}));

import { initSizeGuideModal } from '../../src/public/SizeGuideModal.js';
import { setupAccessibleDialog, announce } from 'public/a11yHelpers.js';
import {
  initDimensionDisplay,
  initRoomFitChecker,
  initSizeComparisonTable,
  initDimensionOverlay,
  initDoorwayPresets,
  initShippingDimensions,
  initVisualSizeComparison,
} from 'public/ProductSizeGuide.js';

// ── Test Helpers ─────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    style: {},
    accessibility: {},
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
  };
}

function createMock$w() {
  const elements = {};
  const $w = vi.fn((selector) => {
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  });
  $w._elements = elements;
  return $w;
}

function createMockState() {
  return {
    product: { _id: 'prod-001', name: 'Test Futon' },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('initSizeGuideModal', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();

    // Default: setupAccessibleDialog returns open/close functions
    vi.mocked(setupAccessibleDialog).mockReturnValue({
      open: vi.fn(),
      close: vi.fn(),
    });
  });

  // ── Initialization ──────────────────────────────────────────────

  it('collapses the modal container on init', async () => {
    await initSizeGuideModal($w, state);
    expect($w('#sizeGuideModal').collapse).toHaveBeenCalled();
  });

  it('sets up accessible dialog with correct config', async () => {
    await initSizeGuideModal($w, state);

    expect(setupAccessibleDialog).toHaveBeenCalledWith($w, expect.objectContaining({
      panelId: '#sizeGuideModal',
      closeId: '#sizeGuideClose',
      titleId: '#sizeGuideTitle',
    }));
  });

  it('includes focusable IDs in dialog config', async () => {
    await initSizeGuideModal($w, state);

    const config = setupAccessibleDialog.mock.calls[0][1];
    expect(config.focusableIds).toContain('#sizeGuideClose');
    expect(config.focusableIds.length).toBeGreaterThanOrEqual(1);
  });

  it('wires sizeGuideBtn click to open the dialog', async () => {
    const mockOpen = vi.fn();
    setupAccessibleDialog.mockReturnValue({ open: mockOpen, close: vi.fn() });

    await initSizeGuideModal($w, state);

    // Simulate click
    const clickHandler = $w('#sizeGuideBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockOpen).toHaveBeenCalled();
  });

  // ── Lazy Loading ────────────────────────────────────────────────

  it('loads all 7 ProductSizeGuide init functions on first open', async () => {
    const mockOpen = vi.fn();
    setupAccessibleDialog.mockReturnValue({ open: mockOpen, close: vi.fn() });

    await initSizeGuideModal($w, state);

    // Trigger open
    const clickHandler = $w('#sizeGuideBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(initDimensionDisplay).toHaveBeenCalledWith($w, state);
    expect(initRoomFitChecker).toHaveBeenCalledWith($w, state);
    expect(initSizeComparisonTable).toHaveBeenCalledWith($w, state);
    expect(initDimensionOverlay).toHaveBeenCalledWith($w, state);
    expect(initDoorwayPresets).toHaveBeenCalledWith($w);
    expect(initShippingDimensions).toHaveBeenCalledWith($w, state);
    expect(initVisualSizeComparison).toHaveBeenCalledWith($w, state);
  });

  it('only initializes size guide components once across multiple opens', async () => {
    const mockOpen = vi.fn();
    setupAccessibleDialog.mockReturnValue({ open: mockOpen, close: vi.fn() });

    await initSizeGuideModal($w, state);

    const clickHandler = $w('#sizeGuideBtn').onClick.mock.calls[0][0];

    // Open twice
    await clickHandler();
    await clickHandler();

    // Each init function called exactly once
    expect(initDimensionDisplay).toHaveBeenCalledTimes(1);
    expect(initRoomFitChecker).toHaveBeenCalledTimes(1);
    expect(initSizeComparisonTable).toHaveBeenCalledTimes(1);
    expect(initDimensionOverlay).toHaveBeenCalledTimes(1);
    expect(initDoorwayPresets).toHaveBeenCalledTimes(1);
    expect(initShippingDimensions).toHaveBeenCalledTimes(1);
    expect(initVisualSizeComparison).toHaveBeenCalledTimes(1);
  });

  it('announces size guide opened on first open', async () => {
    const mockOpen = vi.fn();
    setupAccessibleDialog.mockReturnValue({ open: mockOpen, close: vi.fn() });

    await initSizeGuideModal($w, state);

    const clickHandler = $w('#sizeGuideBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('Size guide'));
  });

  // ── Error Handling ──────────────────────────────────────────────

  it('does not throw when sizeGuideBtn element is missing', async () => {
    const broken$w = vi.fn(() => { throw new Error('Element not found'); });
    await expect(initSizeGuideModal(broken$w, state)).resolves.not.toThrow();
  });

  it('does not throw when modal element is missing', async () => {
    const broken$w = vi.fn((sel) => {
      if (sel === '#sizeGuideModal') throw new Error('Not found');
      return createMockElement();
    });
    await expect(initSizeGuideModal(broken$w, state)).resolves.not.toThrow();
  });

  it('does not throw when a size guide init function fails', async () => {
    initDimensionDisplay.mockImplementation(() => { throw new Error('Init failed'); });
    const mockOpen = vi.fn();
    setupAccessibleDialog.mockReturnValue({ open: mockOpen, close: vi.fn() });

    await initSizeGuideModal($w, state);

    const clickHandler = $w('#sizeGuideBtn').onClick.mock.calls[0][0];
    // Should not throw even though initDimensionDisplay fails
    await expect(clickHandler()).resolves.not.toThrow();

    // Other init functions still called despite first one failing
    expect(initRoomFitChecker).toHaveBeenCalled();
  });

  it('still opens the dialog even when component init fails', async () => {
    initDimensionDisplay.mockImplementation(() => { throw new Error('Init failed'); });
    const mockOpen = vi.fn();
    setupAccessibleDialog.mockReturnValue({ open: mockOpen, close: vi.fn() });

    await initSizeGuideModal($w, state);

    const clickHandler = $w('#sizeGuideBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockOpen).toHaveBeenCalled();
  });

  // ── ARIA & Accessibility ────────────────────────────────────────

  it('sets ARIA label on the trigger button', async () => {
    await initSizeGuideModal($w, state);

    expect($w('#sizeGuideBtn').accessibility.ariaLabel).toBe('Open size guide');
  });

  it('sets dialog role on modal container', async () => {
    await initSizeGuideModal($w, state);

    expect($w('#sizeGuideModal').accessibility.role).toBe('dialog');
  });

  it('sets aria-modal on the modal container', async () => {
    await initSizeGuideModal($w, state);

    expect($w('#sizeGuideModal').accessibility.ariaModal).toBe(true);
  });

  // ── Close Callback ─────────────────────────────────────────────

  it('provides onClose callback in dialog config', async () => {
    await initSizeGuideModal($w, state);

    const config = setupAccessibleDialog.mock.calls[0][1];
    expect(typeof config.onClose).toBe('function');
  });

  it('announces size guide closed via onClose callback', async () => {
    await initSizeGuideModal($w, state);

    const config = setupAccessibleDialog.mock.calls[0][1];
    config.onClose();

    expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('closed'));
  });

  // ── No Product State ───────────────────────────────────────────

  it('collapses modal and skips button wiring when no product in state', async () => {
    await initSizeGuideModal($w, { product: null });

    expect($w('#sizeGuideModal').collapse).toHaveBeenCalled();
    // Button should not have onClick wired (or modal should stay hidden)
    expect($w('#sizeGuideBtn').hide).toHaveBeenCalled();
  });

  it('hides trigger button when product has no ID', async () => {
    await initSizeGuideModal($w, { product: {} });

    expect($w('#sizeGuideBtn').hide).toHaveBeenCalled();
  });
});
