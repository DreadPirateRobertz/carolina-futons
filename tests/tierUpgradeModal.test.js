/**
 * tierUpgradeModal.test.js
 * CF-u81k, CF-c6el.1 — tier upgrade celebration modal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTierUpgradeModal, buildBenefitText } from '../src/public/TierUpgradeModal.js';

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

// ── buildBenefitText ─────────────────────────────────────────────────────────

describe('buildBenefitText — perk-driven benefit copy', () => {
  it('returns empty string when tier is unchanged', () => {
    expect(buildBenefitText('Mountain Guide', 'Mountain Guide')).toBe('');
  });

  it('returns new perks for Trail Blazer → Mountain Guide', () => {
    const text = buildBenefitText('Trail Blazer', 'Mountain Guide');
    expect(text).toContain('15% off accessories');
    expect(text).toContain('Priority support');
    // Should NOT include birthday discount (already had it)
    expect(text).not.toContain('birthday');
  });

  it('returns new perks for Mountain Guide → Summit Master', () => {
    const text = buildBenefitText('Mountain Guide', 'Summit Master');
    expect(text).toContain('Free white-glove delivery');
    expect(text).toContain('early access');
    expect(text).toContain('styling call');
    // Should NOT include perks they already had
    expect(text).not.toContain('15% off accessories');
  });

  it('returns empty for null → Trail Blazer (no new perks vs baseline)', () => {
    // Trail Blazer perks are baseline — getNewPerksOnPromotion(null, 'Trail Blazer')
    // returns all Trail Blazer perks since null tier has none
    const text = buildBenefitText(null, 'Trail Blazer');
    expect(text).toContain('birthday');
  });
});

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

  it('sets perk-driven benefits text for Mountain Guide', async () => {
    await initTierUpgradeModal('Trail Blazer', 'Mountain Guide', { $w });
    const text = $w('#tierUpgradeBenefits').text;
    expect(text).toContain('15% off accessories');
    expect(text).toContain('Priority support');
  });

  it('sets perk-driven benefits text for Summit Master', async () => {
    await initTierUpgradeModal('Mountain Guide', 'Summit Master', { $w });
    const text = $w('#tierUpgradeBenefits').text;
    expect(text).toContain('Free white-glove delivery');
    expect(text).toContain('styling call');
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
