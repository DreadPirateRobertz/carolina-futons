/**
 * tierUpgradeModal.test.js
 * CF-u81k — tier upgrade celebration modal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTierUpgradeModal, TIER_BENEFITS } from '../src/public/TierUpgradeModal.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    onClick: vi.fn(),
  };
}

function make$w() {
  const els = {
    '#tierUpgradeModal':    makeEl(),
    '#tierUpgradeHeading':  makeEl(),
    '#tierUpgradeBenefits': makeEl(),
    '#tierUpgradeCloseBtn': makeEl(),
  };
  return (id) => els[id] ?? makeEl();
}

// ── Modal display ──────────────────────────────────────────────────────────

describe('initTierUpgradeModal — modal display', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('shows modal when tier increases', async () => {
    await initTierUpgradeModal('Trail Blazer', 'Mountain Guide', { $w });
    expect($w('#tierUpgradeModal').show).toHaveBeenCalled();
  });

  it('does not show modal when tier is unchanged', async () => {
    await initTierUpgradeModal('Mountain Guide', 'Mountain Guide', { $w });
    expect($w('#tierUpgradeModal').show).not.toHaveBeenCalled();
  });

  it('does not show modal when prevTier and newTier are both null', async () => {
    await initTierUpgradeModal(null, null, { $w });
    expect($w('#tierUpgradeModal').show).not.toHaveBeenCalled();
  });

  it('shows modal when prevTier is null and newTier is set', async () => {
    await initTierUpgradeModal(null, 'Mountain Guide', { $w });
    expect($w('#tierUpgradeModal').show).toHaveBeenCalled();
  });
});

// ── Heading and benefits text ──────────────────────────────────────────────

describe('initTierUpgradeModal — heading and benefits', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('sets heading to "You reached [newTier]!"', async () => {
    await initTierUpgradeModal('Trail Blazer', 'Mountain Guide', { $w });
    expect($w('#tierUpgradeHeading').text).toBe('You reached Mountain Guide!');
  });

  it('sets benefits text for Mountain Guide', async () => {
    await initTierUpgradeModal('Trail Blazer', 'Mountain Guide', { $w });
    expect($w('#tierUpgradeBenefits').text).toBe('Early access to sales + 2x review points');
  });

  it('sets benefits text for Summit Seeker', async () => {
    await initTierUpgradeModal('Mountain Guide', 'Summit Seeker', { $w });
    expect($w('#tierUpgradeBenefits').text).toBe('Free shipping on orders over $150 + priority support');
  });

  it('sets benefits text for Peak Pioneer', async () => {
    await initTierUpgradeModal('Summit Seeker', 'Peak Pioneer', { $w });
    expect($w('#tierUpgradeBenefits').text).toBe('VIP events + dedicated support + 3x review points');
  });

  it('uses default (empty) benefits text for Trail Blazer', async () => {
    await initTierUpgradeModal(null, 'Trail Blazer', { $w });
    expect($w('#tierUpgradeBenefits').text).toBe('');
  });

  it('does not update heading or benefits when tier is unchanged', async () => {
    await initTierUpgradeModal('Mountain Guide', 'Mountain Guide', { $w });
    expect($w('#tierUpgradeHeading').text).toBe('');
    expect($w('#tierUpgradeBenefits').text).toBe('');
  });
});

// ── Close button ───────────────────────────────────────────────────────────

describe('initTierUpgradeModal — close button', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('wires onClick on close button when modal shows', async () => {
    await initTierUpgradeModal('Trail Blazer', 'Mountain Guide', { $w });
    expect($w('#tierUpgradeCloseBtn').onClick).toHaveBeenCalled();
  });

  it('close button handler hides the modal', async () => {
    await initTierUpgradeModal('Trail Blazer', 'Mountain Guide', { $w });
    const handler = $w('#tierUpgradeCloseBtn').onClick.mock.calls[0][0];
    handler();
    expect($w('#tierUpgradeModal').hide).toHaveBeenCalled();
  });

  it('does not wire close button when tier is unchanged', async () => {
    await initTierUpgradeModal('Mountain Guide', 'Mountain Guide', { $w });
    expect($w('#tierUpgradeCloseBtn').onClick).not.toHaveBeenCalled();
  });
});

// ── TIER_BENEFITS export ───────────────────────────────────────────────────

describe('TIER_BENEFITS constant', () => {
  it('exports benefit text for each tier', () => {
    expect(TIER_BENEFITS['Mountain Guide']).toBe('Early access to sales + 2x review points');
    expect(TIER_BENEFITS['Summit Seeker']).toBe('Free shipping on orders over $150 + priority support');
    expect(TIER_BENEFITS['Peak Pioneer']).toBe('VIP events + dedicated support + 3x review points');
  });

  it('Trail Blazer entry is empty string (default)', () => {
    expect(TIER_BENEFITS['Trail Blazer']).toBe('');
  });
});
