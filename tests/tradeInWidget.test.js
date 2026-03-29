import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock backend dependency
vi.mock('backend/tradeInService.web', () => ({
  getTradeInValuation: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  default: { to: vi.fn() },
}));

import { getTradeInValuation } from '../src/backend/tradeInService.web.js';
import { initTradeInWidget, getDisplayMax, buildTradeInUrl } from '../src/public/TradeInWidget.js';
import wixLocationFrontend from 'wix-location-frontend';

// ── $w mock ────────────────────────────────────────────────────────

function make$w() {
  const elements = {};
  const el = () => ({
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
    _text: '',
    get text() { return this._text; },
    set text(v) { this._text = v; },
  });

  return (id) => {
    if (!elements[id]) elements[id] = el();
    return elements[id];
  };
}

// ── getDisplayMax ──────────────────────────────────────────────────

describe('getDisplayMax', () => {
  it('returns 75 for frame', () => {
    expect(getDisplayMax('frame')).toBe(75);
  });

  it('returns 40 for mattress', () => {
    expect(getDisplayMax('mattress')).toBe(40);
  });

  it('returns 0 for unknown type', () => {
    expect(getDisplayMax('sofa')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(getDisplayMax('')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(getDisplayMax('FRAME')).toBe(75);
    expect(getDisplayMax('Mattress')).toBe(40);
  });
});

// ── buildTradeInUrl ────────────────────────────────────────────────

describe('buildTradeInUrl', () => {
  it('builds URL with type param for frame', () => {
    expect(buildTradeInUrl('frame')).toBe('/trade-in?type=frame');
  });

  it('builds URL with type param for mattress', () => {
    expect(buildTradeInUrl('mattress')).toBe('/trade-in?type=mattress');
  });

  it('returns base URL for empty type', () => {
    expect(buildTradeInUrl('')).toBe('/trade-in');
  });

  it('returns base URL for null/undefined', () => {
    expect(buildTradeInUrl(null)).toBe('/trade-in');
    expect(buildTradeInUrl(undefined)).toBe('/trade-in');
  });
});

// ── initTradeInWidget ──────────────────────────────────────────────

describe('initTradeInWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTradeInValuation.mockResolvedValue({
      success: true,
      eligible: true,
      creditMin: 67,
      creditMax: 83,
    });
  });

  it('shows widget with credit range text for frame', async () => {
    const $w = make$w();
    await initTradeInWidget($w, 'frame');
    expect($w('#tradeInCreditRange').text).toContain('frame');
    expect($w('#tradeInCreditRange').text).toMatch(/\$\d+/);
    expect($w('#tradeInWidget').show).toHaveBeenCalled();
  });

  it('shows widget with credit range text for mattress', async () => {
    const $w = make$w();
    await initTradeInWidget($w, 'mattress');
    expect($w('#tradeInCreditRange').text).toContain('mattress');
    expect($w('#tradeInWidget').show).toHaveBeenCalled();
  });

  it('hides widget for unknown product type', async () => {
    const $w = make$w();
    await initTradeInWidget($w, 'recliner');
    expect($w('#tradeInWidget').hide).toHaveBeenCalled();
    expect($w('#tradeInWidget').show).not.toHaveBeenCalled();
  });

  it('hides widget for empty product type', async () => {
    const $w = make$w();
    await initTradeInWidget($w, '');
    expect($w('#tradeInWidget').hide).toHaveBeenCalled();
  });

  it('hides widget when backend returns ineligible', async () => {
    getTradeInValuation.mockResolvedValueOnce({ success: true, eligible: false });
    const $w = make$w();
    await initTradeInWidget($w, 'frame');
    expect($w('#tradeInWidget').hide).toHaveBeenCalled();
  });

  it('hides widget when backend call fails', async () => {
    getTradeInValuation.mockRejectedValueOnce(new Error('Network error'));
    const $w = make$w();
    await initTradeInWidget($w, 'frame');
    expect($w('#tradeInWidget').hide).toHaveBeenCalled();
  });

  it('hides widget when backend returns success: false', async () => {
    getTradeInValuation.mockResolvedValueOnce({ success: false });
    const $w = make$w();
    await initTradeInWidget($w, 'frame');
    expect($w('#tradeInWidget').hide).toHaveBeenCalled();
  });

  it('registers CTA onClick that navigates to trade-in page', async () => {
    const $w = make$w();
    await initTradeInWidget($w, 'frame');
    // Simulate click
    const clickHandler = $w('#tradeInCTA').onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();
    clickHandler();
    expect(wixLocationFrontend.to).toHaveBeenCalledWith('/trade-in?type=frame');
  });

  it('does not throw when elements are missing (resilient to partial hookup)', async () => {
    // $w with throwing elements
    const $w = () => {
      throw new Error('Element not found');
    };
    await expect(initTradeInWidget($w, 'frame')).resolves.not.toThrow();
  });

  it('calls getTradeInValuation with good condition', async () => {
    const $w = make$w();
    await initTradeInWidget($w, 'mattress');
    expect(getTradeInValuation).toHaveBeenCalledWith('mattress', 'good');
  });
});
