/**
 * Tests for ProductInfoModal.js
 *
 * Covers: initProductInfoModal, care guide rendering, dimensions rendering,
 * room fit calculator (fits/tight/too-big/invalid), element nicknames,
 * accessibility setup, and missing-data fallbacks.
 *
 * See CF-b2x2 for original specification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('public/a11yHelpers.js', () => ({
  setupAccessibleDialog: vi.fn(),
  announce: vi.fn(),
}));

vi.mock('backend/catalogContent.web.js', () => ({
  getProductSpecs: vi.fn(),
}));

import { initProductInfoModal } from '../src/public/ProductInfoModal.js';
import { setupAccessibleDialog, announce } from 'public/a11yHelpers.js';
import { getProductSpecs } from 'backend/catalogContent.web.js';

// ── Test Helpers ──────────────────────────────────────────────────────

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

function createMockState(overrides = {}) {
  return {
    product: { slug: 'test-futon', _id: 'prod-001', name: 'Test Futon', ...overrides.product },
    ...overrides,
  };
}

const FULL_SPECS = {
  slug: 'test-futon',
  careGuide: 'Spot clean with mild soap. Do not machine wash.',
  dimensions: { width: 54, depth: 32, height: 36, weight: 85 },
  materials: 'Solid hardwood',
  warranty: '1 year',
};

function mockSpecsSuccess(specs = FULL_SPECS) {
  getProductSpecs.mockResolvedValue({ success: true, data: specs });
}

function mockSpecsNotFound() {
  getProductSpecs.mockResolvedValue({ success: true, data: null });
}

function mockSpecsError() {
  getProductSpecs.mockRejectedValue(new Error('CMS unavailable'));
}

// ── initProductInfoModal — setup ──────────────────────────────────────

describe('initProductInfoModal — setup', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    setupAccessibleDialog.mockReturnValue({ open: vi.fn(), close: vi.fn() });
    mockSpecsSuccess();
  });

  it('collapses dimensionsModal on init', async () => {
    await initProductInfoModal($w, state);
    expect($w('#dimensionsModal').collapse).toHaveBeenCalled();
  });

  it('hides careGuideBtn when no product slug in state', async () => {
    await initProductInfoModal($w, { product: {} });
    expect($w('#careGuideBtn').hide).toHaveBeenCalled();
  });

  it('does not hide careGuideBtn when product slug is present', async () => {
    await initProductInfoModal($w, state);
    expect($w('#careGuideBtn').hide).not.toHaveBeenCalled();
  });

  it('sets ARIA label on careGuideBtn', async () => {
    await initProductInfoModal($w, state);
    expect($w('#careGuideBtn').accessibility.ariaLabel).toBe('Open care guide and dimensions');
  });

  it('sets ARIA role dialog on dimensionsModal', async () => {
    await initProductInfoModal($w, state);
    expect($w('#dimensionsModal').accessibility.role).toBe('dialog');
  });

  it('sets ariaModal true on dimensionsModal', async () => {
    await initProductInfoModal($w, state);
    expect($w('#dimensionsModal').accessibility.ariaModal).toBe(true);
  });

  it('calls setupAccessibleDialog with correct element IDs', async () => {
    await initProductInfoModal($w, state);
    expect(setupAccessibleDialog).toHaveBeenCalledWith(
      $w,
      expect.objectContaining({
        panelId: '#dimensionsModal',
        closeId: '#dimensionsModalClose',
        titleId: '#dimensionsModalTitle',
      })
    );
  });

  it('focusableIds includes roomWidthInput, roomLengthInput, checkRoomFitBtn', async () => {
    await initProductInfoModal($w, state);
    const config = setupAccessibleDialog.mock.calls[0][1];
    expect(config.focusableIds).toContain('#roomWidthInput');
    expect(config.focusableIds).toContain('#roomLengthInput');
    expect(config.focusableIds).toContain('#checkRoomFitBtn');
  });

  it('registers onClick on careGuideBtn', async () => {
    await initProductInfoModal($w, state);
    expect($w('#careGuideBtn').onClick).toHaveBeenCalled();
  });

  it('does not call getProductSpecs until careGuideBtn is clicked', async () => {
    await initProductInfoModal($w, state);
    expect(getProductSpecs).not.toHaveBeenCalled();
  });

  it('announces "Care guide closed" when onClose callback is invoked', async () => {
    await initProductInfoModal($w, state);
    const config = setupAccessibleDialog.mock.calls[0][1];
    config.onClose();
    expect(announce).toHaveBeenCalledWith($w, 'Care guide closed');
  });

  it('hides careGuideBtn when state is null', async () => {
    await initProductInfoModal($w, null);
    expect($w('#careGuideBtn').hide).toHaveBeenCalled();
  });

  it('hides careGuideBtn when state is undefined', async () => {
    await initProductInfoModal($w, undefined);
    expect($w('#careGuideBtn').hide).toHaveBeenCalled();
  });
});

// ── careGuideBtn click — lazy load ────────────────────────────────────

describe('careGuideBtn click — lazy load', () => {
  let $w, state, mockDialog;

  beforeEach(async () => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
    mockSpecsSuccess();
    await initProductInfoModal($w, state);
  });

  async function clickCareGuideBtn() {
    const [handler] = $w('#careGuideBtn').onClick.mock.calls[0];
    await handler();
  }

  it('calls getProductSpecs with product slug on first click', async () => {
    await clickCareGuideBtn();
    expect(getProductSpecs).toHaveBeenCalledWith('test-futon');
  });

  it('opens the dialog on click', async () => {
    await clickCareGuideBtn();
    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('announces dialog opened', async () => {
    await clickCareGuideBtn();
    expect(announce).toHaveBeenCalledWith($w, 'Care guide opened');
  });

  it('only calls getProductSpecs once even when clicked multiple times', async () => {
    await clickCareGuideBtn();
    await clickCareGuideBtn();
    expect(getProductSpecs).toHaveBeenCalledTimes(1);
  });

  it('populates careGuideText with care instructions', async () => {
    await clickCareGuideBtn();
    expect($w('#careGuideText').text).toBe('Spot clean with mild soap. Do not machine wash.');
  });

  it('populates dimensionsText with width, depth, height, weight', async () => {
    await clickCareGuideBtn();
    const text = $w('#dimensionsText').text;
    expect(text).toContain('54');
    expect(text).toContain('32');
    expect(text).toContain('36');
    expect(text).toContain('85');
  });
});

// ── care guide rendering ──────────────────────────────────────────────

describe('care guide rendering', () => {
  let $w, state, mockDialog;

  beforeEach(async () => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
  });

  async function init(specs) {
    getProductSpecs.mockResolvedValue({ success: true, data: specs });
    await initProductInfoModal($w, state);
    const [handler] = $w('#careGuideBtn').onClick.mock.calls[0];
    await handler();
  }

  it('shows fallback text when careGuide is null', async () => {
    await init({ ...FULL_SPECS, careGuide: null });
    expect($w('#careGuideText').text).toContain('not available');
  });

  it('shows fallback text when specs are null (product not found)', async () => {
    getProductSpecs.mockResolvedValue({ success: true, data: null });
    await initProductInfoModal($w, state);
    const [handler] = $w('#careGuideBtn').onClick.mock.calls[0];
    await handler();
    expect($w('#careGuideText').text).toContain('not available');
  });

  it('shows fallback text when getProductSpecs throws', async () => {
    mockSpecsError();
    await initProductInfoModal($w, state);
    const [handler] = $w('#careGuideBtn').onClick.mock.calls[0];
    await handler();
    expect($w('#careGuideText').text).toContain('not available');
  });

  it('shows fallback text when getProductSpecs returns success: false', async () => {
    getProductSpecs.mockResolvedValue({ success: false, error: 'Product specs unavailable' });
    await initProductInfoModal($w, state);
    const [handler] = $w('#careGuideBtn').onClick.mock.calls[0];
    await handler();
    expect($w('#careGuideText').text).toContain('not available');
  });
});

// ── dimensions rendering ──────────────────────────────────────────────

describe('dimensions rendering', () => {
  let $w, state, mockDialog;

  beforeEach(async () => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
  });

  async function init(specs) {
    getProductSpecs.mockResolvedValue({ success: true, data: specs });
    await initProductInfoModal($w, state);
    const [handler] = $w('#careGuideBtn').onClick.mock.calls[0];
    await handler();
  }

  it('shows width label', async () => {
    await init(FULL_SPECS);
    expect($w('#dimensionsText').text).toContain('Width');
  });

  it('shows depth label', async () => {
    await init(FULL_SPECS);
    expect($w('#dimensionsText').text).toContain('Depth');
  });

  it('shows height label', async () => {
    await init(FULL_SPECS);
    expect($w('#dimensionsText').text).toContain('Height');
  });

  it('shows weight label', async () => {
    await init(FULL_SPECS);
    expect($w('#dimensionsText').text).toContain('Weight');
  });

  it('shows fallback text when dimensions is null', async () => {
    await init({ ...FULL_SPECS, dimensions: null });
    expect($w('#dimensionsText').text).toContain('not available');
  });

  it('shows fallback text when all dimension fields are null (empty dims object)', async () => {
    await init({ ...FULL_SPECS, dimensions: { width: null, depth: null, height: null, weight: null } });
    expect($w('#dimensionsText').text).toContain('not available');
  });
});

// ── room fit calculator ───────────────────────────────────────────────

describe('room fit calculator', () => {
  let $w, state, mockDialog;

  beforeEach(async () => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
    mockSpecsSuccess();
    await initProductInfoModal($w, state);
    // Click care guide to trigger lazy-load; specs must be loaded before checkRoomFitBtn handler reads them.
    const [clickHandler] = $w('#careGuideBtn').onClick.mock.calls[0];
    await clickHandler();
  });

  function triggerFitCheck(roomWidth, roomLength) {
    $w('#roomWidthInput').value = String(roomWidth);
    $w('#roomLengthInput').value = String(roomLength);
    const [handler] = $w('#checkRoomFitBtn').onClick.mock.calls[0];
    handler();
  }

  // Product is 54" wide × 32" deep

  it('shows "fits" result when room is comfortably larger than product', () => {
    triggerFitCheck(72, 60); // 18" width clearance, 28" depth clearance
    expect($w('#fitResult').text).toContain('fits');
  });

  it('shows "tight" result when clearance is less than 2 inches', () => {
    triggerFitCheck(55, 33); // 1" width clearance, 1" depth clearance
    expect($w('#fitResult').text).toContain('Tight');
  });

  it('shows "too big" result when product wider than room', () => {
    triggerFitCheck(40, 60); // 40" room width < 54" product width
    expect($w('#fitResult').text).toContain('won\'t fit');
  });

  it('shows "too big" result when product deeper than room', () => {
    triggerFitCheck(72, 20); // 20" room length < 32" product depth
    expect($w('#fitResult').text).toContain('won\'t fit');
  });

  it('shows invalid input message for non-numeric input', () => {
    $w('#roomWidthInput').value = 'abc';
    $w('#roomLengthInput').value = '60';
    const [handler] = $w('#checkRoomFitBtn').onClick.mock.calls[0];
    handler();
    expect($w('#fitResult').text).toContain('valid');
  });

  it('shows invalid input message for zero dimensions', () => {
    triggerFitCheck(0, 60);
    expect($w('#fitResult').text).toContain('valid');
  });

  it('shows invalid input message for dimensions over 600 inches', () => {
    triggerFitCheck(700, 60);
    expect($w('#fitResult').text).toContain('valid');
  });

  it('shows unknown message when product dimensions are unavailable', async () => {
    vi.clearAllMocks();
    $w = createMock$w();
    setupAccessibleDialog.mockReturnValue(mockDialog);
    getProductSpecs.mockResolvedValue({ success: true, data: { ...FULL_SPECS, dimensions: null } });
    await initProductInfoModal($w, state);
    const [clickHandler] = $w('#careGuideBtn').onClick.mock.calls[0];
    await clickHandler();
    triggerFitCheck(72, 60);
    expect($w('#fitResult').text).toContain('not available');
  });

  it('makes fitResult visible after check', () => {
    triggerFitCheck(72, 60);
    expect($w('#fitResult').show).toHaveBeenCalled();
  });

  it('sets ariaLive polite on fitResult at init time (before any fit check)', () => {
    // ariaLive must be set at init so screen readers catch the first announcement
    expect($w('#fitResult').accessibility.ariaLive).toBe('polite');
  });

  it('shows invalid input message for negative room width', () => {
    triggerFitCheck(-10, 60);
    expect($w('#fitResult').text).toContain('valid');
  });

  it('shows "tight" result when clearance is exactly zero (product exactly fills room)', () => {
    triggerFitCheck(54, 32); // 0" clearance on both sides — tight, not too-big
    expect($w('#fitResult').text).toContain('Tight');
  });

  it('shows "fits" result when clearance is exactly CLEARANCE_GOOD (2 inches)', () => {
    triggerFitCheck(56, 34); // exactly 2" clearance on both sides
    expect($w('#fitResult').text).toContain('fits');
  });

  it('shows "tight" result when clearance is 1 inch (one below CLEARANCE_GOOD threshold)', () => {
    triggerFitCheck(55, 33); // 1" width clearance, 1" depth clearance
    expect($w('#fitResult').text).toContain('Tight');
  });

  it('shows "not available" when checkRoomFitBtn clicked before lazy-load (specs = null)', async () => {
    // Wire a fresh modal without triggering lazy-load (careGuideBtn never clicked)
    vi.clearAllMocks();
    const freshW = createMock$w();
    setupAccessibleDialog.mockReturnValue(mockDialog);
    mockSpecsSuccess();
    await initProductInfoModal(freshW, createMockState());
    // Invoke checkRoomFitBtn directly — specs are still null
    freshW('#roomWidthInput').value = '72';
    freshW('#roomLengthInput').value = '60';
    const [handler] = freshW('#checkRoomFitBtn').onClick.mock.calls[0];
    handler();
    expect(freshW('#fitResult').text).toContain('not available');
  });
});

// ── element nicknames ─────────────────────────────────────────────────

describe('element nicknames — all required IDs are addressed', () => {
  let $w, state;

  beforeEach(async () => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    setupAccessibleDialog.mockReturnValue({ open: vi.fn(), close: vi.fn() });
    mockSpecsSuccess();
    await initProductInfoModal($w, state);
    const [handler] = $w('#careGuideBtn').onClick.mock.calls[0];
    await handler();
  });

  it('addresses #careGuideBtn', () => {
    expect($w).toHaveBeenCalledWith('#careGuideBtn');
  });

  it('addresses #dimensionsModal', () => {
    expect($w).toHaveBeenCalledWith('#dimensionsModal');
  });

  it('addresses #roomWidthInput via focusableIds or checkRoomFitBtn wiring', async () => {
    const config = setupAccessibleDialog.mock.calls[0][1];
    expect(config.focusableIds).toContain('#roomWidthInput');
  });

  it('addresses #roomLengthInput via focusableIds', async () => {
    const config = setupAccessibleDialog.mock.calls[0][1];
    expect(config.focusableIds).toContain('#roomLengthInput');
  });

  it('addresses #fitResult after fit check', () => {
    $w('#roomWidthInput').value = '72';
    $w('#roomLengthInput').value = '60';
    const [handler] = $w('#checkRoomFitBtn').onClick.mock.calls[0];
    handler();
    expect($w).toHaveBeenCalledWith('#fitResult');
  });
});
