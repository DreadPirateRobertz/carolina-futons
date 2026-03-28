/**
 * @file PDPShippingEstimate.test.js
 * @description Tests for PDP shipping estimate badge (CF-vu9m).
 * Covers: stored ZIP display, ZIP form fallback, estimate formatting,
 * ZIP input validation, white-glove messaging, accessibility.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('public/shippingPrefs', () => ({
  getStoredZip: vi.fn(),
  setStoredZip: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/DeliveryEstimator.js', () => ({
  estimateDelivery: vi.fn(),
  getShippingZone: vi.fn(() => 'regional'),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    mountainBlue: '#5B8FA8',
    white: '#fff',
    espresso: '#3A2518',
    success: '#28a745',
    error: '#dc3545',
  },
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

import { initPDPShippingEstimate } from '../src/public/PDPShippingEstimate.js';
import { getStoredZip, setStoredZip } from 'public/shippingPrefs';
import { estimateDelivery } from 'public/DeliveryEstimator.js';
import { announce } from 'public/a11yHelpers.js';

// ── Mock $w infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    collapsed: false,
    style: { color: '', backgroundColor: '', borderColor: '' },
    accessibility: { ariaLabel: '', role: '' },
    expand: vi.fn(function () { this.collapsed = false; }),
    collapse: vi.fn(function () { this.collapsed = true; }),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
    click: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

const $w = (sel) => getEl(sel);

const mockProduct = {
  _id: 'prod-1',
  name: 'Asheville Futon Frame',
  price: 549.99,
  weight: 65,
  collections: ['futon-frames'],
};

const mockEstimate = {
  success: true,
  zone: 'regional',
  shippingCost: 39.99,
  estimatedDays: '5-8 business days',
  shippingText: 'Shipping: $39.99',
  deliveryText: 'Estimated delivery: 5-8 business days',
  whiteGlove: null,
};

const freeEstimate = {
  success: true,
  zone: 'local',
  shippingCost: 0,
  estimatedDays: '3-5 business days',
  shippingText: 'FREE shipping',
  deliveryText: 'Estimated delivery: 3-5 business days',
  whiteGlove: null,
};

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('initPDPShippingEstimate', () => {
  it('shows estimate when stored ZIP is available', async () => {
    getStoredZip.mockResolvedValue('28739');
    estimateDelivery.mockResolvedValue(mockEstimate);

    await initPDPShippingEstimate($w, mockProduct);

    expect(estimateDelivery).toHaveBeenCalledWith('28739', mockProduct);
    expect(getEl('#shippingEstimateText').text).toContain('39.99');
    expect(getEl('#shippingEstimateText').text).toContain('28739');
  });

  it('shows ZIP form when no stored ZIP', async () => {
    getStoredZip.mockResolvedValue(null);

    await initPDPShippingEstimate($w, mockProduct);

    expect(getEl('#shippingEstimateZipForm').collapsed).toBe(false);
    expect(getEl('#shippingEstimateText').collapsed).toBe(true);
  });

  it('shows ZIP form when stored ZIP is invalid', async () => {
    getStoredZip.mockResolvedValue('abc');

    await initPDPShippingEstimate($w, mockProduct);

    expect(getEl('#shippingEstimateZipForm').collapsed).toBe(false);
  });

  it('does nothing when product is null', async () => {
    await initPDPShippingEstimate($w, null);
    expect(getStoredZip).not.toHaveBeenCalled();
  });
});

describe('ZIP form submission', () => {
  it('saves ZIP and shows estimate on valid submission', async () => {
    getStoredZip.mockResolvedValue(null);
    estimateDelivery.mockResolvedValue(mockEstimate);

    await initPDPShippingEstimate($w, mockProduct);

    // Simulate typing ZIP and clicking submit
    getEl('#shippingZipInput').value = '28739';
    const clickHandler = getEl('#shippingZipSubmit').onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();
    await clickHandler();

    expect(setStoredZip).toHaveBeenCalledWith('28739');
    expect(estimateDelivery).toHaveBeenCalledWith('28739', mockProduct);
    expect(getEl('#shippingEstimateText').text).toContain('39.99');
  });

  it('shows error styling on invalid ZIP', async () => {
    getStoredZip.mockResolvedValue(null);

    await initPDPShippingEstimate($w, mockProduct);

    getEl('#shippingZipInput').value = '123'; // Too short
    const clickHandler = getEl('#shippingZipSubmit').onClick.mock.calls[0]?.[0];
    await clickHandler();

    expect(getEl('#shippingZipInput').style.borderColor).toContain('dc3545');
    expect(setStoredZip).not.toHaveBeenCalled();
  });

  it('strips non-digits from ZIP input', async () => {
    getStoredZip.mockResolvedValue(null);
    estimateDelivery.mockResolvedValue(mockEstimate);

    await initPDPShippingEstimate($w, mockProduct);

    getEl('#shippingZipInput').value = '287-39';
    const clickHandler = getEl('#shippingZipSubmit').onClick.mock.calls[0]?.[0];
    await clickHandler();

    expect(setStoredZip).toHaveBeenCalledWith('28739');
  });
});

describe('estimate display formatting', () => {
  it('shows FREE for zero-cost shipping', async () => {
    getStoredZip.mockResolvedValue('28791');
    estimateDelivery.mockResolvedValue(freeEstimate);

    await initPDPShippingEstimate($w, mockProduct);

    expect(getEl('#shippingEstimateText').text).toContain('FREE');
    expect(getEl('#shippingEstimateText').style.color).toBe('#28a745');
  });

  it('shows dollar amount for paid shipping', async () => {
    getStoredZip.mockResolvedValue('30301');
    estimateDelivery.mockResolvedValue(mockEstimate);

    await initPDPShippingEstimate($w, mockProduct);

    expect(getEl('#shippingEstimateText').text).toContain('$39.99');
    expect(getEl('#shippingEstimateText').style.color).toBe('#3A2518');
  });

  it('includes delivery timeframe in badge text', async () => {
    getStoredZip.mockResolvedValue('28739');
    estimateDelivery.mockResolvedValue(mockEstimate);

    await initPDPShippingEstimate($w, mockProduct);

    expect(getEl('#shippingEstimateText').text).toContain('5-8 business days');
  });
});

describe('change ZIP flow', () => {
  it('shows ZIP form when change link is clicked', async () => {
    getStoredZip.mockResolvedValue('28739');
    estimateDelivery.mockResolvedValue(mockEstimate);

    await initPDPShippingEstimate($w, mockProduct);

    // Click "Change ZIP" link
    const changeHandler = getEl('#shippingChangeZip').onClick.mock.calls[0]?.[0];
    expect(changeHandler).toBeDefined();
    changeHandler();

    expect(getEl('#shippingEstimateZipForm').collapsed).toBe(false);
  });
});

describe('accessibility', () => {
  it('sets ARIA labels on form elements', async () => {
    getStoredZip.mockResolvedValue(null);

    await initPDPShippingEstimate($w, mockProduct);

    expect(getEl('#shippingZipInput').accessibility.ariaLabel).toContain('ZIP');
    expect(getEl('#shippingZipSubmit').accessibility.ariaLabel).toContain('shipping');
  });

  it('announces estimate update to screen readers', async () => {
    getStoredZip.mockResolvedValue('28739');
    estimateDelivery.mockResolvedValue(mockEstimate);

    await initPDPShippingEstimate($w, mockProduct);

    expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('Shipping'));
  });

  it('sets status role on estimate text', async () => {
    getStoredZip.mockResolvedValue('28739');
    estimateDelivery.mockResolvedValue(mockEstimate);

    await initPDPShippingEstimate($w, mockProduct);

    expect(getEl('#shippingEstimateText').accessibility.role).toBe('status');
  });
});

describe('error handling', () => {
  it('shows ZIP form when estimate fails', async () => {
    getStoredZip.mockResolvedValue('99999');
    estimateDelivery.mockResolvedValue({ success: false, error: 'Invalid ZIP' });

    await initPDPShippingEstimate($w, mockProduct);

    expect(getEl('#shippingEstimateZipForm').collapsed).toBe(false);
  });

  it('collapses badge when getStoredZip throws', async () => {
    getStoredZip.mockRejectedValue(new Error('storage unavailable'));

    await initPDPShippingEstimate($w, mockProduct);

    expect(getEl('#shippingEstimateBadge').collapsed).toBe(true);
  });
});
