/**
 * warrantyWidget.test.js
 * CF-46ct — WarrantyWidget: CTA and member warranty list
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock wix-location ────────────────────────────────────────────────────────

vi.mock('wix-location', () => ({ default: { to: vi.fn(), query: {} } }));

// ── Mock warrantyService ─────────────────────────────────────────────────────

vi.mock('backend/warrantyService.web', () => ({
  getMyWarranties: vi.fn(),
}));

// ── Mock safeInit ────────────────────────────────────────────────────────────

vi.mock('public/safeInit', () => ({
  safeCall: vi.fn((fn) => { try { fn(); } catch {} }),
  safeCollapse: vi.fn(),
  safeExpand: vi.fn(),
  safeText: vi.fn(),
}));

import { initWarrantyCta, initWarrantyList } from '../src/public/WarrantyWidget.js';
import { safeCollapse, safeExpand } from 'public/safeInit';
import { getMyWarranties } from 'backend/warrantyService.web';
import wixLocation from 'wix-location';

const mockGetMyWarranties = vi.mocked(getMyWarranties);
const mockWixLocation = /** @type {any} */ (wixLocation);

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    value: '',
    expand: vi.fn(),
    collapse: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
    data: null,
    onItemReady: vi.fn(),
  };
}

function make$w(overrides = {}) {
  const els = {
    '#warrantyCtaSection': makeEl(),
    '#warrantyCtaBtn': makeEl(),
    '#warrantyListSection': makeEl(),
    '#warrantyRepeater': makeEl(),
    '#warrantyEmptyMsg': makeEl(),
    '#warrantyListLoading': makeEl(),
    ...overrides,
  };
  return vi.fn((id) => els[id] ?? makeEl());
}

const SAMPLE_WARRANTIES = [
  {
    _id: 'w-001',
    planName: 'Extended Protection',
    productName: 'Canby Futon Frame',
    status: 'active',
    expiresAt: new Date('2028-04-01').toISOString(),
    registeredAt: new Date('2026-03-28').toISOString(),
  },
  {
    _id: 'w-002',
    planName: 'Basic',
    productName: 'Queen Murphy Cabinet Bed',
    status: 'expired',
    expiresAt: new Date('2024-01-01').toISOString(),
    registeredAt: null,
  },
];

// ── initWarrantyCta tests ────────────────────────────────────────────────────

describe('initWarrantyCta', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
    mockWixLocation.to.mockReset();
  });

  it('expands the CTA section', () => {
    initWarrantyCta({ $w });
    expect(safeExpand).toHaveBeenCalledWith($w, '#warrantyCtaSection');
  });

  it('navigates to /warranty-registration on button click', () => {
    const btn = makeEl();
    let clickHandler;
    btn.onClick = vi.fn((fn) => { clickHandler = fn; });
    const $wWithBtn = vi.fn((id) => id === '#warrantyCtaBtn' ? btn : makeEl());

    initWarrantyCta({ $w: $wWithBtn });

    expect(btn.onClick).toHaveBeenCalled();
    clickHandler();
    expect(mockWixLocation.to).toHaveBeenCalledWith('/warranty-registration');
  });

  it('appends orderId to URL when provided', () => {
    const btn = makeEl();
    let clickHandler;
    btn.onClick = vi.fn((fn) => { clickHandler = fn; });
    const $wWithBtn = vi.fn((id) => id === '#warrantyCtaBtn' ? btn : makeEl());

    initWarrantyCta({ $w: $wWithBtn, orderId: 'order-123' });
    clickHandler();

    const url = mockWixLocation.to.mock.calls[0][0];
    expect(url).toContain('orderId=order-123');
  });

  it('appends productId and productName to URL when provided', () => {
    const btn = makeEl();
    let clickHandler;
    btn.onClick = vi.fn((fn) => { clickHandler = fn; });
    const $wWithBtn = vi.fn((id) => id === '#warrantyCtaBtn' ? btn : makeEl());

    initWarrantyCta({ $w: $wWithBtn, productId: 'prod-456', productName: 'Canby Frame' });
    clickHandler();

    const url = mockWixLocation.to.mock.calls[0][0];
    expect(url).toContain('productId=prod-456');
    expect(url).toContain('productName=');
  });

  it('uses no query params when none provided', () => {
    const btn = makeEl();
    let clickHandler;
    btn.onClick = vi.fn((fn) => { clickHandler = fn; });
    const $wWithBtn = vi.fn((id) => id === '#warrantyCtaBtn' ? btn : makeEl());

    initWarrantyCta({ $w: $wWithBtn });
    clickHandler();

    expect(mockWixLocation.to).toHaveBeenCalledWith('/warranty-registration');
  });
});

// ── initWarrantyList tests ───────────────────────────────────────────────────

describe('initWarrantyList', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
    mockGetMyWarranties.mockResolvedValue({ success: true, warranties: SAMPLE_WARRANTIES });
  });

  it('shows loading indicator then hides it', async () => {
    const loading = makeEl();
    const $wWith = vi.fn((id) => id === '#warrantyListLoading' ? loading : makeEl());
    await initWarrantyList({ $w: $wWith });
    expect(loading.show).toHaveBeenCalled();
    expect(loading.hide).toHaveBeenCalled();
  });

  it('expands list section when warranties are returned', async () => {
    await initWarrantyList({ $w });
    expect(safeExpand).toHaveBeenCalledWith($w, '#warrantyListSection');
  });

  it('shows empty message when no warranties exist', async () => {
    mockGetMyWarranties.mockResolvedValue({ success: true, warranties: [] });
    await initWarrantyList({ $w });
    expect(safeCollapse).toHaveBeenCalledWith($w, '#warrantyListSection');
    expect(safeExpand).toHaveBeenCalledWith($w, '#warrantyEmptyMsg');
  });

  it('shows empty message when getMyWarranties fails', async () => {
    mockGetMyWarranties.mockResolvedValue({ success: false, error: 'Not authenticated' });
    await initWarrantyList({ $w });
    expect(safeCollapse).toHaveBeenCalledWith($w, '#warrantyListSection');
    expect(safeExpand).toHaveBeenCalledWith($w, '#warrantyEmptyMsg');
  });

  it('shows empty message when getMyWarranties throws', async () => {
    mockGetMyWarranties.mockRejectedValue(new Error('Network error'));
    await initWarrantyList({ $w });
    expect(safeExpand).toHaveBeenCalledWith($w, '#warrantyEmptyMsg');
  });

  it('populates repeater with warranty data', async () => {
    const repeater = makeEl();
    const $wWith = vi.fn((id) => id === '#warrantyRepeater' ? repeater : makeEl());
    await initWarrantyList({ $w: $wWith });
    expect(repeater.data).not.toBeNull();
    expect(repeater.data).toHaveLength(2);
    expect(repeater.data[0]._id).toBe('w-001');
    expect(repeater.data[1]._id).toBe('w-002');
  });

  it('includes formatted expiry and registration dates in repeater data', async () => {
    const repeater = makeEl();
    const $wWith = vi.fn((id) => id === '#warrantyRepeater' ? repeater : makeEl());
    await initWarrantyList({ $w: $wWith });

    const first = repeater.data[0];
    // Formatted dates should be non-empty human-readable strings (month + year)
    expect(first.expiresAt).toMatch(/\d{4}/); // contains year
    expect(first.registeredAt).toMatch(/\d{4}/);
  });

  it('handles null registeredAt gracefully', async () => {
    const repeater = makeEl();
    const $wWith = vi.fn((id) => id === '#warrantyRepeater' ? repeater : makeEl());
    await initWarrantyList({ $w: $wWith });

    const second = repeater.data[1];
    expect(second.registeredAt).toBe('Not yet registered');
  });
});
