/**
 * challengeOfTheWeekWidget.test.js
 * CF-8lj8 — ChallengeOfTheWeekWidget: community collective challenge
 * cf-rsr  — featured individual Challenge of the Week section
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initChallengeOfTheWeekWidget } from 'public/ChallengeOfTheWeekWidget.js';

// ── $w mock ───────────────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    link: '',
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
  let getActiveChallengeOfWeek;

  beforeEach(() => {
    elements.clear();
    vi.useFakeTimers();
    getWeeklyChallenge = vi.fn().mockResolvedValue(CHALLENGE);
    getActiveChallengeOfWeek = vi.fn().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function init(overrides = {}) {
    await initChallengeOfTheWeekWidget({
      getWeeklyChallenge,
      getActiveChallengeOfWeek,
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

  it('shows error UI when backend returns error shape', async () => {
    getWeeklyChallenge.mockResolvedValue({ error: 'service_unavailable' });
    await init();
    expect(getEl('#weeklyError').show).toHaveBeenCalled();
    expect(getEl('#weeklyContainer').collapse).toHaveBeenCalled();
  });

  it('handles targetCount of 0 without NaN', async () => {
    getWeeklyChallenge.mockResolvedValue({ ...CHALLENGE, targetCount: 0, currentTotal: 0 });
    await init();
    expect(getEl('#weeklyProgress').text).toBe('0 / 1');
    expect(getEl('#weeklyProgressBar').style.width).toBe('0%');
  });
});

// ── Featured individual Challenge of the Week (cf-rsr) ────────────────────────

const FEATURED = {
  challengeId: 'cotw-apr-w3',
  title: 'Write a Review',
  description: 'Share your experience this week!',
  conditionType: 'write_review',
  targetCount: 1,
  progressValue: 0,
  completedAt: null,
  rewardPoints: 150,
  expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  ctaUrl: '/reviews',
};

describe('ChallengeOfTheWeekWidget — featured challenge section (cf-rsr)', () => {
  let getWeeklyChallenge;
  let getActiveChallengeOfWeek;

  beforeEach(() => {
    elements.clear();
    vi.useFakeTimers();
    getWeeklyChallenge = vi.fn().mockResolvedValue(null);
    getActiveChallengeOfWeek = vi.fn().mockResolvedValue(FEATURED);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function init(overrides = {}) {
    await initChallengeOfTheWeekWidget({
      getWeeklyChallenge,
      getActiveChallengeOfWeek,
      $w: mock$w,
      ...overrides,
    });
  }

  it('expands #cotwContainer when featured challenge is active', async () => {
    await init();
    expect(getEl('#cotwContainer').expand).toHaveBeenCalled();
  });

  it('sets #cotwTitle to challenge name', async () => {
    await init();
    expect(getEl('#cotwTitle').text).toBe('Write a Review');
  });

  it('sets #cotwDesc to challenge description', async () => {
    await init();
    expect(getEl('#cotwDesc').text).toBe('Share your experience this week!');
  });

  it('sets #cotwProgressText as "progressValue / targetCount"', async () => {
    getActiveChallengeOfWeek.mockResolvedValue({ ...FEATURED, progressValue: 0, targetCount: 1 });
    await init();
    expect(getEl('#cotwProgressText').text).toBe('0 / 1');
  });

  it('sets #cotwProgressBar width as member completion percent', async () => {
    getActiveChallengeOfWeek.mockResolvedValue({ ...FEATURED, progressValue: 1, targetCount: 2 });
    await init();
    expect(getEl('#cotwProgressBar').style.width).toBe('50%');
  });

  it('caps progress bar at 100%', async () => {
    getActiveChallengeOfWeek.mockResolvedValue({ ...FEATURED, progressValue: 5, targetCount: 1 });
    await init();
    expect(getEl('#cotwProgressBar').style.width).toBe('100%');
  });

  it('sets #cotwReward text', async () => {
    await init();
    expect(getEl('#cotwReward').text).toContain('150');
    expect(getEl('#cotwReward').text).toContain('pts');
  });

  it('shows #cotwCtaBtn with link when ctaUrl is present', async () => {
    await init();
    expect(getEl('#cotwCtaBtn').link).toBe('/reviews');
    expect(getEl('#cotwCtaBtn').show).toHaveBeenCalled();
  });

  it('hides #cotwCtaBtn when ctaUrl is absent', async () => {
    getActiveChallengeOfWeek.mockResolvedValue({ ...FEATURED, ctaUrl: null });
    await init();
    expect(getEl('#cotwCtaBtn').hide).toHaveBeenCalled();
  });

  it('collapses #cotwContainer when no featured challenge', async () => {
    getActiveChallengeOfWeek.mockResolvedValue(null);
    await init();
    expect(getEl('#cotwContainer').collapse).toHaveBeenCalled();
  });

  it('shows #cotwError and collapses on fetch failure', async () => {
    getActiveChallengeOfWeek.mockRejectedValue(new Error('Network error'));
    await init();
    expect(getEl('#cotwError').show).toHaveBeenCalled();
    expect(getEl('#cotwContainer').collapse).toHaveBeenCalled();
  });

  it('does not throw on fetch failure', async () => {
    getActiveChallengeOfWeek.mockRejectedValue(new Error('fail'));
    await expect(init()).resolves.toBeUndefined();
  });

  it('guards against targetCount of 0 (no NaN in width)', async () => {
    getActiveChallengeOfWeek.mockResolvedValue({ ...FEATURED, targetCount: 0, progressValue: 0 });
    await init();
    expect(getEl('#cotwProgressBar').style.width).toBe('0%');
  });

  it('handles missing description', async () => {
    getActiveChallengeOfWeek.mockResolvedValue({ ...FEATURED, description: null });
    await init();
    expect(getEl('#cotwDesc').text).toBe('');
  });
});

// ── getChallengeOfTheWeek homepage section (cf-1he) ─────────────────────────

const COTW_CHALLENGE = {
  challengeId: 'cotw-apr-w3',
  title: 'Share a Room Photo',
  description: 'Post your futon setup and earn points!',
  pointValue: 200,
  imageUrl: 'https://example.com/challenge.jpg',
  weekStart: new Date('2026-04-12'),
};

describe('ChallengeOfTheWeekWidget — getChallengeOfTheWeek section (cf-1he)', () => {
  let getWeeklyChallenge;
  let getActiveChallengeOfWeek;
  let getChallengeOfTheWeek;

  beforeEach(() => {
    elements.clear();
    vi.useFakeTimers();
    getWeeklyChallenge = vi.fn().mockResolvedValue(null);
    getActiveChallengeOfWeek = vi.fn().mockResolvedValue(null);
    getChallengeOfTheWeek = vi.fn().mockResolvedValue({ success: true, challenge: COTW_CHALLENGE });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function init(overrides = {}) {
    await initChallengeOfTheWeekWidget({
      getWeeklyChallenge,
      getActiveChallengeOfWeek,
      getChallengeOfTheWeek,
      $w: mock$w,
      ...overrides,
    });
  }

  it('populates #cotw-title with challenge title', async () => {
    await init();
    expect(getEl('#cotw-title').text).toBe('Share a Room Photo');
  });

  it('populates #cotw-description with challenge description', async () => {
    await init();
    expect(getEl('#cotw-description').text).toBe('Post your futon setup and earn points!');
  });

  it('populates #cotw-points with pointValue', async () => {
    await init();
    expect(getEl('#cotw-points').text).toContain('200');
  });

  it('sets #cotw-image src to imageUrl', async () => {
    await init();
    expect(getEl('#cotw-image').src).toBe('https://example.com/challenge.jpg');
  });

  it('expands #cotw-section on success', async () => {
    await init();
    expect(getEl('#cotw-section').expand).toHaveBeenCalled();
  });

  it('hides #cotw-section when success is false', async () => {
    getChallengeOfTheWeek.mockResolvedValue({ success: false, error: 'no_challenges' });
    await init();
    expect(getEl('#cotw-section').collapse).toHaveBeenCalled();
  });

  it('hides #cotw-section on fetch error', async () => {
    getChallengeOfTheWeek.mockRejectedValue(new Error('Network error'));
    await init();
    expect(getEl('#cotw-section').collapse).toHaveBeenCalled();
  });

  it('does not throw on any error path', async () => {
    getChallengeOfTheWeek.mockRejectedValue(new Error('fail'));
    await expect(init()).resolves.toBeUndefined();
  });

  it('handles missing description gracefully', async () => {
    getChallengeOfTheWeek.mockResolvedValue({
      success: true,
      challenge: { ...COTW_CHALLENGE, description: null },
    });
    await init();
    expect(getEl('#cotw-description').text).toBe('');
  });

  it('handles missing imageUrl gracefully', async () => {
    getChallengeOfTheWeek.mockResolvedValue({
      success: true,
      challenge: { ...COTW_CHALLENGE, imageUrl: null },
    });
    await init();
    expect(getEl('#cotw-image').collapse).toHaveBeenCalled();
  });
});
