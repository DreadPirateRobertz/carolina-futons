/**
 * @file challengeDiscovery.test.js
 * @description TDD tests for CF-fh5: challenge discovery chip on product/catalog pages.
 * Covers initChallengeDiscoveryChip — show, hide, context filtering.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initChallengeDiscoveryChip } from '../src/public/challengeDiscovery.js';

/** Build a minimal Wix element stub. */
function makeElement(id = 'elem') {
  return {
    id,
    _visible: true,
    _text: '',
    get text() { return this._text; },
    set text(v) { this._text = v; },
    hide: vi.fn(function () { this._visible = false; }),
    show: vi.fn(function () { this._visible = true; }),
  };
}

function makeElements() {
  return {
    $chip:      makeElement('chip'),
    $chipTitle: makeElement('chipTitle'),
    $chipProg:  makeElement('chipProg'),
  };
}

const ADD_TO_CART_CHALLENGE = {
  challengeId: 'ch-1',
  title: 'Add 3 items to cart',
  conditionType: 'add_to_cart',
  targetCount: 3,
  progressValue: 1,
  completedAt: null,
};

const PURCHASE_CHALLENGE = {
  challengeId: 'ch-2',
  title: 'Make a purchase today',
  conditionType: 'purchase',
  targetCount: 1,
  progressValue: 0,
  completedAt: null,
};

const COMPLETED_CHALLENGE = {
  challengeId: 'ch-3',
  title: 'Already done',
  conditionType: 'add_to_cart',
  targetCount: 3,
  progressValue: 3,
  completedAt: '2026-03-22T12:00:00Z',
};

// ── initChallengeDiscoveryChip ────────────────────────────────────────────────

describe('initChallengeDiscoveryChip', () => {
  let elements;
  let mockGetActiveChallenges;

  beforeEach(() => {
    elements = makeElements();
    mockGetActiveChallenges = vi.fn();
  });

  it('hides chip when memberId is null', async () => {
    await initChallengeDiscoveryChip(elements, null, mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.hide).toHaveBeenCalled();
    expect(mockGetActiveChallenges).not.toHaveBeenCalled();
  });

  it('shows chip and sets title + progress when a matching incomplete challenge exists', async () => {
    mockGetActiveChallenges.mockResolvedValue({ challenges: [ADD_TO_CART_CHALLENGE] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.show).toHaveBeenCalled();
    expect(elements.$chipTitle.text).toBe('Add 3 items to cart');
    expect(elements.$chipProg.text).toBe('1 / 3');
  });

  it('hides chip when no challenges are returned', async () => {
    mockGetActiveChallenges.mockResolvedValue({ challenges: [] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.hide).toHaveBeenCalled();
  });

  it('hides chip when no challenge matches the page context', async () => {
    // Only a purchase challenge — on an add_to_cart page, no match
    mockGetActiveChallenges.mockResolvedValue({ challenges: [PURCHASE_CHALLENGE] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.hide).toHaveBeenCalled();
  });

  it('hides chip when matching challenge is already completed', async () => {
    mockGetActiveChallenges.mockResolvedValue({ challenges: [COMPLETED_CHALLENGE] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.hide).toHaveBeenCalled();
  });

  it('shows chip for purchase context when purchase challenge is active', async () => {
    mockGetActiveChallenges.mockResolvedValue({ challenges: [PURCHASE_CHALLENGE] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'purchase');
    expect(elements.$chip.show).toHaveBeenCalled();
    expect(elements.$chipTitle.text).toBe('Make a purchase today');
    expect(elements.$chipProg.text).toBe('0 / 1');
  });

  it('picks first incomplete match when multiple challenges exist', async () => {
    const second = { ...ADD_TO_CART_CHALLENGE, challengeId: 'ch-9', title: 'Second match', progressValue: 2 };
    mockGetActiveChallenges.mockResolvedValue({ challenges: [ADD_TO_CART_CHALLENGE, second] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chipTitle.text).toBe('Add 3 items to cart');
  });

  it('hides chip and does not throw when getActiveChallenges rejects', async () => {
    mockGetActiveChallenges.mockRejectedValue(new Error('network error'));
    await expect(
      initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart')
    ).resolves.not.toThrow();
    expect(elements.$chip.hide).toHaveBeenCalled();
  });

  it('hides chip when getActiveChallenges returns null', async () => {
    mockGetActiveChallenges.mockResolvedValue(null);
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.hide).toHaveBeenCalled();
  });

  it('accepts gamification_add_to_cart conditionType as add_to_cart context match', async () => {
    const altCondition = { ...ADD_TO_CART_CHALLENGE, conditionType: 'gamification_add_to_cart' };
    mockGetActiveChallenges.mockResolvedValue({ challenges: [altCondition] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.show).toHaveBeenCalled();
  });

  it('shows chip for page_view context when page_view challenge is active', async () => {
    const pvChallenge = {
      challengeId: 'ch-4',
      title: 'Browse 5 products',
      conditionType: 'page_view',
      targetCount: 5,
      progressValue: 2,
      completedAt: null,
    };
    mockGetActiveChallenges.mockResolvedValue({ challenges: [pvChallenge] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'page_view');
    expect(elements.$chip.show).toHaveBeenCalled();
    expect(elements.$chipTitle.text).toBe('Browse 5 products');
    expect(elements.$chipProg.text).toBe('2 / 5');
  });

  it('accepts gamification_page_view conditionType as page_view context match', async () => {
    const pvChallenge = {
      challengeId: 'ch-5',
      title: 'Browse products',
      conditionType: 'gamification_page_view',
      targetCount: 5,
      progressValue: 1,
      completedAt: null,
    };
    mockGetActiveChallenges.mockResolvedValue({ challenges: [pvChallenge] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'page_view');
    expect(elements.$chip.show).toHaveBeenCalled();
  });

  it('hides chip when page_view challenge is completed', async () => {
    const pvDone = {
      challengeId: 'ch-6',
      title: 'Browse products',
      conditionType: 'page_view',
      targetCount: 5,
      progressValue: 5,
      completedAt: '2026-03-22T10:00:00Z',
    };
    mockGetActiveChallenges.mockResolvedValue({ challenges: [pvDone] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'page_view');
    expect(elements.$chip.hide).toHaveBeenCalled();
  });

  it('hides chip for unknown context even when challenges exist', async () => {
    mockGetActiveChallenges.mockResolvedValue({ challenges: [ADD_TO_CART_CHALLENGE] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'unknown_ctx');
    expect(elements.$chip.hide).toHaveBeenCalled();
    // getActiveChallenges should not be called — we bail before the network call
    expect(mockGetActiveChallenges).not.toHaveBeenCalled();
  });

  it('shows second incomplete challenge when first is completed (completed shadows incomplete)', async () => {
    const incomplete = { ...ADD_TO_CART_CHALLENGE, challengeId: 'ch-10', title: 'Second chance', progressValue: 2 };
    mockGetActiveChallenges.mockResolvedValue({ challenges: [COMPLETED_CHALLENGE, incomplete] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.show).toHaveBeenCalled();
    expect(elements.$chipTitle.text).toBe('Second chance');
  });
});

// cf-9lp.4: chip previously treated `{ challenges: [], error: 'internal_error' }`
// (cf-tlt shape) identically to a clean empty result — users' chip silently
// hid on DB failure, indistinguishable from "no matching challenge". Cascade
// continuation of cf-tlt (PR #1099), cf-9lp.1 (PR #1102), cf-9lp.2 (PR #1104),
// cf-9lp.3 (PR #1105). UX note: chip stays hidden on error (ambient UI, no
// intrusive error state), but observability improves — discriminate + log.
describe('initChallengeDiscoveryChip — cf-9lp.4 error discrimination', () => {
  let elements;
  let mockGetActiveChallenges;
  let errorSpy;

  beforeEach(() => {
    elements = makeElements();
    mockGetActiveChallenges = vi.fn();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // vi.spyOn on an already-spied property returns the same spy — mockImplementation
  // does NOT reset call history. Restore between tests so each beforeEach gets a
  // truly fresh spy, not one carrying forward prior tests' console.error calls.
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('hides chip AND logs when result.error is "internal_error" (even with empty challenges)', async () => {
    mockGetActiveChallenges.mockResolvedValue({ challenges: [], error: 'internal_error' });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.hide).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('hides chip AND logs when result.error is truthy even with matching challenges (no partial render)', async () => {
    mockGetActiveChallenges.mockResolvedValue({ challenges: [ADD_TO_CART_CHALLENGE], error: 'internal_error' });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.hide).toHaveBeenCalled();
    expect(elements.$chip.show).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('routes any truthy error code to the same hide+log path (future-proof)', async () => {
    mockGetActiveChallenges.mockResolvedValue({ challenges: [], error: 'some-future-code' });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.hide).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('does NOT log when result is a normal empty-but-authed response (no error field)', async () => {
    mockGetActiveChallenges.mockResolvedValue({ challenges: [] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.hide).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does NOT log on normal happy-path render', async () => {
    mockGetActiveChallenges.mockResolvedValue({ challenges: [ADD_TO_CART_CHALLENGE] });
    await initChallengeDiscoveryChip(elements, 'mem-1', mockGetActiveChallenges, 'add_to_cart');
    expect(elements.$chip.show).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
