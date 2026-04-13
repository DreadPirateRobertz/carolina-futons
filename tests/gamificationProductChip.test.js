/**
 * @file gamificationProductChip.test.js
 * @description Tests for GamificationProductChip.js — CF-e2r
 *   formatTierChipLabel, formatPointsChipLabel, renderTierChip, initMemberTierChip
 */
import { describe, it, expect, vi } from 'vitest';
import {
  formatTierChipLabel,
  formatPointsChipLabel,
  renderTierChip,
  initMemberTierChip,
  formatCardChipLabel,
  renderCardGamificationChip,
} from '../src/public/GamificationProductChip.js';

// ── formatTierChipLabel ───────────────────────────────────────────────

describe('formatTierChipLabel', () => {
  it('returns empty string for null account', () => {
    expect(formatTierChipLabel(null)).toBe('');
  });

  it('returns empty string when tier is absent', () => {
    expect(formatTierChipLabel({ points: { balance: 100 } })).toBe('');
  });

  it('includes tier name', () => {
    const label = formatTierChipLabel({ tier: 'Trail Blazer', points: { balance: 0 } });
    expect(label).toContain('Trail Blazer');
  });

  it('includes tier icon when tier is known', () => {
    const label = formatTierChipLabel({ tier: 'Mountain Guide' });
    expect(label.length).toBeGreaterThan('Mountain Guide'.length); // icon prepended
  });
});

// ── formatPointsChipLabel ─────────────────────────────────────────────

describe('formatPointsChipLabel', () => {
  it('returns empty string for null account', () => {
    expect(formatPointsChipLabel(null)).toBe('');
  });

  it('returns empty string when points is absent', () => {
    expect(formatPointsChipLabel({ tier: 'Bronze' })).toBe('');
  });

  it('formats balance from points.balance', () => {
    expect(formatPointsChipLabel({ points: { balance: 350 } })).toBe('350 pts');
  });

  it('formats balance from flat points field', () => {
    expect(formatPointsChipLabel({ points: 120 })).toBe('120 pts');
  });

  it('handles zero balance', () => {
    expect(formatPointsChipLabel({ points: { balance: 0 } })).toBe('0 pts');
  });
});

// ── renderTierChip ────────────────────────────────────────────────────

describe('renderTierChip', () => {
  function makeEl() {
    return {
      text:  null,
      style: { color: null },
      show:  vi.fn(),
      hide:  vi.fn(),
    };
  }

  function make$w(chip, points) {
    return (id) => {
      if (id === '#memberTierChip')   return chip;
      if (id === '#memberPointsChip') return points;
      return null;
    };
  }

  it('shows tier chip with label when account has tier', () => {
    const chip = makeEl();
    const pts  = makeEl();
    renderTierChip(make$w(chip, pts), { tier: 'Trail Blazer', points: { balance: 200 } });
    expect(chip.text).toContain('Trail Blazer');
    expect(chip.show).toHaveBeenCalledOnce();
    expect(chip.hide).not.toHaveBeenCalled();
  });

  it('shows points chip with formatted balance', () => {
    const chip = makeEl();
    const pts  = makeEl();
    renderTierChip(make$w(chip, pts), { tier: 'Trail Blazer', points: { balance: 200 } });
    expect(pts.text).toBe('200 pts');
    expect(pts.show).toHaveBeenCalledOnce();
  });

  it('hides tier chip when account is null', () => {
    const chip = makeEl();
    const pts  = makeEl();
    renderTierChip(make$w(chip, pts), null);
    expect(chip.hide).toHaveBeenCalledOnce();
    expect(chip.show).not.toHaveBeenCalled();
  });

  it('hides points chip when account is null', () => {
    const chip = makeEl();
    const pts  = makeEl();
    renderTierChip(make$w(chip, pts), null);
    expect(pts.hide).toHaveBeenCalledOnce();
  });

  it('no-ops when #memberTierChip is absent', () => {
    const $wFn = () => null;
    expect(() => renderTierChip($wFn, { tier: 'Bronze' })).not.toThrow();
  });

  it('no-ops gracefully when $wFn throws', () => {
    const $wFn = () => { throw new Error('not mounted'); };
    expect(() => renderTierChip($wFn, { tier: 'Bronze' })).not.toThrow();
  });

  it('sets tier color when account has a known tier', () => {
    const chip = makeEl();
    renderTierChip((id) => (id === '#memberTierChip' ? chip : null), { tier: 'Mountain Guide' });
    expect(chip.style.color).toBeTruthy();
  });
});

// ── initMemberTierChip ────────────────────────────────────────────────

describe('initMemberTierChip', () => {
  function makeEl() {
    return { text: null, style: { color: null }, show: vi.fn(), hide: vi.fn() };
  }

  it('renders the tier chip for a logged-in member', async () => {
    const chip = makeEl();
    const $wFn = (id) => (id === '#memberTierChip' ? chip : null);
    await initMemberTierChip({
      $w: $wFn,
      getMyLoyaltyAccount: async () => ({ tier: 'Trail Blazer', points: { balance: 100 } }),
    });
    expect(chip.text).toContain('Trail Blazer');
    expect(chip.show).toHaveBeenCalledOnce();
  });

  it('hides chips when getMyLoyaltyAccount throws (unauthenticated)', async () => {
    const chip = makeEl();
    const $wFn = (id) => (id === '#memberTierChip' ? chip : null);
    await initMemberTierChip({
      $w: $wFn,
      getMyLoyaltyAccount: async () => { throw new Error('Unauthenticated'); },
    });
    expect(chip.hide).toHaveBeenCalledOnce();
    expect(chip.show).not.toHaveBeenCalled();
  });

  it('returns the account on success', async () => {
    const account = { tier: 'Summit Master', points: { balance: 500 } };
    const result = await initMemberTierChip({
      $w: () => null,
      getMyLoyaltyAccount: async () => account,
    });
    expect(result).toBe(account);
  });

  it('returns null when getMyLoyaltyAccount throws', async () => {
    const result = await initMemberTierChip({
      $w: () => null,
      getMyLoyaltyAccount: async () => { throw new Error('x'); },
    });
    expect(result).toBeNull();
  });
});

// ── formatCardChipLabel ───────────────────────────────────────────────
// CF-pyw: per-card chip shown on collection/category product grids.

describe('formatCardChipLabel', () => {
  it('returns empty string for null account', () => {
    expect(formatCardChipLabel(null)).toBe('');
  });

  it('returns empty string when account has neither tier nor points', () => {
    expect(formatCardChipLabel({})).toBe('');
  });

  it('returns tier-only label when points are absent', () => {
    const label = formatCardChipLabel({ tier: 'Trail Blazer' });
    expect(label).toContain('Trail Blazer');
    expect(label).not.toContain('pts');
  });

  it('returns points-only label when tier is absent', () => {
    const label = formatCardChipLabel({ points: { balance: 120 } });
    expect(label).toBe('120 pts');
  });

  it('combines tier and points with a separator', () => {
    const label = formatCardChipLabel({ tier: 'Trail Blazer', points: { balance: 200 } });
    expect(label).toContain('Trail Blazer');
    expect(label).toContain('200 pts');
    expect(label).toMatch(/[·•|·\-]/); // some separator between
  });

  it('handles zero balance alongside tier', () => {
    const label = formatCardChipLabel({ tier: 'Bronze', points: { balance: 0 } });
    expect(label).toContain('Bronze');
    expect(label).toContain('0 pts');
  });
});

// ── renderCardGamificationChip ────────────────────────────────────────

describe('renderCardGamificationChip', () => {
  function makeEl() {
    return {
      text:  null,
      style: { color: null },
      show:  vi.fn(),
      hide:  vi.fn(),
    };
  }

  function make$item(chip) {
    return (id) => (id === '#gridGamificationChip' ? chip : null);
  }

  it('shows the card chip with tier + points when account is present', () => {
    const chip = makeEl();
    renderCardGamificationChip(make$item(chip), {
      tier: 'Trail Blazer',
      points: { balance: 200 },
    });
    expect(chip.text).toContain('Trail Blazer');
    expect(chip.text).toContain('200 pts');
    expect(chip.show).toHaveBeenCalledOnce();
    expect(chip.hide).not.toHaveBeenCalled();
  });

  it('applies tier color when account has a known tier', () => {
    const chip = makeEl();
    renderCardGamificationChip(make$item(chip), { tier: 'Mountain Guide' });
    expect(chip.style.color).toBeTruthy();
  });

  it('hides the card chip when account is null', () => {
    const chip = makeEl();
    renderCardGamificationChip(make$item(chip), null);
    expect(chip.hide).toHaveBeenCalledOnce();
    expect(chip.show).not.toHaveBeenCalled();
  });

  it('hides the card chip when account has neither tier nor points', () => {
    const chip = makeEl();
    renderCardGamificationChip(make$item(chip), {});
    expect(chip.hide).toHaveBeenCalledOnce();
  });

  it('shows points-only label without setting tier color', () => {
    const chip = makeEl();
    renderCardGamificationChip(make$item(chip), { points: { balance: 50 } });
    expect(chip.text).toBe('50 pts');
    expect(chip.show).toHaveBeenCalledOnce();
    expect(chip.style.color).toBeNull();
  });

  it('logs a non-Error thrown value without crashing', () => {
    const $item = () => { throw 'string-error'; };
    expect(() => renderCardGamificationChip($item, { tier: 'Bronze' })).not.toThrow();
  });

  it('no-ops when #gridGamificationChip element is absent', () => {
    const $item = () => null;
    expect(() => renderCardGamificationChip($item, { tier: 'Bronze' })).not.toThrow();
  });

  it('no-ops gracefully when $item throws', () => {
    const $item = () => { throw new Error('not mounted'); };
    expect(() => renderCardGamificationChip($item, { tier: 'Bronze' })).not.toThrow();
  });
});
