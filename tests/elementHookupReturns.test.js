/**
 * Tests for Returns Page element hookup
 * Covers: #returnsTitle, #returnsSubtitle, #returnOrderNumberInput, #returnEmailInput,
 * #lookupReturnBtn, #rmaInput, #trackRmaBtn, #returnResultsSection, #returnOrderNumber,
 * #returnOrderDate, #returnOrderTotal, #returnWindowStatus, #existingReturnsSection,
 * #existingReturnsRepeater, #existingRma, #existingReturnDate, #existingReturnType,
 * #existingReturnReason, #existingReturnStatus, #existingReturnTimeline,
 * #existingTrackingNumber, #returnFormSection, #returnReasonSelect, #returnTypeSelect,
 * #returnItemsSelector, #selectItemName, #selectItemQty, #selectItemPrice,
 * #selectItemImage, #selectItemCheckbox, #selectItemBlockReason, #returnDetailsTextbox,
 * #submitGuestReturnBtn, #cancelReturnFormBtn, #rmaResultsSection, #rmaStatusNumber,
 * #rmaStatusLabel, #rmaTimeline, #rmaTrackingSection, #rmaTrackingNumber,
 * #rmaTrackingStatus, #rmaActivityRepeater, #rmaActivityStatus, #rmaActivityLocation,
 * #rmaActivityDate, #rmaNoTracking, #returnSuccessMessage, #returnError,
 * #returnFormError, #returnLoader, #newReturnSearchBtn
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    src: '',
    alt: '',
    data: [],
    checked: false,
    collapsed: false,
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: { ariaLabel: '', ariaLive: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    scrollTo: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onItemReady: vi.fn(),
    forEachItem: vi.fn(),
    options: [],
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

vi.mock('backend/returnsService.web', () => ({
  lookupReturn: vi.fn(() => Promise.resolve({
    success: true,
    order: { number: '1001', date: '2026-03-14', total: 549.99 },
    returns: [],
  })),
  submitGuestReturn: vi.fn(() => Promise.resolve({ success: true, rmaNumber: 'RMA-9999' })),
  trackReturnShipment: vi.fn(() => Promise.resolve({ success: false })),
  getReturnReasons: vi.fn(() => Promise.resolve({
    reasons: [{ label: 'Defective', value: 'defective' }],
  })),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { success: '#2E7D32', error: '#C62828', primary: '#5B8FA8' },
  typography: { heading: { fontFamily: 'serif' } },
}));

vi.mock('public/ReturnsPortal.js', () => ({
  checkReturnWindow: vi.fn(() => ({ eligible: true, message: 'Within 30-day return window' })),
  getStatusTimeline: vi.fn(() => [
    { label: 'Requested', state: 'completed' },
    { label: 'Received', state: 'active' },
    { label: 'Refunded', state: 'pending' },
  ]),
  formatReturnStatus: vi.fn((s) => s || 'Processing'),
  getStatusColor: vi.fn(() => '#5B8FA8'),
  getReturnableItems: vi.fn((items) => items),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/validators', () => ({
  sanitizeText: vi.fn((v) => v || ''),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  query: {},
}));

// ── Helpers ─────────────────────────────────────────────────────────

async function loadPage() {
  elements.clear();
  onReadyHandler = null;

  vi.resetModules();
  await import('../src/pages/Returns.js');
  if (onReadyHandler) await onReadyHandler();
}

function simulateRepeaterItem(repeaterSel, itemData) {
  const repeater = getEl(repeaterSel);
  if (repeater.onItemReady.mock.calls.length === 0) return null;
  const handler = repeater.onItemReady.mock.calls[0][0];
  const itemElements = new Map();
  const $item = (sel) => {
    if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
    return itemElements.get(sel);
  };
  handler($item, itemData);
  return $item;
}

// ── Lookup Form Tests ───────────────────────────────────────────────

describe('Returns Page — Lookup Form element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets returns title text', async () => {
    await loadPage();
    expect(getEl('#returnsTitle').text).toBe('Returns & Exchanges');
  });

  it('sets returns subtitle text', async () => {
    await loadPage();
    expect(getEl('#returnsSubtitle').text).toContain('Start a return');
  });

  it('sets ARIA label on order number input', async () => {
    await loadPage();
    expect(getEl('#returnOrderNumberInput').accessibility.ariaLabel).toBe('Order number');
  });

  it('sets ARIA label on email input', async () => {
    await loadPage();
    expect(getEl('#returnEmailInput').accessibility.ariaLabel).toBe('Email address used for this order');
  });

  it('sets ARIA label on lookup button', async () => {
    await loadPage();
    expect(getEl('#lookupReturnBtn').accessibility.ariaLabel).toBe('Look up order for return');
  });

  it('registers onClick handler on lookup button', async () => {
    await loadPage();
    expect(getEl('#lookupReturnBtn').onClick).toHaveBeenCalled();
  });

  it('registers onKeyPress on order number input', async () => {
    await loadPage();
    expect(getEl('#returnOrderNumberInput').onKeyPress).toHaveBeenCalled();
  });

  it('registers onKeyPress on email input', async () => {
    await loadPage();
    expect(getEl('#returnEmailInput').onKeyPress).toHaveBeenCalled();
  });
});

// ── RMA Tracker Tests ───────────────────────────────────────────────

describe('Returns Page — RMA Tracker element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA label on RMA input', async () => {
    await loadPage();
    expect(getEl('#rmaInput').accessibility.ariaLabel).toBe('RMA number');
  });

  it('sets ARIA label on track RMA button', async () => {
    await loadPage();
    expect(getEl('#trackRmaBtn').accessibility.ariaLabel).toBe('Track return by RMA number');
  });

  it('registers onClick handler on track RMA button', async () => {
    await loadPage();
    expect(getEl('#trackRmaBtn').onClick).toHaveBeenCalled();
  });

  it('registers onKeyPress on RMA input', async () => {
    await loadPage();
    expect(getEl('#rmaInput').onKeyPress).toHaveBeenCalled();
  });
});

// ── Results Section Tests ───────────────────────────────────────────

describe('Returns Page — Results Section element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('collapses returnResultsSection on init', async () => {
    await loadPage();
    expect(getEl('#returnResultsSection').collapse).toHaveBeenCalled();
  });

  it('renders order number after lookup', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();
    expect(getEl('#returnOrderNumber').text).toBe('Order #1001');
  });

  it('renders order date after lookup', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();
    expect(getEl('#returnOrderDate').text).toBe('2026-03-14');
  });

  it('renders order total after lookup', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();
    expect(getEl('#returnOrderTotal').text).toBe('$549.99');
  });

  it('renders return window status after lookup', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();
    expect(getEl('#returnWindowStatus').text).toBe('Within 30-day return window');
  });
});

// ── Existing Returns Repeater Tests ─────────────────────────────────

describe('Returns Page — Existing Returns Repeater element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('collapses existingReturnsSection on init', async () => {
    await loadPage();
    expect(getEl('#existingReturnsSection').collapse).toHaveBeenCalled();
  });

  it('expands existingReturnsSection when returns exist', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99 },
      returns: [{ _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing' }],
    });
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();
    expect(getEl('#existingReturnsSection').expand).toHaveBeenCalled();
  });

  it('registers onItemReady on existingReturnsRepeater', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99 },
      returns: [{ _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing' }],
    });
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();
    expect(getEl('#existingReturnsRepeater').onItemReady).toHaveBeenCalled();
  });

  it('sets existing return RMA number in repeater item', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99 },
      returns: [{ _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing' }],
    });
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    const lookupHandler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await lookupHandler();
    const $item = simulateRepeaterItem('#existingReturnsRepeater', {
      _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing',
    });
    expect($item).not.toBeNull();
    expect($item('#existingRma').text).toBe('RMA-1234');
  });

  it('sets existing return date in repeater item', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99 },
      returns: [{ _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing' }],
    });
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#existingReturnsRepeater', {
      _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing',
    });
    expect($item('#existingReturnDate').text).toBe('2026-03-10');
  });

  it('sets existing return type as "Return" for return type', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99 },
      returns: [{ _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing' }],
    });
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#existingReturnsRepeater', {
      _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing',
    });
    expect($item('#existingReturnType').text).toBe('Return');
  });

  it('sets existing return type as "Exchange" for exchange type', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99 },
      returns: [{ _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'exchange', reason: 'Wrong size', status: 'processing' }],
    });
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#existingReturnsRepeater', {
      _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'exchange', reason: 'Wrong size', status: 'processing',
    });
    expect($item('#existingReturnType').text).toBe('Exchange');
  });

  it('sets existing return reason in repeater item', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99 },
      returns: [{ _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing' }],
    });
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#existingReturnsRepeater', {
      _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing',
    });
    expect($item('#existingReturnReason').text).toBe('Defective');
  });

  it('sets existing return status text and color', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99 },
      returns: [{ _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing' }],
    });
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#existingReturnsRepeater', {
      _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing',
    });
    expect($item('#existingReturnStatus').text).toBe('processing');
    expect($item('#existingReturnStatus').style.color).toBe('#5B8FA8');
  });

  it('sets existing return timeline text and ARIA', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99 },
      returns: [{ _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing' }],
    });
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#existingReturnsRepeater', {
      _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing',
    });
    expect($item('#existingReturnTimeline').text).toContain('Requested');
    expect($item('#existingReturnTimeline').accessibility.ariaLabel).toBe('Return progress timeline');
  });

  it('hides existingTrackingNumber when no tracking number', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99 },
      returns: [{ _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing' }],
    });
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#existingReturnsRepeater', {
      _id: 'r1', rmaNumber: 'RMA-1234', date: '2026-03-10', type: 'return', reason: 'Defective', status: 'processing',
    });
    expect($item('#existingTrackingNumber').hide).toHaveBeenCalled();
  });
});

// ── Return Form Tests ───────────────────────────────────────────────

describe('Returns Page — Return Form element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('collapses returnFormSection on init', async () => {
    await loadPage();
    expect(getEl('#returnFormSection').collapse).toHaveBeenCalled();
  });

  it('sets ARIA label on submitGuestReturnBtn', async () => {
    await loadPage();
    expect(getEl('#submitGuestReturnBtn').accessibility.ariaLabel).toBe('Submit return request');
  });

  it('registers onClick handler on submitGuestReturnBtn', async () => {
    await loadPage();
    expect(getEl('#submitGuestReturnBtn').onClick).toHaveBeenCalled();
  });

  it('sets ARIA label on cancelReturnFormBtn', async () => {
    await loadPage();
    expect(getEl('#cancelReturnFormBtn').accessibility.ariaLabel).toBe('Cancel return');
  });

  it('registers onClick handler on cancelReturnFormBtn', async () => {
    await loadPage();
    expect(getEl('#cancelReturnFormBtn').onClick).toHaveBeenCalled();
  });

  it('populates returnReasonSelect with reason options after lookup', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    expect(getEl('#returnReasonSelect').options).toEqual([{ label: 'Defective', value: 'defective' }]);
  });

  it('sets ARIA label on returnReasonSelect after lookup', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    expect(getEl('#returnReasonSelect').accessibility.ariaLabel).toBe('Select return reason');
  });

  it('populates returnTypeSelect with return/exchange options', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const options = getEl('#returnTypeSelect').options;
    expect(options).toEqual([
      { label: 'Return (refund)', value: 'return' },
      { label: 'Exchange', value: 'exchange' },
    ]);
  });

  it('sets ARIA label on returnTypeSelect', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    expect(getEl('#returnTypeSelect').accessibility.ariaLabel).toBe('Return or exchange');
  });

  it('expands returnFormSection when order has no existing returns', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    expect(getEl('#returnFormSection').expand).toHaveBeenCalled();
  });
});

// ── Return Items Selector Repeater Tests ────────────────────────────

describe('Returns Page — #returnItemsSelector child element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers onItemReady on returnItemsSelector after lookup', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99, lineItems: [{ _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, returnable: true }] },
      returns: [],
    });
    const { getReturnableItems } = await import('public/ReturnsPortal.js');
    getReturnableItems.mockReturnValueOnce([{ _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, returnable: true }]);
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    expect(getEl('#returnItemsSelector').onItemReady).toHaveBeenCalled();
  });

  it('sets item name, qty, and price in repeater child', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99, lineItems: [{ _id: 'li1', name: 'Kodiak Frame', quantity: 2, price: 549.99, returnable: true }] },
      returns: [],
    });
    const { getReturnableItems } = await import('public/ReturnsPortal.js');
    getReturnableItems.mockReturnValueOnce([{ _id: 'li1', name: 'Kodiak Frame', quantity: 2, price: 549.99, returnable: true }]);
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#returnItemsSelector', {
      _id: 'li1', name: 'Kodiak Frame', quantity: 2, price: 549.99, image: 'kodiak.jpg', returnable: true,
    });
    expect($item).not.toBeNull();
    expect($item('#selectItemName').text).toBe('Kodiak Frame');
    expect($item('#selectItemQty').text).toBe('Qty: 2');
    expect($item('#selectItemPrice').text).toBe('$549.99');
  });

  it('sets item image src and alt', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99, lineItems: [{ _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, returnable: true }] },
      returns: [],
    });
    const { getReturnableItems } = await import('public/ReturnsPortal.js');
    getReturnableItems.mockReturnValueOnce([{ _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, image: 'kodiak.jpg', returnable: true }]);
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#returnItemsSelector', {
      _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, image: 'kodiak.jpg', returnable: true,
    });
    expect($item('#selectItemImage').src).toBe('kodiak.jpg');
    expect($item('#selectItemImage').alt).toBe('Kodiak Frame product image');
  });

  it('sets ARIA label on selectItemCheckbox', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99, lineItems: [{ _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, returnable: true }] },
      returns: [],
    });
    const { getReturnableItems } = await import('public/ReturnsPortal.js');
    getReturnableItems.mockReturnValueOnce([{ _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, returnable: true }]);
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#returnItemsSelector', {
      _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, returnable: true,
    });
    expect($item('#selectItemCheckbox').accessibility.ariaLabel).toBe('Select Kodiak Frame for return');
  });

  it('disables checkbox and shows block reason for non-returnable item', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99, lineItems: [{ _id: 'li1', name: 'Final Sale Item', quantity: 1, price: 99.99, returnable: false, returnBlockReason: 'Final sale items cannot be returned' }] },
      returns: [],
    });
    const { getReturnableItems } = await import('public/ReturnsPortal.js');
    getReturnableItems.mockReturnValueOnce([{ _id: 'li1', name: 'Final Sale Item', quantity: 1, price: 99.99, returnable: false, returnBlockReason: 'Final sale items cannot be returned' }]);
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#returnItemsSelector', {
      _id: 'li1', name: 'Final Sale Item', quantity: 1, price: 99.99, returnable: false, returnBlockReason: 'Final sale items cannot be returned',
    });
    expect($item('#selectItemCheckbox').disable).toHaveBeenCalled();
    expect($item('#selectItemBlockReason').text).toBe('Final sale items cannot be returned');
    expect($item('#selectItemBlockReason').show).toHaveBeenCalled();
  });

  it('enables checkbox and hides block reason for returnable item', async () => {
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValueOnce({
      success: true,
      order: { number: '1001', date: '2026-03-14', total: 549.99, lineItems: [{ _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, returnable: true }] },
      returns: [],
    });
    const { getReturnableItems } = await import('public/ReturnsPortal.js');
    getReturnableItems.mockReturnValueOnce([{ _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, returnable: true }]);
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1001';
    getEl('#returnEmailInput').value = 'test@example.com';
    await getEl('#lookupReturnBtn').onClick.mock.calls[0][0]();
    const $item = simulateRepeaterItem('#returnItemsSelector', {
      _id: 'li1', name: 'Kodiak Frame', quantity: 1, price: 549.99, returnable: true,
    });
    expect($item('#selectItemCheckbox').enable).toHaveBeenCalled();
    expect($item('#selectItemBlockReason').hide).toHaveBeenCalled();
  });
});

// ── RMA Status Section Tests ────────────────────────────────────────

describe('Returns Page — RMA Status element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('collapses rmaResultsSection on init', async () => {
    await loadPage();
    expect(getEl('#rmaResultsSection').collapse).toHaveBeenCalled();
  });

  it('collapses rmaTrackingSection on init', async () => {
    await loadPage();
    expect(getEl('#rmaTrackingSection').collapse).toHaveBeenCalled();
  });

  it('renders rmaStatusNumber after RMA track', async () => {
    const { trackReturnShipment } = await import('backend/returnsService.web');
    trackReturnShipment.mockResolvedValueOnce({
      success: true, rmaNumber: 'RMA-5678', status: 'in_transit',
    });
    await loadPage();
    getEl('#rmaInput').value = 'RMA-5678';
    await getEl('#trackRmaBtn').onClick.mock.calls[0][0]();
    expect(getEl('#rmaStatusNumber').text).toBe('RMA: RMA-5678');
  });

  it('renders rmaStatusLabel with formatted status and color', async () => {
    const { trackReturnShipment } = await import('backend/returnsService.web');
    trackReturnShipment.mockResolvedValueOnce({
      success: true, rmaNumber: 'RMA-5678', status: 'in_transit',
    });
    await loadPage();
    getEl('#rmaInput').value = 'RMA-5678';
    await getEl('#trackRmaBtn').onClick.mock.calls[0][0]();
    expect(getEl('#rmaStatusLabel').text).toBe('in_transit');
    expect(getEl('#rmaStatusLabel').style.color).toBe('#5B8FA8');
    expect(getEl('#rmaStatusLabel').accessibility.ariaLabel).toContain('Return status');
  });

  it('renders rmaTimeline with status steps', async () => {
    const { trackReturnShipment } = await import('backend/returnsService.web');
    trackReturnShipment.mockResolvedValueOnce({
      success: true, rmaNumber: 'RMA-5678', status: 'in_transit',
    });
    await loadPage();
    getEl('#rmaInput').value = 'RMA-5678';
    await getEl('#trackRmaBtn').onClick.mock.calls[0][0]();
    expect(getEl('#rmaTimeline').text).toContain('Requested');
    expect(getEl('#rmaTimeline').accessibility.ariaLabel).toBe('Return progress timeline');
    expect(getEl('#rmaTimeline').accessibility.role).toBe('list');
  });

  it('expands rmaTrackingSection and shows tracking info when tracking exists', async () => {
    const { trackReturnShipment } = await import('backend/returnsService.web');
    trackReturnShipment.mockResolvedValueOnce({
      success: true, rmaNumber: 'RMA-5678', status: 'in_transit',
      tracking: { trackingNumber: '1Z999AA10123', status: 'In Transit', activities: [] },
    });
    await loadPage();
    getEl('#rmaInput').value = 'RMA-5678';
    await getEl('#trackRmaBtn').onClick.mock.calls[0][0]();
    expect(getEl('#rmaTrackingSection').expand).toHaveBeenCalled();
    expect(getEl('#rmaTrackingNumber').text).toBe('Tracking: 1Z999AA10123');
    expect(getEl('#rmaTrackingStatus').text).toBe('In Transit');
  });

  it('renders rmaActivityRepeater items when tracking has activities', async () => {
    const { trackReturnShipment } = await import('backend/returnsService.web');
    trackReturnShipment.mockResolvedValueOnce({
      success: true, rmaNumber: 'RMA-5678', status: 'in_transit',
      tracking: {
        trackingNumber: '1Z999AA10123', status: 'In Transit',
        activities: [{ status: 'Picked Up', location: 'Raleigh, NC', date: '20260310' }],
      },
    });
    await loadPage();
    getEl('#rmaInput').value = 'RMA-5678';
    await getEl('#trackRmaBtn').onClick.mock.calls[0][0]();
    expect(getEl('#rmaActivityRepeater').onItemReady).toHaveBeenCalled();
    const $item = simulateRepeaterItem('#rmaActivityRepeater', {
      _id: 'rma-act-0', status: 'Picked Up', location: 'Raleigh, NC', date: '20260310',
    });
    expect($item).not.toBeNull();
    expect($item('#rmaActivityStatus').text).toBe('Picked Up');
    expect($item('#rmaActivityLocation').text).toBe('Raleigh, NC');
    expect($item('#rmaActivityDate').text).toMatch(/^Mar (9|10)$/);
  });

  it('shows rmaNoTracking when no tracking and message provided', async () => {
    const { trackReturnShipment } = await import('backend/returnsService.web');
    trackReturnShipment.mockResolvedValueOnce({
      success: true, rmaNumber: 'RMA-5678', status: 'pending',
      message: 'Shipping label not yet created',
    });
    await loadPage();
    getEl('#rmaInput').value = 'RMA-5678';
    await getEl('#trackRmaBtn').onClick.mock.calls[0][0]();
    expect(getEl('#rmaTrackingSection').collapse).toHaveBeenCalled();
    expect(getEl('#rmaNoTracking').text).toBe('Shipping label not yet created');
    expect(getEl('#rmaNoTracking').show).toHaveBeenCalled();
  });
});

// ── UI States Tests ─────────────────────────────────────────────────

describe('Returns Page — UI States element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('hides returnSuccessMessage on init', async () => {
    await loadPage();
    expect(getEl('#returnSuccessMessage').hide).toHaveBeenCalled();
  });

  it('hides returnError on init', async () => {
    await loadPage();
    expect(getEl('#returnError').hide).toHaveBeenCalled();
  });

  it('hides returnFormError on init', async () => {
    await loadPage();
    expect(getEl('#returnFormError').hide).toHaveBeenCalled();
  });

  it('hides returnLoader on init', async () => {
    await loadPage();
    expect(getEl('#returnLoader').hide).toHaveBeenCalled();
  });

  it('hides rmaNoTracking on init', async () => {
    await loadPage();
    expect(getEl('#rmaNoTracking').hide).toHaveBeenCalled();
  });

  it('sets ARIA label on newReturnSearchBtn', async () => {
    await loadPage();
    expect(getEl('#newReturnSearchBtn').accessibility.ariaLabel).toBe('Start a new return lookup');
  });

  it('registers onClick handler on newReturnSearchBtn', async () => {
    await loadPage();
    expect(getEl('#newReturnSearchBtn').onClick).toHaveBeenCalled();
  });
});

// ── Dependency Init Tests ───────────────────────────────────────────

describe('Returns Page — dependency initialization', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('calls initBackToTop on page load', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalled();
  });

  it('calls initPageSeo with returns identifier', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('returns');
  });

  it('tracks page_view event on load', async () => {
    await loadPage();
    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'returns' });
  });

  it('loads return reasons on page init', async () => {
    await loadPage();
    const { getReturnReasons } = await import('backend/returnsService.web');
    expect(getReturnReasons).toHaveBeenCalled();
  });
});
