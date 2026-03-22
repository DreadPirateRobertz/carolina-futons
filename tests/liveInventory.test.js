/**
 * Tests for LiveInventory.js
 *
 * Covers: initLiveInventory (in-stock, low-stock, out-of-stock states,
 * notify-me flow, error handling), element nicknames.
 *
 * See CF-ke0p for original specification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('backend/liveInventory.web.js', () => ({
  getProductInventory: vi.fn(),
  registerStockNotification: vi.fn(),
}));

import { initLiveInventory } from '../src/public/LiveInventory.js';
import { announce } from 'public/a11yHelpers.js';
import { getProductInventory, registerStockNotification } from 'backend/liveInventory.web.js';

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '',
    value: '',
    accessibility: {},
    customClassList: { add: vi.fn(), remove: vi.fn() },
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
  };
}

function createMock$w() {
  const elements = {};
  return vi.fn((selector) => {
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  });
}

function createMockState(overrides = {}) {
  return {
    product: { _id: 'prod-001', name: 'Test Futon', ...overrides.product },
    ...overrides,
  };
}

function standardSetup() {
  vi.clearAllMocks();
  const $w = createMock$w();
  const state = createMockState();
  return { $w, state };
}

function mockInventory(status, quantity = 10) {
  getProductInventory.mockResolvedValue({ success: true, status, quantity });
}

function getClickHandler(el) {
  const calls = el.onClick.mock.calls;
  if (!calls.length) throw new Error('No onClick handler registered on element');
  return calls[calls.length - 1][0];
}

// ── initLiveInventory — setup ─────────────────────────────────────────

describe('initLiveInventory — setup', () => {
  let $w, state;

  beforeEach(() => {
    ({ $w, state } = standardSetup());
    mockInventory('in_stock');
  });

  it('returns null when product._id is missing', async () => {
    const result = await initLiveInventory($w, { product: {} });
    expect(result).toBeNull();
  });

  it('returns null when state is null', async () => {
    const result = await initLiveInventory($w, null);
    expect(result).toBeNull();
  });

  it('calls getProductInventory with product _id', async () => {
    await initLiveInventory($w, state);
    expect(getProductInventory).toHaveBeenCalledWith('prod-001');
  });

  it('hides inventoryLoader after data loads', async () => {
    await initLiveInventory($w, state);
    expect($w('#inventoryLoader').hide).toHaveBeenCalled();
  });

  it('collapses lowStockBanner initially', async () => {
    await initLiveInventory($w, state);
    expect($w('#lowStockBanner').collapse).toHaveBeenCalled();
  });

  it('collapses notifyMeSection initially', async () => {
    await initLiveInventory($w, state);
    expect($w('#notifyMeSection').collapse).toHaveBeenCalled();
  });

  it('hides notifyMeSuccess initially', async () => {
    await initLiveInventory($w, state);
    expect($w('#notifyMeSuccess').hide).toHaveBeenCalled();
  });

  it('wires onClick on notifyMeBtn', async () => {
    await initLiveInventory($w, state);
    expect($w('#notifyMeBtn').onClick).toHaveBeenCalled();
  });
});

// ── in-stock state ────────────────────────────────────────────────────

describe('initLiveInventory — in-stock state', () => {
  let $w, state;

  beforeEach(async () => {
    ({ $w, state } = standardSetup());
    mockInventory('in_stock', 20);
    await initLiveInventory($w, state);
  });

  it('sets stockStatusBadge text to "In Stock"', () => {
    expect($w('#stockStatusBadge').text).toBe('In Stock');
  });

  it('adds "in-stock" CSS class to stockStatusBadge', () => {
    expect($w('#stockStatusBadge').customClassList.add).toHaveBeenCalledWith('in-stock');
  });

  it('does not show lowStockBanner', () => {
    expect($w('#lowStockBanner').expand).not.toHaveBeenCalled();
  });

  it('does not show notifyMeSection', () => {
    expect($w('#notifyMeSection').expand).not.toHaveBeenCalled();
  });

  it('does not disable addToCartButton', () => {
    expect($w('#addToCartButton').disable).not.toHaveBeenCalled();
  });

  it('does not announce anything for in-stock', () => {
    expect(announce).not.toHaveBeenCalled();
  });
});

// ── low-stock state ───────────────────────────────────────────────────

describe('initLiveInventory — low-stock state', () => {
  let $w, state;

  beforeEach(async () => {
    ({ $w, state } = standardSetup());
    mockInventory('low_stock', 3);
    await initLiveInventory($w, state);
  });

  it('sets stockStatusBadge text to "Low Stock — 3 left"', () => {
    expect($w('#stockStatusBadge').text).toMatch(/Low Stock.*3/);
  });

  it('adds "low-stock" CSS class to stockStatusBadge', () => {
    expect($w('#stockStatusBadge').customClassList.add).toHaveBeenCalledWith('low-stock');
  });

  it('expands lowStockBanner', () => {
    expect($w('#lowStockBanner').expand).toHaveBeenCalled();
  });

  it('sets lowStockCount text to "Only 3 left!"', () => {
    expect($w('#lowStockCount').text).toMatch(/Only 3 left/);
  });

  it('does not show notifyMeSection', () => {
    expect($w('#notifyMeSection').expand).not.toHaveBeenCalled();
  });

  it('does not disable addToCartButton', () => {
    expect($w('#addToCartButton').disable).not.toHaveBeenCalled();
  });

  it('announces low stock for screen readers', () => {
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/low stock|3 left/i));
  });
});

// ── out-of-stock state ────────────────────────────────────────────────

describe('initLiveInventory — out-of-stock state', () => {
  let $w, state;

  beforeEach(async () => {
    ({ $w, state } = standardSetup());
    mockInventory('out_of_stock', 0);
    await initLiveInventory($w, state);
  });

  it('sets stockStatusBadge text to "Out of Stock"', () => {
    expect($w('#stockStatusBadge').text).toBe('Out of Stock');
  });

  it('adds "out-of-stock" CSS class to stockStatusBadge', () => {
    expect($w('#stockStatusBadge').customClassList.add).toHaveBeenCalledWith('out-of-stock');
  });

  it('expands notifyMeSection', () => {
    expect($w('#notifyMeSection').expand).toHaveBeenCalled();
  });

  it('does not expand lowStockBanner', () => {
    expect($w('#lowStockBanner').expand).not.toHaveBeenCalled();
  });

  it('disables addToCartButton', () => {
    expect($w('#addToCartButton').disable).toHaveBeenCalled();
  });

  it('announces out-of-stock for screen readers', () => {
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/out of stock/i));
  });
});

// ── LOW_STOCK threshold boundary ──────────────────────────────────────

describe('initLiveInventory — LOW_STOCK threshold boundary (qty <= 5)', () => {
  async function initWithQty(status, quantity) {
    const { $w, state } = standardSetup();
    mockInventory(status, quantity);
    await initLiveInventory($w, state);
    return $w;
  }

  it('shows lowStockBanner when qty is exactly 5', async () => {
    const $w = await initWithQty('low_stock', 5);
    expect($w('#lowStockBanner').expand).toHaveBeenCalled();
  });

  it('shows lowStockBanner when qty is 1', async () => {
    const $w = await initWithQty('low_stock', 1);
    expect($w('#lowStockBanner').expand).toHaveBeenCalled();
  });

  it('does not show lowStockBanner when status is in_stock (qty > 5)', async () => {
    const $w = await initWithQty('in_stock', 10);
    expect($w('#lowStockBanner').expand).not.toHaveBeenCalled();
  });
});

// ── notify me flow ────────────────────────────────────────────────────

describe('initLiveInventory — notify me flow', () => {
  let $w, state;

  beforeEach(async () => {
    ({ $w, state } = standardSetup());
    mockInventory('out_of_stock', 0);
    await initLiveInventory($w, state);
  });

  it('calls registerStockNotification with productId and email on click', async () => {
    $w('#notifyMeEmail').value = 'test@example.com';
    registerStockNotification.mockResolvedValue({ success: true });
    await getClickHandler($w('#notifyMeBtn'))();
    expect(registerStockNotification).toHaveBeenCalledWith('prod-001', 'test@example.com');
  });

  it('shows notifyMeSuccess after successful registration', async () => {
    $w('#notifyMeEmail').value = 'test@example.com';
    registerStockNotification.mockResolvedValue({ success: true });
    await getClickHandler($w('#notifyMeBtn'))();
    expect($w('#notifyMeSuccess').show).toHaveBeenCalled();
  });

  it('hides notifyMeBtn after successful registration', async () => {
    $w('#notifyMeEmail').value = 'test@example.com';
    registerStockNotification.mockResolvedValue({ success: true });
    await getClickHandler($w('#notifyMeBtn'))();
    expect($w('#notifyMeBtn').hide).toHaveBeenCalled();
  });

  it('does not show notifyMeSuccess when email is empty', async () => {
    $w('#notifyMeEmail').value = '';
    await getClickHandler($w('#notifyMeBtn'))();
    expect(registerStockNotification).not.toHaveBeenCalled();
    expect($w('#notifyMeSuccess').show).not.toHaveBeenCalled();
  });

  it('does not show notifyMeSuccess when registerStockNotification returns success: false', async () => {
    $w('#notifyMeEmail').value = 'test@example.com';
    registerStockNotification.mockResolvedValue({ success: false, error: 'Already signed up' });
    await getClickHandler($w('#notifyMeBtn'))();
    expect($w('#notifyMeSuccess').show).not.toHaveBeenCalled();
  });

  it('does not throw when registerStockNotification throws', async () => {
    $w('#notifyMeEmail').value = 'test@example.com';
    registerStockNotification.mockRejectedValue(new Error('network error'));
    await expect(getClickHandler($w('#notifyMeBtn'))()).resolves.not.toThrow();
  });

  it('logs error when registerStockNotification throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    $w('#notifyMeEmail').value = 'test@example.com';
    registerStockNotification.mockRejectedValue(new Error('network error'));
    await getClickHandler($w('#notifyMeBtn'))();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not show notifyMeSuccess when registerStockNotification returns null', async () => {
    $w('#notifyMeEmail').value = 'test@example.com';
    registerStockNotification.mockResolvedValue(null);
    await getClickHandler($w('#notifyMeBtn'))();
    expect($w('#notifyMeSuccess').show).not.toHaveBeenCalled();
  });

  it('announces when email is empty', async () => {
    $w('#notifyMeEmail').value = '';
    await getClickHandler($w('#notifyMeBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/email/i));
  });

  it('does not call registerStockNotification when email is empty', async () => {
    $w('#notifyMeEmail').value = '';
    await getClickHandler($w('#notifyMeBtn'))();
    expect(registerStockNotification).not.toHaveBeenCalled();
  });

  it('announces when registerStockNotification returns success: false', async () => {
    $w('#notifyMeEmail').value = 'test@example.com';
    registerStockNotification.mockResolvedValue({ success: false, error: 'Already signed up' });
    await getClickHandler($w('#notifyMeBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/unable|try again/i));
  });

  it('announces when registerStockNotification throws', async () => {
    $w('#notifyMeEmail').value = 'test@example.com';
    registerStockNotification.mockRejectedValue(new Error('network error'));
    await getClickHandler($w('#notifyMeBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/unable|try again/i));
  });
});

// ── error handling ────────────────────────────────────────────────────

describe('initLiveInventory — error handling', () => {
  let $w, state;

  beforeEach(() => {
    ({ $w, state } = standardSetup());
  });

  it('logs error when getProductInventory throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getProductInventory.mockRejectedValue(new Error('backend unavailable'));
    await initLiveInventory($w, state);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not throw when getProductInventory throws', async () => {
    getProductInventory.mockRejectedValue(new Error('backend unavailable'));
    await expect(initLiveInventory($w, state)).resolves.not.toThrow();
  });

  it('hides inventoryLoader even when getProductInventory throws', async () => {
    getProductInventory.mockRejectedValue(new Error('backend unavailable'));
    await initLiveInventory($w, state);
    expect($w('#inventoryLoader').hide).toHaveBeenCalled();
  });

  it('logs error when getProductInventory returns success: false', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getProductInventory.mockResolvedValue({ success: false, error: 'Not found' });
    await initLiveInventory($w, state);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('hides inventoryLoader even when success: false', async () => {
    getProductInventory.mockResolvedValue({ success: false, error: 'Not found' });
    await initLiveInventory($w, state);
    expect($w('#inventoryLoader').hide).toHaveBeenCalled();
  });

  it('sets stockStatusBadge to fallback text when success: false', async () => {
    getProductInventory.mockResolvedValue({ success: false, error: 'Not found' });
    await initLiveInventory($w, state);
    expect($w('#stockStatusBadge').text).toMatch(/unknown/i);
  });
});

// ── unknown / unmapped status ─────────────────────────────────────────

describe('initLiveInventory — unknown status falls back gracefully', () => {
  it('uses in-stock CSS class for unrecognized status', async () => {
    const { $w, state } = standardSetup();
    getProductInventory.mockResolvedValue({ success: true, status: 'discontinued', quantity: 0 });
    await initLiveInventory($w, state);
    expect($w('#stockStatusBadge').customClassList.add).toHaveBeenCalledWith('in-stock');
  });
});

// ── element nicknames ─────────────────────────────────────────────────

describe('element nicknames — all required IDs are addressed', () => {
  let $w, state;

  beforeEach(async () => {
    ({ $w, state } = standardSetup());
    mockInventory('out_of_stock', 0);
    await initLiveInventory($w, state);
  });

  it('addresses #stockStatusBadge', () => {
    expect($w).toHaveBeenCalledWith('#stockStatusBadge');
  });

  it('addresses #lowStockBanner', () => {
    expect($w).toHaveBeenCalledWith('#lowStockBanner');
  });

  it('addresses #lowStockCount', async () => {
    // lowStockCount only addressed in low-stock state; re-init with low-stock
    vi.clearAllMocks();
    const { $w: $w2, state: state2 } = standardSetup();
    mockInventory('low_stock', 2);
    await initLiveInventory($w2, state2);
    expect($w2).toHaveBeenCalledWith('#lowStockCount');
  });

  it('addresses #inventoryLoader', () => {
    expect($w).toHaveBeenCalledWith('#inventoryLoader');
  });

  it('addresses #notifyMeSection', () => {
    expect($w).toHaveBeenCalledWith('#notifyMeSection');
  });

  it('addresses #notifyMeEmail', async () => {
    // notifyMeEmail is accessed inside the click handler; trigger it
    $w('#notifyMeEmail').value = 'x@example.com';
    registerStockNotification.mockResolvedValue({ success: true });
    await getClickHandler($w('#notifyMeBtn'))();
    expect($w).toHaveBeenCalledWith('#notifyMeEmail');
  });

  it('addresses #notifyMeBtn', () => {
    expect($w).toHaveBeenCalledWith('#notifyMeBtn');
  });

  it('addresses #notifyMeSuccess', () => {
    expect($w).toHaveBeenCalledWith('#notifyMeSuccess');
  });
});
