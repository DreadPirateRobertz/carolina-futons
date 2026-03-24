/**
 * @file gamificationTourOverlay.test.js
 * @description Tests for GamificationTourOverlay module.
 *
 * Covers:
 *  - Shows overlay for a logged-in member on first visit
 *  - Suppresses when localStorage key already set (not a first visit)
 *  - No-ops for logged-out visitor (getMember returns null)
 *  - No-ops when getMember throws
 *  - No-ops when overlay element is absent from page
 *  - Sets localStorage key before showing (guard against double-show)
 *  - Wires close button onClick to hide overlay
 *  - No-ops gracefully when close button element is absent
 *  - No-ops when storage.getItem throws
 *  - CTA button triggers navigate('/challenges') and hides overlay
 *  - CTA absent — overlay still shows, navigate not called
 *
 * CF-z2vj  CF-08fa
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initGamificationTourOverlay } from '../src/public/GamificationTourOverlay.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const MEMBER = { _id: 'mem-abc', contactDetails: { firstName: 'Alex' } };

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: vi.fn((k) => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = v; }),
    _store: store,
  };
}

function makeOverlay() {
  return {
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
  };
}

function makeCloseBtn(overlay) {
  return {
    onClick: vi.fn((fn) => { overlay._closeHandler = fn; }),
  };
}

function makeCtaBtn(overlay) {
  return {
    onClick: vi.fn((fn) => { overlay._ctaHandler = fn; }),
  };
}

function make$w(overlay, closeBtn, ctaBtn) {
  return vi.fn((sel) => {
    if (sel === '#gamificationTourOverlay') return overlay || null;
    if (sel === '#gamificationTourClose') return closeBtn || null;
    if (sel === '#gamificationTourCta') return ctaBtn || null;
    return null;
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('initGamificationTourOverlay', () => {
  let overlay, closeBtn, ctaBtn, $w, storage;

  beforeEach(() => {
    overlay  = makeOverlay();
    closeBtn = makeCloseBtn(overlay);
    ctaBtn   = makeCtaBtn(overlay);
    $w       = make$w(overlay, closeBtn, ctaBtn);
    storage  = makeStorage(); // empty = first visit
  });

  it('shows overlay for a logged-in member on first visit', async () => {
    await initGamificationTourOverlay({ $w, getMember: async () => MEMBER, storage });
    expect(overlay.show).toHaveBeenCalledOnce();
  });

  it('sets localStorage key before showing', async () => {
    await initGamificationTourOverlay({ $w, getMember: async () => MEMBER, storage });
    expect(storage.setItem).toHaveBeenCalledWith('cf_gamification_tour_shown', '1');
    expect(storage.setItem).toHaveBeenCalledBefore(overlay.show);
  });

  it('does not show when localStorage key already set (subsequent visit)', async () => {
    const storageSeen = makeStorage({ cf_gamification_tour_shown: '1' });
    await initGamificationTourOverlay({ $w, getMember: async () => MEMBER, storage: storageSeen });
    expect(overlay.show).not.toHaveBeenCalled();
  });

  it('does not show for a logged-out visitor (getMember returns null)', async () => {
    await initGamificationTourOverlay({ $w, getMember: async () => null, storage });
    expect(overlay.show).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('does not show when getMember returns member with no _id', async () => {
    await initGamificationTourOverlay({ $w, getMember: async () => ({}), storage });
    expect(overlay.show).not.toHaveBeenCalled();
  });

  it('does not show when getMember throws', async () => {
    await initGamificationTourOverlay({
      $w,
      getMember: async () => { throw new Error('auth unavailable'); },
      storage,
    });
    expect(overlay.show).not.toHaveBeenCalled();
  });

  it('does not set localStorage key when overlay element is absent from the page', async () => {
    const $wNoOverlay = make$w(null, closeBtn);
    await initGamificationTourOverlay({ $w: $wNoOverlay, getMember: async () => MEMBER, storage });
    // overlay absent → key must NOT be consumed so the tour can show later
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('wires close button onClick to hide the overlay', async () => {
    await initGamificationTourOverlay({ $w, getMember: async () => MEMBER, storage });
    expect(closeBtn.onClick).toHaveBeenCalledOnce();
    // Invoke the registered handler
    overlay._closeHandler();
    expect(overlay.hide).toHaveBeenCalledOnce();
  });

  it('still shows overlay when close button element is absent', async () => {
    const $wNoClose = make$w(overlay, null, ctaBtn);
    await initGamificationTourOverlay({ $w: $wNoClose, getMember: async () => MEMBER, storage });
    expect(overlay.show).toHaveBeenCalledOnce();
  });

  it('proceeds when storage.getItem throws (storage corruption)', async () => {
    const brokenStorage = {
      getItem: vi.fn(() => { throw new Error('QuotaExceeded'); }),
      setItem: vi.fn(),
    };
    await initGamificationTourOverlay({ $w, getMember: async () => MEMBER, storage: brokenStorage });
    expect(overlay.show).toHaveBeenCalledOnce();
  });

  it('proceeds when storage is null (unavailable environment)', async () => {
    await initGamificationTourOverlay({ $w, getMember: async () => MEMBER, storage: null });
    expect(overlay.show).toHaveBeenCalledOnce();
  });

  // ── CTA deep link ───────────────────────────────────────────────────────────

  it('wires CTA button onClick', async () => {
    await initGamificationTourOverlay({ $w, getMember: async () => MEMBER, storage });
    expect(ctaBtn.onClick).toHaveBeenCalledOnce();
  });

  it('CTA click calls navigate with /challenges', async () => {
    const navigate = vi.fn();
    await initGamificationTourOverlay({ $w, getMember: async () => MEMBER, storage, navigate });
    overlay._ctaHandler();
    expect(navigate).toHaveBeenCalledWith('/challenges');
  });

  it('CTA click hides the overlay', async () => {
    const navigate = vi.fn();
    await initGamificationTourOverlay({ $w, getMember: async () => MEMBER, storage, navigate });
    overlay._ctaHandler();
    expect(overlay.hide).toHaveBeenCalledOnce();
  });

  it('still shows overlay when CTA button element is absent', async () => {
    const $wNoCta = make$w(overlay, closeBtn, null);
    await initGamificationTourOverlay({ $w: $wNoCta, getMember: async () => MEMBER, storage });
    expect(overlay.show).toHaveBeenCalledOnce();
  });

  it('navigate not called when CTA is absent', async () => {
    const navigate = vi.fn();
    const $wNoCta = make$w(overlay, closeBtn, null);
    await initGamificationTourOverlay({ $w: $wNoCta, getMember: async () => MEMBER, storage, navigate });
    expect(navigate).not.toHaveBeenCalled();
  });
});
