import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock backend module
const mockGetProductDimensions = vi.fn();
const mockCheckRoomFit = vi.fn();
const mockGetComparisonTable = vi.fn();

vi.mock('backend/sizeGuide.web', () => ({
  getProductDimensions: mockGetProductDimensions,
  checkRoomFit: mockCheckRoomFit,
  getComparisonTable: mockGetComparisonTable,
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
  setupAccessibleDialog: vi.fn(),
}));

vi.mock('public/validators.js', () => ({
  validateDimension: vi.fn((val, min, max) => typeof val === 'number' && isFinite(val) && val >= min && val <= max),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
}));

import {
  initDimensionDisplay,
  initRoomFitChecker,
  initSizeComparisonTable,
} from '../src/public/ProductSizeGuide.js';

import { announce } from 'public/a11yHelpers.js';
import { isMobile } from 'public/mobileHelpers';

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    style: {},
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    data: [],
    options: [],
    accessibility: { ariaLabel: '', ariaLive: '' },
  };
}

function createMock$w(overrides = {}) {
  const elements = {};

  const $w = (selector) => {
    if (overrides[selector] === null) return null;
    if (!elements[selector]) elements[selector] = createMockElement();
    if (overrides[selector]) Object.assign(elements[selector], overrides[selector]);
    return elements[selector];
  };

  $w._elements = elements;
  return $w;
}

// ── Fixtures ──────────────────────────────────────────────────────────

const mockDimensionsInches = {
  unit: 'in',
  closed: { width: 54, depth: 38, height: 33 },
  open: { width: 54, depth: 75, height: 18 },
  weight: 85,
  seatHeight: 18,
  mattressSize: 'Full',
};

const mockDimensionsCm = {
  unit: 'cm',
  closed: { width: 137.2, depth: 96.5, height: 83.8 },
  open: { width: 137.2, depth: 190.5, height: 45.7 },
  weight: 85,
  seatHeight: 45.7,
  mattressSize: 'Full',
};

const mockComparisonData = {
  success: true,
  category: 'futon-frames',
  unit: 'in',
  products: [
    {
      productId: 'prod-001',
      name: 'Eureka Frame',
      slug: 'eureka-frame',
      isCurrent: true,
      closed: { width: 54, depth: 38, height: 33 },
      open: { width: 54, depth: 75, height: 18 },
      weight: 85,
      mattressSize: 'Full',
    },
    {
      productId: 'prod-002',
      name: 'Monterey Frame',
      slug: 'monterey-frame',
      isCurrent: false,
      closed: { width: 60, depth: 40, height: 35 },
      open: { width: 60, depth: 80, height: 20 },
      weight: 95,
      mattressSize: 'Queen',
    },
  ],
};

// ── initDimensionDisplay ──────────────────────────────────────────────

describe('initDimensionDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when state has no product', async () => {
    const $w = createMock$w();
    await initDimensionDisplay($w, {});
    expect(mockGetProductDimensions).not.toHaveBeenCalled();
  });

  it('shows placeholder when product has no dimensions', async () => {
    mockGetProductDimensions.mockResolvedValue(null);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    expect($w('#dimensionSection').expand).toHaveBeenCalled();
    expect($w('#dimensionPlaceholder').text).toBe('Dimensions coming soon');
    expect($w('#dimensionPlaceholder').show).toHaveBeenCalled();
    expect($w('#dimensionGrid').hide).toHaveBeenCalled();
  });

  it('renders dimension grid for valid product', async () => {
    mockGetProductDimensions.mockResolvedValue(mockDimensionsInches);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    expect($w('#dimensionSection').expand).toHaveBeenCalled();
    expect($w('#dimensionPlaceholder').hide).toHaveBeenCalled();
    expect($w('#dimensionGrid').show).toHaveBeenCalled();
    expect($w('#closedDimsLabel').text).toBe('Closed (Sofa Position)');
    expect($w('#closedDims').text).toContain('54"');
    expect($w('#closedDims').text).toContain('38"');
    expect($w('#closedDims').text).toContain('33"');
    expect($w('#openDimsLabel').text).toBe('Open (Bed Position)');
    expect($w('#openDims').text).toContain('75"');
  });

  it('displays weight when available', async () => {
    mockGetProductDimensions.mockResolvedValue(mockDimensionsInches);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    expect($w('#productWeight').text).toBe('Weight: 85 lbs');
  });

  it('displays mattress size when available', async () => {
    mockGetProductDimensions.mockResolvedValue(mockDimensionsInches);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    expect($w('#mattressSize').text).toBe('Mattress Size: Full');
  });

  it('skips weight display when not available', async () => {
    mockGetProductDimensions.mockResolvedValue({ ...mockDimensionsInches, weight: null });
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    // Weight element should not be set (stays at default empty)
    expect($w._elements['#productWeight']).toBeUndefined();
  });

  it('skips mattress size display when not available', async () => {
    mockGetProductDimensions.mockResolvedValue({ ...mockDimensionsInches, mattressSize: null });
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    expect($w._elements['#mattressSize']).toBeUndefined();
  });

  it('sets up unit toggle with inches/centimeters options', async () => {
    mockGetProductDimensions.mockResolvedValue(mockDimensionsInches);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    const toggle = $w('#unitToggle');
    expect(toggle.options).toEqual([
      { label: 'Inches', value: 'in' },
      { label: 'Centimeters', value: 'cm' },
    ]);
    expect(toggle.value).toBe('in');
    expect(toggle.onChange).toHaveBeenCalled();
  });

  it('sets aria-label on unit toggle', async () => {
    mockGetProductDimensions.mockResolvedValue(mockDimensionsInches);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    expect($w('#unitToggle').accessibility.ariaLabel).toBe('Switch dimension units');
  });

  it('stores dimensions on state object', async () => {
    mockGetProductDimensions.mockResolvedValue(mockDimensionsInches);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    expect(state.dimensions).toEqual(mockDimensionsInches);
  });

  it('shows error placeholder when backend throws', async () => {
    mockGetProductDimensions.mockRejectedValue(new Error('Network error'));
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    expect($w('#dimensionSection').expand).toHaveBeenCalled();
    expect($w('#dimensionPlaceholder').text).toBe('Dimensions temporarily unavailable');
    expect($w('#dimensionPlaceholder').show).toHaveBeenCalled();
    expect($w('#dimensionGrid').hide).toHaveBeenCalled();
  });

  it('renders centimeter units with cm suffix', async () => {
    mockGetProductDimensions.mockResolvedValue(mockDimensionsCm);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    expect($w('#closedDims').text).toContain('cm');
    expect($w('#closedDims').text).not.toContain('"');
  });

  it('displays seat height when available', async () => {
    mockGetProductDimensions.mockResolvedValue(mockDimensionsInches);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    expect($w('#seatHeight').text).toBe('Seat Height: 18"');
  });
});

// ── initRoomFitChecker ────────────────────────────────────────────────

describe('initRoomFitChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when state has no product', async () => {
    const $w = createMock$w();
    await initRoomFitChecker($w, {});
    expect($w._elements['#roomFitTitle']).toBeUndefined();
  });

  it('sets title text', async () => {
    const $w = createMock$w();
    await initRoomFitChecker($w, { product: { _id: 'prod-001' } });
    expect($w('#roomFitTitle').text).toBe('Will It Fit?');
  });

  it('sets ARIA labels on all input fields', async () => {
    const $w = createMock$w();
    await initRoomFitChecker($w, { product: { _id: 'prod-001' } });

    expect($w('#doorwayWidth').accessibility.ariaLabel).toBe('Doorway width in inches');
    expect($w('#doorwayHeight').accessibility.ariaLabel).toBe('Doorway height in inches');
    expect($w('#hallwayWidth').accessibility.ariaLabel).toBe('Hallway width in inches');
    expect($w('#roomWidth').accessibility.ariaLabel).toBe('Room width in inches');
    expect($w('#roomDepth').accessibility.ariaLabel).toBe('Room depth in inches');
  });

  it('sets ARIA label on check fit button', async () => {
    const $w = createMock$w();
    await initRoomFitChecker($w, { product: { _id: 'prod-001' } });
    expect($w('#checkFitBtn').accessibility.ariaLabel).toBe('Check if product fits your space');
  });

  it('registers click handler on check fit button', async () => {
    const $w = createMock$w();
    await initRoomFitChecker($w, { product: { _id: 'prod-001' } });
    expect($w('#checkFitBtn').onClick).toHaveBeenCalled();
  });

  it('shows validation message when no valid inputs provided', async () => {
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };
    await initRoomFitChecker($w, state);

    // Simulate clicking with empty inputs (all default empty string values)
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#fitResultText').text).toContain('Please enter valid dimensions');
    expect($w('#fitResultSection').show).toHaveBeenCalled();
  });

  it('disables button during check and re-enables after', async () => {
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };
    await initRoomFitChecker($w, state);

    const btn = $w('#checkFitBtn');
    const clickHandler = btn.onClick.mock.calls[0][0];
    await clickHandler();

    expect(btn.disable).toHaveBeenCalled();
    expect(btn.enable).toHaveBeenCalled();
    expect(btn.label).toBe('Check Fit');
  });

  it('calls checkRoomFit with valid doorway dimensions', async () => {
    mockCheckRoomFit.mockResolvedValue({
      success: true,
      allFit: true,
      anyTight: false,
      checks: [{ check: 'doorway', fits: true, tight: false, clearance: 10 }],
    });

    const $w = createMock$w();
    $w('#doorwayWidth').value = '36';
    $w('#doorwayHeight').value = '80';
    const state = { product: { _id: 'prod-001' } };

    await initRoomFitChecker($w, state);
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockCheckRoomFit).toHaveBeenCalledWith('prod-001', expect.objectContaining({
      doorwayWidth: 36,
      doorwayHeight: 80,
    }));
  });

  it('displays all-fit result with success message', async () => {
    mockCheckRoomFit.mockResolvedValue({
      success: true,
      allFit: true,
      anyTight: false,
      checks: [
        { check: 'doorway', fits: true, tight: false, clearance: 10 },
        { check: 'room', fits: true, tight: false, clearance: 20 },
      ],
    });

    const $w = createMock$w();
    $w('#doorwayWidth').value = '36';
    $w('#doorwayHeight').value = '80';
    $w('#roomWidth').value = '144';
    $w('#roomDepth').value = '120';
    const state = { product: { _id: 'prod-001' } };

    await initRoomFitChecker($w, state);
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#fitResultText').text).toContain('Great news');
    expect($w('#fitResultText').text).toContain('Doorway');
    expect($w('#fitResultSection').show).toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('Great news'));
  });

  it('displays tight-fit warning', async () => {
    mockCheckRoomFit.mockResolvedValue({
      success: true,
      allFit: true,
      anyTight: true,
      checks: [{ check: 'doorway', fits: true, tight: true, clearance: 1 }],
    });

    const $w = createMock$w();
    $w('#doorwayWidth').value = '36';
    $w('#doorwayHeight').value = '80';
    const state = { product: { _id: 'prod-001' } };

    await initRoomFitChecker($w, state);
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#fitResultText').text).toContain('tight');
    expect($w('#fitResultText').text).toContain('Tight fit');
  });

  it('displays does-not-fit result', async () => {
    mockCheckRoomFit.mockResolvedValue({
      success: true,
      allFit: false,
      anyTight: false,
      checks: [{ check: 'doorway', fits: false, tight: false, clearance: -2 }],
    });

    const $w = createMock$w();
    $w('#doorwayWidth').value = '28';
    $w('#doorwayHeight').value = '75';
    const state = { product: { _id: 'prod-001' } };

    await initRoomFitChecker($w, state);
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#fitResultText').text).toContain('may not fit');
    expect($w('#fitResultText').text).toContain('Will not fit');
  });

  it('displays error when backend returns failure', async () => {
    mockCheckRoomFit.mockResolvedValue({
      success: false,
      error: 'No dimension data found',
    });

    const $w = createMock$w();
    $w('#doorwayWidth').value = '36';
    $w('#doorwayHeight').value = '80';
    const state = { product: { _id: 'prod-001' } };

    await initRoomFitChecker($w, state);
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#fitResultText').text).toContain('No dimension data found');
  });

  it('sets aria-live on fit result section', async () => {
    mockCheckRoomFit.mockResolvedValue({
      success: true,
      allFit: true,
      anyTight: false,
      checks: [{ check: 'doorway', fits: true, tight: false, clearance: 10 }],
    });

    const $w = createMock$w();
    $w('#doorwayWidth').value = '36';
    $w('#doorwayHeight').value = '80';
    const state = { product: { _id: 'prod-001' } };

    await initRoomFitChecker($w, state);
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#fitResultSection').accessibility.ariaLive).toBe('polite');
  });

  it('accepts hallway-only input', async () => {
    mockCheckRoomFit.mockResolvedValue({
      success: true,
      allFit: true,
      anyTight: false,
      checks: [{ check: 'hallway', fits: true, tight: false, clearance: 10 }],
    });

    const $w = createMock$w();
    $w('#hallwayWidth').value = '48';
    const state = { product: { _id: 'prod-001' } };

    await initRoomFitChecker($w, state);
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockCheckRoomFit).toHaveBeenCalledWith('prod-001', expect.objectContaining({
      hallwayWidth: 48,
    }));
  });

  it('accepts room-only input', async () => {
    mockCheckRoomFit.mockResolvedValue({
      success: true,
      allFit: true,
      anyTight: false,
      checks: [{ check: 'room', fits: true, tight: false, clearance: 30 }],
    });

    const $w = createMock$w();
    $w('#roomWidth').value = '150';
    $w('#roomDepth').value = '120';
    const state = { product: { _id: 'prod-001' } };

    await initRoomFitChecker($w, state);
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockCheckRoomFit).toHaveBeenCalledWith('prod-001', expect.objectContaining({
      roomWidth: 150,
      roomDepth: 120,
    }));
  });

  it('rejects out-of-range doorway values', async () => {
    const $w = createMock$w();
    $w('#doorwayWidth').value = '200'; // Max 120
    $w('#doorwayHeight').value = '80';
    const state = { product: { _id: 'prod-001' } };

    await initRoomFitChecker($w, state);
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    // Should show validation message since doorway exceeds max
    expect($w('#fitResultText').text).toContain('Please enter valid dimensions');
  });
});

// ── initSizeComparisonTable ───────────────────────────────────────────

describe('initSizeComparisonTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMobile.mockReturnValue(false);
  });

  it('returns early when state has no product', async () => {
    const $w = createMock$w();
    await initSizeComparisonTable($w, {});
    expect(mockGetComparisonTable).not.toHaveBeenCalled();
  });

  it('collapses section when comparison fails', async () => {
    mockGetComparisonTable.mockResolvedValue({ success: false, error: 'No data' });
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    expect($w('#sizeCompareSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when fewer than 2 products', async () => {
    mockGetComparisonTable.mockResolvedValue({
      success: true,
      products: [{ productId: 'prod-001', name: 'Test', isCurrent: true }],
    });
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    expect($w('#sizeCompareSection').collapse).toHaveBeenCalled();
  });

  it('expands section and renders table for valid data', async () => {
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    expect($w('#sizeCompareSection').expand).toHaveBeenCalled();
    expect($w('#sizeCompareTitle').text).toBe('Compare Sizes');
    expect($w('#sizeCompareRepeater').onItemReady).toHaveBeenCalled();
    expect($w('#sizeCompareRepeater').data.length).toBe(2);
  });

  it('sets aria-label on comparison title', async () => {
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    expect($w('#sizeCompareTitle').accessibility.ariaLabel).toBe('Size comparison table for similar products');
  });

  it('bolds current product name in repeater', async () => {
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    // Simulate repeater item render for current product
    const onItemReady = $w('#sizeCompareRepeater').onItemReady.mock.calls[0][0];
    const $item = createMock$w();
    onItemReady($item, mockComparisonData.products[0]); // isCurrent: true

    expect($item('#compareProductName').text).toBe('Eureka Frame');
    expect($item('#compareProductName').style.fontWeight).toBe('bold');
    expect($item('#compareCurrentBadge').show).toHaveBeenCalled();
  });

  it('hides badge for non-current products', async () => {
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    const onItemReady = $w('#sizeCompareRepeater').onItemReady.mock.calls[0][0];
    const $item = createMock$w();
    onItemReady($item, mockComparisonData.products[1]); // isCurrent: false

    expect($item('#compareCurrentBadge').hide).toHaveBeenCalled();
  });

  it('renders closed dimensions with inch units', async () => {
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    const onItemReady = $w('#sizeCompareRepeater').onItemReady.mock.calls[0][0];
    const $item = createMock$w();
    onItemReady($item, mockComparisonData.products[0]);

    expect($item('#compareClosedDims').text).toContain('54"');
    expect($item('#compareClosedDims').text).toContain('38"');
    expect($item('#compareClosedDims').text).toContain('33"');
  });

  it('renders open dimensions', async () => {
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    const onItemReady = $w('#sizeCompareRepeater').onItemReady.mock.calls[0][0];
    const $item = createMock$w();
    onItemReady($item, mockComparisonData.products[0]);

    expect($item('#compareOpenDims').text).toContain('54"');
    expect($item('#compareOpenDims').text).toContain('75"');
  });

  it('shows dash for missing closed dimensions', async () => {
    const dataWithNullClosed = {
      ...mockComparisonData,
      products: [
        { ...mockComparisonData.products[0], closed: null },
        mockComparisonData.products[1],
      ],
    };
    mockGetComparisonTable.mockResolvedValue(dataWithNullClosed);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    const onItemReady = $w('#sizeCompareRepeater').onItemReady.mock.calls[0][0];
    const $item = createMock$w();
    onItemReady($item, dataWithNullClosed.products[0]);

    expect($item('#compareClosedDims').text).toBe('—');
  });

  it('renders weight and mattress size', async () => {
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    const onItemReady = $w('#sizeCompareRepeater').onItemReady.mock.calls[0][0];
    const $item = createMock$w();
    onItemReady($item, mockComparisonData.products[0]);

    expect($item('#compareWeight').text).toBe('85 lbs');
    expect($item('#compareMattressSize').text).toBe('Full');
  });

  it('shows dash for missing weight', async () => {
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    const onItemReady = $w('#sizeCompareRepeater').onItemReady.mock.calls[0][0];
    const $item = createMock$w();
    onItemReady($item, { ...mockComparisonData.products[0], weight: null });

    expect($item('#compareWeight').text).toBe('—');
  });

  it('shows dash for missing mattress size', async () => {
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    const onItemReady = $w('#sizeCompareRepeater').onItemReady.mock.calls[0][0];
    const $item = createMock$w();
    onItemReady($item, { ...mockComparisonData.products[0], mattressSize: null });

    expect($item('#compareMattressSize').text).toBe('—');
  });

  it('collapses weight and mattress columns on mobile', async () => {
    isMobile.mockReturnValue(true);
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    const onItemReady = $w('#sizeCompareRepeater').onItemReady.mock.calls[0][0];
    const $item = createMock$w();
    onItemReady($item, mockComparisonData.products[0]);

    expect($item('#compareWeight').collapse).toHaveBeenCalled();
    expect($item('#compareMattressSize').collapse).toHaveBeenCalled();
  });

  it('limits comparison to 3 products on mobile', async () => {
    isMobile.mockReturnValue(true);
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    expect(mockGetComparisonTable).toHaveBeenCalledWith('prod-001', expect.any(String), 3);
  });

  it('limits comparison to 5 products on desktop', async () => {
    isMobile.mockReturnValue(false);
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    expect(mockGetComparisonTable).toHaveBeenCalledWith('prod-001', expect.any(String), 5);
  });

  it('makes non-current product names clickable links', async () => {
    const { makeClickable } = await import('public/a11yHelpers.js');
    mockGetComparisonTable.mockResolvedValue(mockComparisonData);
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initSizeComparisonTable($w, state);

    const onItemReady = $w('#sizeCompareRepeater').onItemReady.mock.calls[0][0];
    const $item = createMock$w();
    onItemReady($item, mockComparisonData.products[1]); // non-current, has slug

    expect(makeClickable).toHaveBeenCalledWith(
      $item('#compareProductName'),
      expect.any(Function),
      expect.objectContaining({ ariaLabel: expect.stringContaining('Monterey Frame') }),
    );
  });
});

// ── Edge Cases ────────────────────────────────────────────────────────

describe('edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dimension display handles null dimension values gracefully', async () => {
    mockGetProductDimensions.mockResolvedValue({
      unit: 'in',
      closed: { width: 54, depth: null, height: 33 },
      open: { width: null, depth: 75, height: 18 },
      weight: null,
      seatHeight: null,
      mattressSize: null,
    });
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    await initDimensionDisplay($w, state);

    // null values should show dash
    expect($w('#closedDims').text).toContain('—');
    expect($w('#openDims').text).toContain('—');
  });

  it('room fit checker recovers from backend exception', async () => {
    mockCheckRoomFit.mockRejectedValue(new Error('Service unavailable'));
    const $w = createMock$w();
    $w('#doorwayWidth').value = '36';
    $w('#doorwayHeight').value = '80';
    const state = { product: { _id: 'prod-001' } };

    await initRoomFitChecker($w, state);
    const clickHandler = $w('#checkFitBtn').onClick.mock.calls[0][0];

    // Should not throw — recovers gracefully
    await expect(clickHandler()).resolves.not.toThrow();
    // Button should be re-enabled
    expect($w('#checkFitBtn').enable).toHaveBeenCalled();
  });

  it('comparison table handles exception gracefully', async () => {
    mockGetComparisonTable.mockRejectedValue(new Error('Database error'));
    const $w = createMock$w();
    const state = { product: { _id: 'prod-001' } };

    // Should not throw
    await expect(initSizeComparisonTable($w, state)).resolves.not.toThrow();
  });
});
