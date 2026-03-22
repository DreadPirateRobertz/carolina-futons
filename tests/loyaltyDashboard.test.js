/**
 * Tests for public/LoyaltyDashboard.js
 * CF-gkgv: Loyalty tier progress bar + milestone popups
 *
 * Coverage:
 *   - renderProgressBar: sets .progress and .label; graceful no-op on missing element
 *   - renderTierBadge: sets .text and .style.color; graceful no-op on missing element
 *   - checkTierUp: detects tier-up, fires modal, no-op on first visit / same tier / downgrade
 *   - showTierUpModal: sets text and calls .show(); graceful no-op on missing elements
 *   - initLoyaltyDashboard: full integration — delegates to render helpers, returns account
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initLoyaltyDashboard,
  renderProgressBar,
  renderTierBadge,
  checkTierUp,
  showTierUpModal,
} from '../src/public/LoyaltyDashboard.js';

// ── Helpers ───────────────────────────────────────────────────────────

/** Create a mock sessionStorage-like object. */
function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem:    (k)    => (k in store ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k)    => { delete store[k]; },
    _store:     store,
  };
}

/** Create a mock Wix element with commonly used properties. */
function makeElement(overrides = {}) {
  return {
    progress: null,
    label:    null,
    text:     null,
    style:    { color: null },
    show:     vi.fn(),
    hide:     vi.fn(),
    ...overrides,
  };
}

/** Build a mock $w that returns the specified element map. */
function make$w(elementMap = {}) {
  return (selector) => elementMap[selector] ?? null;
}

/** Build a typical Bronze account fixture. */
function makeBronzeAccount(overrides = {}) {
  return {
    points:       200,
    tier:         'Bronze',
    nextTier:     'Silver',
    progress:     40,
    pointsToNext: 300,
    tierDiscount: 0,
    accountId:    'acct-001',
    ...overrides,
  };
}

function makeSilverAccount(overrides = {}) {
  return makeBronzeAccount({ points: 600, tier: 'Silver', nextTier: 'Gold', progress: 40, pointsToNext: 900, tierDiscount: 5, ...overrides });
}

function makeGoldAccount(overrides = {}) {
  return makeBronzeAccount({ points: 1800, tier: 'Gold', nextTier: null, progress: 100, pointsToNext: 0, tierDiscount: 10, ...overrides });
}

// ═══════════════════════════════════════════════════════════════════════
// 1. renderProgressBar
// ═══════════════════════════════════════════════════════════════════════

describe('renderProgressBar', () => {
  it('sets .progress to the account progress percentage', () => {
    const bar  = makeElement();
    const $wFn = make$w({ '#loyaltyProgressBar': bar });
    renderProgressBar($wFn, makeBronzeAccount({ progress: 40 }));
    expect(bar.progress).toBe(40);
  });

  it('sets .label to the formatted progress text', () => {
    const bar  = makeElement();
    const $wFn = make$w({ '#loyaltyProgressBar': bar });
    renderProgressBar($wFn, makeBronzeAccount({ progress: 40, pointsToNext: 300, nextTier: 'Silver' }));
    expect(typeof bar.label).toBe('string');
    expect(bar.label.length).toBeGreaterThan(0);
  });

  it('sets .progress to 100 for a Gold (max-tier) account', () => {
    const bar  = makeElement();
    const $wFn = make$w({ '#loyaltyProgressBar': bar });
    renderProgressBar($wFn, makeGoldAccount());
    expect(bar.progress).toBe(100);
  });

  it('does not throw when #loyaltyProgressBar is absent', () => {
    expect(() => renderProgressBar(make$w(), makeBronzeAccount())).not.toThrow();
  });

  it('does not throw when $wFn throws', () => {
    const $wFn = () => { throw new Error('$w not ready'); };
    expect(() => renderProgressBar($wFn, makeBronzeAccount())).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. renderTierBadge
// ═══════════════════════════════════════════════════════════════════════

describe('renderTierBadge', () => {
  it('sets .text to include the tier name', () => {
    const badge = makeElement();
    const $wFn  = make$w({ '#loyaltyTierBadge': badge });
    renderTierBadge($wFn, makeSilverAccount());
    expect(badge.text).toContain('Silver');
  });

  it('sets .style.color to the tier colour', () => {
    const badge = makeElement();
    const $wFn  = make$w({ '#loyaltyTierBadge': badge });
    renderTierBadge($wFn, makeGoldAccount());
    expect(typeof badge.style.color).toBe('string');
    expect(badge.style.color.length).toBeGreaterThan(0);
  });

  it('defaults to Bronze tier when account.tier is absent', () => {
    const badge = makeElement();
    const $wFn  = make$w({ '#loyaltyTierBadge': badge });
    renderTierBadge($wFn, {});
    expect(badge.text).toContain('Bronze');
  });

  it('does not throw when #loyaltyTierBadge is absent', () => {
    expect(() => renderTierBadge(make$w(), makeSilverAccount())).not.toThrow();
  });

  it('does not throw when $wFn throws', () => {
    const $wFn = () => { throw new Error('$w not ready'); };
    expect(() => renderTierBadge($wFn, makeSilverAccount())).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. checkTierUp
// ═══════════════════════════════════════════════════════════════════════

describe('checkTierUp', () => {
  it('does not show modal on first visit (no stored tier)', () => {
    const modal = makeElement();
    const $wFn  = make$w({ '#tierUpModal': modal, '#tierUpModalText': makeElement() });
    const storage = makeStorage(); // empty
    checkTierUp($wFn, makeSilverAccount(), storage);
    expect(modal.show).not.toHaveBeenCalled();
  });

  it('stores the current tier on first visit', () => {
    const storage = makeStorage();
    checkTierUp(make$w(), makeSilverAccount(), storage);
    expect(storage._store['cf_loyalty_tier']).toBe('Silver');
  });

  it('shows modal when tier advances from Bronze to Silver', () => {
    const modal    = makeElement();
    const text     = makeElement();
    const $wFn     = make$w({ '#tierUpModal': modal, '#tierUpModalText': text });
    const storage  = makeStorage({ cf_loyalty_tier: 'Bronze' });
    checkTierUp($wFn, makeSilverAccount(), storage);
    expect(modal.show).toHaveBeenCalledOnce();
    expect(text.text).toContain('Silver');
  });

  it('shows modal when tier advances from Silver to Gold', () => {
    const modal   = makeElement();
    const text    = makeElement();
    const $wFn    = make$w({ '#tierUpModal': modal, '#tierUpModalText': text });
    const storage = makeStorage({ cf_loyalty_tier: 'Silver' });
    checkTierUp($wFn, makeGoldAccount(), storage);
    expect(modal.show).toHaveBeenCalledOnce();
    expect(text.text).toContain('Gold');
  });

  it('does not show modal when tier stays the same', () => {
    const modal   = makeElement();
    const $wFn    = make$w({ '#tierUpModal': modal, '#tierUpModalText': makeElement() });
    const storage = makeStorage({ cf_loyalty_tier: 'Silver' });
    checkTierUp($wFn, makeSilverAccount(), storage);
    expect(modal.show).not.toHaveBeenCalled();
  });

  it('does not show modal when tier drops (edge case — no downgrade popup)', () => {
    const modal   = makeElement();
    const $wFn    = make$w({ '#tierUpModal': modal, '#tierUpModalText': makeElement() });
    const storage = makeStorage({ cf_loyalty_tier: 'Gold' });
    checkTierUp($wFn, makeSilverAccount(), storage);
    expect(modal.show).not.toHaveBeenCalled();
  });

  it('updates stored tier even when no tier-up occurred', () => {
    const storage = makeStorage({ cf_loyalty_tier: 'Bronze' });
    checkTierUp(make$w(), makeBronzeAccount(), storage);
    expect(storage._store['cf_loyalty_tier']).toBe('Bronze');
  });

  it('does not throw when storage is null', () => {
    expect(() => checkTierUp(make$w(), makeSilverAccount(), null)).not.toThrow();
  });

  it('does not throw when storage.setItem throws', () => {
    const storage = { getItem: () => 'Bronze', setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {} };
    expect(() => checkTierUp(make$w(), makeSilverAccount(), storage)).not.toThrow();
  });

  it('skips gracefully when account.tier is absent', () => {
    const modal   = makeElement();
    const $wFn    = make$w({ '#tierUpModal': modal });
    const storage = makeStorage({ cf_loyalty_tier: 'Bronze' });
    checkTierUp($wFn, {}, storage);
    expect(modal.show).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. showTierUpModal
// ═══════════════════════════════════════════════════════════════════════

describe('showTierUpModal', () => {
  it('calls .show() on the modal element', () => {
    const modal = makeElement();
    const text  = makeElement();
    showTierUpModal(make$w({ '#tierUpModal': modal, '#tierUpModalText': text }), 'Silver');
    expect(modal.show).toHaveBeenCalledOnce();
  });

  it('sets the Silver congratulations message', () => {
    const text = makeElement();
    showTierUpModal(make$w({ '#tierUpModal': makeElement(), '#tierUpModalText': text }), 'Silver');
    expect(text.text).toContain('Silver');
    expect(text.text).toContain('5%');
  });

  it('sets the Gold congratulations message', () => {
    const text = makeElement();
    showTierUpModal(make$w({ '#tierUpModal': makeElement(), '#tierUpModalText': text }), 'Gold');
    expect(text.text).toContain('Gold');
    expect(text.text).toContain('10%');
  });

  it('uses a fallback message for unknown tier names', () => {
    const text = makeElement();
    showTierUpModal(make$w({ '#tierUpModal': makeElement(), '#tierUpModalText': text }), 'Platinum');
    expect(text.text).toContain('Platinum');
  });

  it('does not throw when #tierUpModal is absent', () => {
    expect(() => showTierUpModal(make$w({ '#tierUpModalText': makeElement() }), 'Silver')).not.toThrow();
  });

  it('does not throw when #tierUpModalText is absent', () => {
    expect(() => showTierUpModal(make$w({ '#tierUpModal': makeElement() }), 'Silver')).not.toThrow();
  });

  it('does not throw when both modal elements are absent', () => {
    expect(() => showTierUpModal(make$w(), 'Gold')).not.toThrow();
  });

  it('does not throw when $wFn throws', () => {
    const $wFn = () => { throw new Error('$w not ready'); };
    expect(() => showTierUpModal($wFn, 'Silver')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. initLoyaltyDashboard — integration
// ═══════════════════════════════════════════════════════════════════════

describe('initLoyaltyDashboard', () => {
  let bar, badge, modal, text, $wFn, storage;

  beforeEach(() => {
    bar     = makeElement();
    badge   = makeElement();
    modal   = makeElement();
    text    = makeElement();
    $wFn    = make$w({ '#loyaltyProgressBar': bar, '#loyaltyTierBadge': badge, '#tierUpModal': modal, '#tierUpModalText': text });
    storage = makeStorage();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns the account object on success', async () => {
    const account = makeSilverAccount();
    const result = await initLoyaltyDashboard({
      $w: $wFn,
      getMyLoyaltyAccount: async () => account,
      storage,
    });
    expect(result).toEqual(account);
  });

  it('renders the progress bar', async () => {
    await initLoyaltyDashboard({
      $w: $wFn,
      getMyLoyaltyAccount: async () => makeBronzeAccount({ progress: 40 }),
      storage,
    });
    expect(bar.progress).toBe(40);
  });

  it('renders the tier badge', async () => {
    await initLoyaltyDashboard({
      $w: $wFn,
      getMyLoyaltyAccount: async () => makeSilverAccount(),
      storage,
    });
    expect(badge.text).toContain('Silver');
  });

  it('shows tier-up modal when tier advances (Bronze → Silver)', async () => {
    storage.setItem('cf_loyalty_tier', 'Bronze');
    await initLoyaltyDashboard({
      $w: $wFn,
      getMyLoyaltyAccount: async () => makeSilverAccount(),
      storage,
    });
    expect(modal.show).toHaveBeenCalledOnce();
  });

  it('does not show modal when tier is unchanged', async () => {
    storage.setItem('cf_loyalty_tier', 'Silver');
    await initLoyaltyDashboard({
      $w: $wFn,
      getMyLoyaltyAccount: async () => makeSilverAccount(),
      storage,
    });
    expect(modal.show).not.toHaveBeenCalled();
  });

  it('returns null and logs error when getMyLoyaltyAccount throws', async () => {
    const result = await initLoyaltyDashboard({
      $w: $wFn,
      getMyLoyaltyAccount: async () => { throw new Error('Network error'); },
      storage,
    });
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('does not render anything when getMyLoyaltyAccount throws', async () => {
    await initLoyaltyDashboard({
      $w: $wFn,
      getMyLoyaltyAccount: async () => { throw new Error('Network error'); },
      storage,
    });
    expect(bar.progress).toBeNull();
    expect(badge.text).toBeNull();
    expect(modal.show).not.toHaveBeenCalled();
  });
});
