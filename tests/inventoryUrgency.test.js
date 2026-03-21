/**
 * Frontend urgency badge tests — showUrgencyBadge + initUrgencyBanner.
 * CF-cf77: Live inventory urgency badges
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/inventoryService.web', () => ({
  getInventoryUrgency: vi.fn(),
}));

import { showUrgencyBadge, initUrgencyBanner } from '../src/public/inventoryUrgency.js';
import { getInventoryUrgency } from 'backend/inventoryService.web';

function makeEl() {
  return {
    text: '',
    accessibility: {},
    show: vi.fn(),
    hide: vi.fn(),
  };
}

function make$w() {
  const map = new Map();
  return (sel) => { if (!map.has(sel)) map.set(sel, makeEl()); return map.get(sel); };
}

// ── showUrgencyBadge ────────────────────────────────────────────────

describe('showUrgencyBadge', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
  });

  it('returns early for missing productId', async () => {
    await showUrgencyBadge($w, '');
    expect(getInventoryUrgency).not.toHaveBeenCalled();
  });

  it('shows badge with message for low level', async () => {
    getInventoryUrgency.mockResolvedValue({ level: 'low', count: 3, message: 'Only 3 left!' });
    await showUrgencyBadge($w, 'prod-1');
    expect($w('#inventoryBadge').text).toBe('Only 3 left!');
    expect($w('#inventoryBadge').show).toHaveBeenCalled();
  });

  it('shows badge for just_restocked', async () => {
    getInventoryUrgency.mockResolvedValue({ level: 'just_restocked', count: 20, message: 'Just restocked!' });
    await showUrgencyBadge($w, 'prod-1');
    expect($w('#inventoryBadge').text).toBe('Just restocked!');
    expect($w('#inventoryBadge').show).toHaveBeenCalled();
  });

  it('hides badge for none level', async () => {
    getInventoryUrgency.mockResolvedValue({ level: 'none', count: 50, message: '' });
    await showUrgencyBadge($w, 'prod-1');
    expect($w('#inventoryBadge').hide).toHaveBeenCalled();
    expect($w('#inventoryBadge').show).not.toHaveBeenCalled();
  });

  it('hides badge for out level', async () => {
    getInventoryUrgency.mockResolvedValue({ level: 'out', count: 0, message: 'Out of stock' });
    await showUrgencyBadge($w, 'prod-1');
    expect($w('#inventoryBadge').hide).toHaveBeenCalled();
  });

  it('hides badge on API error', async () => {
    getInventoryUrgency.mockRejectedValue(new Error('Network error'));
    await showUrgencyBadge($w, 'prod-1');
    expect($w('#inventoryBadge').hide).toHaveBeenCalled();
  });
});

// ── initUrgencyBanner ───────────────────────────────────────────────

describe('initUrgencyBanner', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
    state = { product: { _id: 'prod-1' } };
  });

  it('returns early when state has no product', async () => {
    await initUrgencyBanner($w, { product: null });
    expect(getInventoryUrgency).not.toHaveBeenCalled();
  });

  it('returns early when product has no _id', async () => {
    await initUrgencyBanner($w, { product: {} });
    expect(getInventoryUrgency).not.toHaveBeenCalled();
  });

  it('shows banner with text for low stock', async () => {
    getInventoryUrgency.mockResolvedValue({ level: 'low', count: 2, message: 'Only 2 left!' });
    await initUrgencyBanner($w, state);
    expect($w('#urgencyText').text).toBe('Only 2 left!');
    expect($w('#inventoryUrgencyBanner').show).toHaveBeenCalled();
  });

  it('shows banner for just_restocked', async () => {
    getInventoryUrgency.mockResolvedValue({ level: 'just_restocked', count: 15, message: 'Just restocked!' });
    await initUrgencyBanner($w, state);
    expect($w('#urgencyText').text).toBe('Just restocked!');
    expect($w('#inventoryUrgencyBanner').show).toHaveBeenCalled();
  });

  it('shows out of stock message for out level', async () => {
    getInventoryUrgency.mockResolvedValue({ level: 'out', count: 0, message: 'Out of stock' });
    await initUrgencyBanner($w, state);
    expect($w('#urgencyText').text).toBe('Out of stock');
    expect($w('#inventoryUrgencyBanner').show).toHaveBeenCalled();
  });

  it('hides banner for none level', async () => {
    getInventoryUrgency.mockResolvedValue({ level: 'none', count: 100, message: '' });
    await initUrgencyBanner($w, state);
    expect($w('#inventoryUrgencyBanner').hide).toHaveBeenCalled();
  });

  it('sets aria-label on urgencyText', async () => {
    getInventoryUrgency.mockResolvedValue({ level: 'low', count: 4, message: 'Only 4 left!' });
    await initUrgencyBanner($w, state);
    expect($w('#urgencyText').accessibility.ariaLabel).toBe('Only 4 left!');
  });

  it('hides banner on API error', async () => {
    getInventoryUrgency.mockRejectedValue(new Error('fail'));
    await initUrgencyBanner($w, state);
    expect($w('#inventoryUrgencyBanner').hide).toHaveBeenCalled();
  });

  it('calls getInventoryUrgency with product id', async () => {
    getInventoryUrgency.mockResolvedValue({ level: 'none', count: 10, message: '' });
    await initUrgencyBanner($w, state);
    expect(getInventoryUrgency).toHaveBeenCalledWith('prod-1');
  });
});
