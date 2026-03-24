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
