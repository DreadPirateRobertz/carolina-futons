/**
 * onboardingQuestWidget.test.js
 * CF-ufn3 — OnboardingQuestWidget: 4-step onboarding quest chain
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initOnboardingQuestWidget } from '../src/public/OnboardingQuestWidget.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'complete_profile', title: 'Complete Your Profile', description: 'Add your name and shipping address', points: 50, order: 0, completed: false },
  { id: 'first_purchase', title: 'Make Your First Purchase', description: 'Place your first order', points: 100, order: 1, completed: false },
  { id: 'write_review', title: 'Write a Review', description: 'Share your experience with a product review', points: 75, order: 2, completed: false },
  { id: 'refer_friend', title: 'Refer a Friend', description: 'Invite a friend and earn when they sign up', points: 200, order: 3, completed: false },
];

function makeProgress(completedIds = []) {
  const steps = STEPS.map(s => ({ ...s, completed: completedIds.includes(s.id) }));
  const totalPoints = STEPS.reduce((sum, s) => sum + s.points, 0);
  const earnedPoints = STEPS.filter(s => completedIds.includes(s.id)).reduce((sum, s) => sum + s.points, 0);
  return { steps, totalPoints, earnedPoints };
}

function makeEl() {
  return {
    text: '',
    data: null,
    expand: vi.fn(),
    collapse: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    onItemReady: vi.fn(),
  };
}

function make$w() {
  const els = {
    '#onboardingQuestSection': makeEl(),
    '#onboardingQuestRepeater': makeEl(),
    '#onboardingQuestProgress': makeEl(),
    '#onboardingQuestError': makeEl(),
  };
  return vi.fn((id) => els[id] ?? makeEl());
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('initOnboardingQuestWidget', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('expands section and sets progress text for new member', async () => {
    await initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockResolvedValue(makeProgress([])),
    });
    expect($w('#onboardingQuestSection').expand).toHaveBeenCalled();
    expect($w('#onboardingQuestProgress').text).toBe('0 of 4 complete — 0 / 425 pts earned');
  });

  it('shows correct progress after 2 steps completed', async () => {
    await initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockResolvedValue(makeProgress(['complete_profile', 'first_purchase'])),
    });
    expect($w('#onboardingQuestProgress').text).toBe('2 of 4 complete — 150 / 425 pts earned');
  });

  it('collapses section when all steps complete', async () => {
    await initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockResolvedValue(
        makeProgress(['complete_profile', 'first_purchase', 'write_review', 'refer_friend'])
      ),
    });
    expect($w('#onboardingQuestSection').collapse).toHaveBeenCalled();
  });

  it('populates repeater with step data', async () => {
    await initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockResolvedValue(makeProgress([])),
    });
    expect($w('#onboardingQuestRepeater').onItemReady).toHaveBeenCalled();
    expect($w('#onboardingQuestRepeater').data).toHaveLength(4);
    expect($w('#onboardingQuestRepeater').data[0]._id).toBe('complete_profile');
  });

  it('shows error on fetch rejection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockRejectedValue(new Error('DB down')),
    });
    expect($w('#onboardingQuestError').show).toHaveBeenCalled();
    expect($w('#onboardingQuestSection').collapse).toHaveBeenCalled();
  });

  it('shows error on error-shape response', async () => {
    await initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockResolvedValue({ error: 'auth_required' }),
    });
    expect($w('#onboardingQuestError').show).toHaveBeenCalled();
  });

  it('does not throw on null response', async () => {
    await expect(initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockResolvedValue(null),
    })).resolves.not.toThrow();
  });

  it('renders step status: checkmark for completed', async () => {
    await initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockResolvedValue(makeProgress(['complete_profile'])),
    });
    const handler = $w('#onboardingQuestRepeater').onItemReady.mock.calls[0][0];
    const itemEls = { '#questStepTitle': makeEl(), '#questStepDesc': makeEl(), '#questStepPoints': makeEl(), '#questStepStatus': makeEl() };
    const $item = vi.fn((id) => itemEls[id] ?? makeEl());
    handler($item, { ...STEPS[0], completed: true, _id: 'complete_profile' });
    expect(itemEls['#questStepStatus'].text).toBe('\u2713');
  });

  it('renders step status: open circle for unlocked incomplete', async () => {
    const progress = makeProgress(['complete_profile']);
    await initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockResolvedValue(progress),
    });
    const handler = $w('#onboardingQuestRepeater').onItemReady.mock.calls[0][0];
    const itemEls = { '#questStepTitle': makeEl(), '#questStepDesc': makeEl(), '#questStepPoints': makeEl(), '#questStepStatus': makeEl() };
    const $item = vi.fn((id) => itemEls[id] ?? makeEl());
    handler($item, { ...progress.steps[1], _id: 'first_purchase' });
    expect(itemEls['#questStepStatus'].text).toBe('\u25CB');
  });

  it('renders step status: lock for locked step', async () => {
    const progress = makeProgress([]);
    await initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockResolvedValue(progress),
    });
    const handler = $w('#onboardingQuestRepeater').onItemReady.mock.calls[0][0];
    const itemEls = { '#questStepTitle': makeEl(), '#questStepDesc': makeEl(), '#questStepPoints': makeEl(), '#questStepStatus': makeEl() };
    const $item = vi.fn((id) => itemEls[id] ?? makeEl());
    handler($item, { ...progress.steps[1], _id: 'first_purchase' });
    expect(itemEls['#questStepStatus'].text).toBe('\uD83D\uDD12');
  });

  it('renders points label for each step', async () => {
    await initOnboardingQuestWidget({
      $w,
      getOnboardingProgress: vi.fn().mockResolvedValue(makeProgress([])),
    });
    const handler = $w('#onboardingQuestRepeater').onItemReady.mock.calls[0][0];
    const itemEls = { '#questStepTitle': makeEl(), '#questStepDesc': makeEl(), '#questStepPoints': makeEl(), '#questStepStatus': makeEl() };
    const $item = vi.fn((id) => itemEls[id] ?? makeEl());
    handler($item, { ...STEPS[0], completed: false, _id: 'complete_profile' });
    expect(itemEls['#questStepPoints'].text).toBe('+50pts');
  });
});
