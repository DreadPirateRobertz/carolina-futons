/**
 * @file PDPSocialProofBadge.test.js
 * Tests for PDPSocialProofBadge (cf-ic1).
 *
 * Pre-auth social proof badge on the product detail page.
 * Shows "X Charlotte members competing — earn N points on this purchase".
 * ZIP source: URL query param; fallback to national count.
 * No login required — visible to all visitors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initPDPSocialProofBadge,
} from '../src/public/PDPSocialProofBadge.js';

// ── Minimal $w mock ───────────────────────────────────────────────────────────

function makeMockBadge() {
  return {
    _text: '',
    _visible: false,
    _ariaLabel: '',
    text: '',
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    accessibility: { ariaLabel: '' },
  };
}

function make$w(badge) {
  return (selector) => {
    if (selector === '#socialProofBadge') return badge;
    return { show: vi.fn(), hide: vi.fn(), text: '' };
  };
}

// ── Default mocks ─────────────────────────────────────────────────────────────

const DEFAULT_STATE = { product: { price: 149.99 } };
const DEFAULT_RESULT = { count: 7, zipPrefix: '282', isNational: false };
const NATIONAL_RESULT = { count: 42, zipPrefix: null, isNational: true };

let mockGetNeighborCount;

beforeEach(() => {
  mockGetNeighborCount = vi.fn().mockResolvedValue(DEFAULT_RESULT);
});

// ── Badge visibility ──────────────────────────────────────────────────────────

describe('initPDPSocialProofBadge — visibility', () => {
  it('shows badge when count > 0', async () => {
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), DEFAULT_STATE, mockGetNeighborCount);
    expect(badge.show).toHaveBeenCalled();
  });

  it('hides badge when count is 0', async () => {
    mockGetNeighborCount.mockResolvedValue({ count: 0, zipPrefix: '282', isNational: false });
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), DEFAULT_STATE, mockGetNeighborCount);
    expect(badge.hide).toHaveBeenCalled();
  });

  it('hides badge on error from getNeighborCount', async () => {
    mockGetNeighborCount.mockRejectedValue(new Error('network fail'));
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), DEFAULT_STATE, mockGetNeighborCount);
    expect(badge.hide).toHaveBeenCalled();
  });

  it('hides badge when product is null (no product loaded)', async () => {
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), { product: null }, mockGetNeighborCount);
    expect(badge.hide).toHaveBeenCalled();
  });
});

// ── Badge text ────────────────────────────────────────────────────────────────

describe('initPDPSocialProofBadge — badge text', () => {
  it('shows member count and points preview in badge text', async () => {
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), DEFAULT_STATE, mockGetNeighborCount);
    // count=7, price=149.99 → points=149
    expect(badge.text).toMatch(/7/);
    expect(badge.text).toMatch(/149/);
  });

  it('uses Math.floor of product price for points', async () => {
    const badge = makeMockBadge();
    const state = { product: { price: 299.95 } };
    await initPDPSocialProofBadge(make$w(badge), state, mockGetNeighborCount);
    expect(badge.text).toMatch(/299/);
    expect(badge.text).not.toMatch(/300/);
  });

  it('shows national count text when isNational is true', async () => {
    mockGetNeighborCount.mockResolvedValue(NATIONAL_RESULT);
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), DEFAULT_STATE, mockGetNeighborCount);
    expect(badge.text).toMatch(/42/);
  });

  it('includes "members" and "points" in badge text', async () => {
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), DEFAULT_STATE, mockGetNeighborCount);
    expect(badge.text.toLowerCase()).toMatch(/member/);
    expect(badge.text.toLowerCase()).toMatch(/point/);
  });
});

// ── ZIP param passthrough ─────────────────────────────────────────────────────

describe('initPDPSocialProofBadge — ZIP param passthrough', () => {
  it('calls getNeighborCount with zipPrefix from options', async () => {
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), DEFAULT_STATE, mockGetNeighborCount, { zipPrefix: '282' });
    expect(mockGetNeighborCount).toHaveBeenCalledWith('282');
  });

  it('calls getNeighborCount with null when no zipPrefix option provided', async () => {
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), DEFAULT_STATE, mockGetNeighborCount);
    expect(mockGetNeighborCount).toHaveBeenCalledWith(null);
  });

  it('calls getNeighborCount with null when zipPrefix is empty string', async () => {
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), DEFAULT_STATE, mockGetNeighborCount, { zipPrefix: '' });
    expect(mockGetNeighborCount).toHaveBeenCalledWith(null);
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe('initPDPSocialProofBadge — accessibility', () => {
  it('sets an aria-label on the badge element', async () => {
    const badge = makeMockBadge();
    await initPDPSocialProofBadge(make$w(badge), DEFAULT_STATE, mockGetNeighborCount);
    expect(badge.accessibility.ariaLabel).toBeTruthy();
  });
});
