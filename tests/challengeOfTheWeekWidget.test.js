/**
 * challengeOfTheWeekWidget.test.js
 * CF-8lj8 — ChallengeOfTheWeekWidget: community collective challenge
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initChallengeOfTheWeekWidget } from 'public/ChallengeOfTheWeekWidget.js';

// ── $w mock ───────────────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    style: { width: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

function mock$w(sel) { return getEl(sel); }

// ── Test data ─────────────────────────────────────────────────────────────────

const CHALLENGE = {
  challengeId: 'weekly-500-orders',
  title: 'Community Goal: 500 Orders This Week!',
  description: 'Every order counts. Let\'s hit 500 together!',
  targetCount: 500,
  currentTotal: 342,
  contributorCount: 127,
  rewardPoints: 200,
  expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), // 3 days from now
  isComplete: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChallengeOfTheWeekWidget (CF-8lj8)', () => {
  let getWeeklyChallenge;

  beforeEach(() => {
    elements.clear();
    vi.useFakeTimers();
    getWeeklyChallenge = vi.fn().mockResolvedValue(CHALLENGE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function init(overrides = {}) {
    await initChallengeOfTheWeekWidget({
      getWeeklyChallenge,
      $w: mock$w,
      ...overrides,
    });
  }

  it('sets challenge title', async () => {
    await init();
    expect(getEl('#weeklyTitle').text).toBe('Community Goal: 500 Orders This Week!');
  });

  it('sets challenge description', async () => {
    await init();
    expect(getEl('#weeklyDesc').text).toContain('Every order counts');
  });

  it('displays progress as "current / target"', async () => {
    await init();
    expect(getEl('#weeklyProgress').text).toBe('342 / 500');
  });

  it('sets progress bar width as percentage', async () => {
    await init();
    // 342/500 = 68.4% → rounds to 68%
    expect(getEl('#weeklyProgressBar').style.width).toBe('68%');
  });

  it('caps progress bar at 100%', async () => {
    getWeeklyChallenge.mockResolvedValue({ ...CHALLENGE, currentTotal: 600, targetCount: 500 });
    await init();
    expect(getEl('#weeklyProgressBar').style.width).toBe('100%');
  });

  it('displays reward text', async () => {
    await init();
    expect(getEl('#weeklyReward').text).toContain('200');
    expect(getEl('#weeklyReward').text).toContain('pts');
  });

  it('displays contributor count', async () => {
    await init();
    expect(getEl('#weeklyContributors').text).toContain('127');
    expect(getEl('#weeklyContributors').text).toContain('members contributing');
  });

  it('uses singular "member" for 1 contributor', async () => {
    getWeeklyChallenge.mockResolvedValue({ ...CHALLENGE, contributorCount: 1 });
    await init();
    expect(getEl('#weeklyContributors').text).toBe('1 member contributing');
  });

  it('shows time remaining', async () => {
    await init();
    const text = getEl('#weeklyTimer').text;
    expect(text).toMatch(/\d+d \d+h left/);
  });

  it('expands container when challenge exists', async () => {
    await init();
    expect(getEl('#weeklyContainer').expand).toHaveBeenCalled();
  });

  it('hides complete indicator when not complete', async () => {
    await init();
    expect(getEl('#weeklyComplete').hide).toHaveBeenCalled();
  });

  it('shows complete indicator and "Complete!" when challenge is done', async () => {
    getWeeklyChallenge.mockResolvedValue({ ...CHALLENGE, isComplete: true });
    await init();
    expect(getEl('#weeklyComplete').show).toHaveBeenCalled();
    expect(getEl('#weeklyTimer').text).toBe('Complete!');
  });

  it('collapses container when no active challenge', async () => {
    getWeeklyChallenge.mockResolvedValue(null);
    await init();
    expect(getEl('#weeklyContainer').collapse).toHaveBeenCalled();
  });

  it('shows error and collapses on fetch failure', async () => {
    getWeeklyChallenge.mockRejectedValue(new Error('Network error'));
    await init();
    expect(getEl('#weeklyError').show).toHaveBeenCalled();
    expect(getEl('#weeklyContainer').collapse).toHaveBeenCalled();
  });

  it('does not throw on any error path', async () => {
    getWeeklyChallenge.mockRejectedValue(new Error('fail'));
    await expect(init()).resolves.toBeUndefined();
  });

  it('handles zero progress gracefully', async () => {
    getWeeklyChallenge.mockResolvedValue({ ...CHALLENGE, currentTotal: 0, contributorCount: 0 });
    await init();
    expect(getEl('#weeklyProgress').text).toBe('0 / 500');
    expect(getEl('#weeklyProgressBar').style.width).toBe('0%');
  });

  it('handles missing description', async () => {
    getWeeklyChallenge.mockResolvedValue({ ...CHALLENGE, description: null });
    await init();
    expect(getEl('#weeklyDesc').text).toBe('');
  });

  it('formats "Ended" when expiresAt is in the past', async () => {
    getWeeklyChallenge.mockResolvedValue({
      ...CHALLENGE,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await init();
    expect(getEl('#weeklyTimer').text).toBe('Ended');
  });

  it('formats "< 1h left" when less than 1 hour remains', async () => {
    getWeeklyChallenge.mockResolvedValue({
      ...CHALLENGE,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), // 30 min
    });
    await init();
    expect(getEl('#weeklyTimer').text).toBe('< 1h left');
  });
});
