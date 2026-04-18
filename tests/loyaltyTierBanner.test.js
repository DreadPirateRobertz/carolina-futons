/**
 * Tests for LoyaltyTierBanner.js — CF-7bl
 * Tier XP progress, badge, and active perks on the member account page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockGetTierBadgeIcon,
  mockBuildStreakChipText,
  mockShouldShowStreakChip,
} = vi.hoisted(() => ({
  mockGetTierBadgeIcon:      vi.fn(),
  mockBuildStreakChipText:    vi.fn(),
  mockShouldShowStreakChip:   vi.fn(),
}));

vi.mock('../src/public/badgeIcons', () => ({
  getTierBadgeIcon: mockGetTierBadgeIcon,
}));

vi.mock('../src/public/StreakDisplay', () => ({
  buildStreakChipText:  mockBuildStreakChipText,
  shouldShowStreakChip: mockShouldShowStreakChip,
}));

// gamificationEventReceiver.web — injected via opts in tests, but mock the
// default import path so module loads without error in the test environment.
vi.mock('backend/gamificationEventReceiver.web', () => ({
  getMemberTier: vi.fn(),
  getStreakData:  vi.fn(),
}));

import { initLoyaltyTierBanner } from '../src/public/LoyaltyTierBanner.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text:  '',
    html:  '',
    show:  vi.fn(),
    hide:  vi.fn(),
    style: { width: '' },
    ...overrides,
  };
}

function makeRepeaterEl() {
  return {
    onItemReady: vi.fn(),
    data:        null,
    show:        vi.fn(),
    hide:        vi.fn(),
  };
}

function makeElements() {
  const elements = {
    '#tierBannerSection':  makeEl(),
    '#tierBadgeIcon':      makeEl(),
    '#tierName':           makeEl(),
    '#tierXpLabel':        makeEl(),
    '#tierXpFill':         makeEl(),
    '#tierNextLabel':      makeEl(),
    '#tierPerksRepeater':  makeRepeaterEl(),
    '#tierStreakText':      makeEl(),
  };
  return {
    $w:       (id) => elements[id] || makeEl(),
    elements,
  };
}

function makeTier(overrides = {}) {
  return {
    tierName:        'Mountain Guide',
    pointsInTier:    450,
    pointsToNextTier: 50,
    nextTierName:    'Summit Master',
    benefits:        ['10% discount', 'Free shipping', 'Early access'],
    ...overrides,
  };
}

function makeStreak(overrides = {}) {
  return { currentStreak: 7, ...overrides };
}

function makeOpts(tierOverrides = {}, streakOverrides = {}) {
  const { $w, elements } = makeElements();
  return {
    opts: {
      $w,
      getCurrentMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }),
      getMemberTier:    vi.fn().mockResolvedValue(makeTier(tierOverrides)),
      getStreakData:     vi.fn().mockResolvedValue(makeStreak(streakOverrides)),
    },
    elements,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTierBadgeIcon.mockReturnValue(null);
  mockShouldShowStreakChip.mockReturnValue(false);
  mockBuildStreakChipText.mockReturnValue('');
});

// ── Guest / auth-error path ───────────────────────────────────────────────────

describe('initLoyaltyTierBanner — guest / auth error', () => {
  it('keeps banner hidden when getCurrentMember returns null', async () => {
    const { $w, elements } = makeElements();
    await initLoyaltyTierBanner({
      $w,
      getCurrentMember: vi.fn().mockResolvedValue(null),
      getMemberTier:    vi.fn(),
      getStreakData:     vi.fn(),
    });
    expect(elements['#tierBannerSection'].show).not.toHaveBeenCalled();
  });

  it('keeps banner hidden when getCurrentMember throws', async () => {
    const { $w, elements } = makeElements();
    await initLoyaltyTierBanner({
      $w,
      getCurrentMember: vi.fn().mockRejectedValue(new Error('auth error')),
      getMemberTier:    vi.fn(),
      getStreakData:     vi.fn(),
    });
    expect(elements['#tierBannerSection'].show).not.toHaveBeenCalled();
  });

  it('keeps banner hidden when getMemberTier fails', async () => {
    const { $w, elements } = makeElements();
    await initLoyaltyTierBanner({
      $w,
      getCurrentMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }),
      getMemberTier:    vi.fn().mockRejectedValue(new Error('service down')),
      getStreakData:     vi.fn().mockResolvedValue(makeStreak()),
    });
    expect(elements['#tierBannerSection'].show).not.toHaveBeenCalled();
  });

  it('starts with banner hidden', async () => {
    const { opts, elements } = makeOpts();
    // hide is called before async operations
    const hideSpy = elements['#tierBannerSection'].hide;
    await initLoyaltyTierBanner(opts);
    expect(hideSpy).toHaveBeenCalled();
  });
});

// ── Member — banner shown ─────────────────────────────────────────────────────

describe('initLoyaltyTierBanner — banner visibility for members', () => {
  it('shows banner for authenticated member with tier data', async () => {
    const { opts, elements } = makeOpts();
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierBannerSection'].show).toHaveBeenCalled();
  });

  it('calls getMemberTier with memberId', async () => {
    const { opts } = makeOpts();
    await initLoyaltyTierBanner(opts);
    expect(opts.getMemberTier).toHaveBeenCalledWith('mem-1');
  });

  it('calls getStreakData with memberId', async () => {
    const { opts } = makeOpts();
    await initLoyaltyTierBanner(opts);
    expect(opts.getStreakData).toHaveBeenCalledWith('mem-1');
  });
});

// ── Tier name ─────────────────────────────────────────────────────────────────

describe('initLoyaltyTierBanner — tier name', () => {
  it('renders Trail Blazer tier name', async () => {
    const { opts, elements } = makeOpts({ tierName: 'Trail Blazer' });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierName'].text).toBe('Trail Blazer');
  });

  it('renders Mountain Guide tier name', async () => {
    const { opts, elements } = makeOpts({ tierName: 'Mountain Guide' });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierName'].text).toBe('Mountain Guide');
  });

  it('renders Summit Master tier name', async () => {
    const { opts, elements } = makeOpts({ tierName: 'Summit Master' });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierName'].text).toBe('Summit Master');
  });

  it('renders Blue Ridge Legend tier name', async () => {
    const { opts, elements } = makeOpts({ tierName: 'Blue Ridge Legend' });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierName'].text).toBe('Blue Ridge Legend');
  });
});

// ── Badge icon ────────────────────────────────────────────────────────────────

describe('initLoyaltyTierBanner — badge icon', () => {
  it('sets html when getTierBadgeIcon returns an SVG', async () => {
    mockGetTierBadgeIcon.mockReturnValue('<svg>badge</svg>');
    const { opts, elements } = makeOpts();
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierBadgeIcon'].html).toBe('<svg>badge</svg>');
  });

  it('falls back to tier name text when getTierBadgeIcon returns null', async () => {
    mockGetTierBadgeIcon.mockReturnValue(null);
    const { opts, elements } = makeOpts({ tierName: 'Mountain Guide' });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierBadgeIcon'].text).toBe('Mountain Guide');
  });

  it('calls getTierBadgeIcon with the current tier name', async () => {
    const { opts } = makeOpts({ tierName: 'Summit Master' });
    await initLoyaltyTierBanner(opts);
    expect(mockGetTierBadgeIcon).toHaveBeenCalledWith('Summit Master');
  });
});

// ── XP progress ───────────────────────────────────────────────────────────────

describe('initLoyaltyTierBanner — XP progress', () => {
  it('renders XP label with next tier name', async () => {
    const { opts, elements } = makeOpts({
      pointsInTier: 450, pointsToNextTier: 50, nextTierName: 'Summit Master',
    });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierXpLabel'].text).toBe('450 / 500 XP to Summit Master');
  });

  it('renders XP label for max tier (no nextTierName)', async () => {
    const { opts, elements } = makeOpts({
      pointsInTier: 1200, pointsToNextTier: 0, nextTierName: undefined,
    });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierXpLabel'].text).toBe('1200 XP — max tier reached');
  });

  it('sets progress bar width to computed percentage', async () => {
    const { opts, elements } = makeOpts({
      pointsInTier: 300, pointsToNextTier: 700,
    });
    await initLoyaltyTierBanner(opts);
    // 300 / 1000 = 30%
    expect(elements['#tierXpFill'].style.width).toBe('30%');
  });

  it('sets progress bar to 100% at max tier', async () => {
    const { opts, elements } = makeOpts({
      pointsInTier: 1200, pointsToNextTier: 0, nextTierName: undefined,
    });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierXpFill'].style.width).toBe('100%');
  });
});

// ── Next tier label ───────────────────────────────────────────────────────────

describe('initLoyaltyTierBanner — next tier label', () => {
  it('renders "Next tier: <name>" when not max tier', async () => {
    const { opts, elements } = makeOpts({ nextTierName: 'Summit Master' });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierNextLabel'].text).toBe('Next tier: Summit Master');
  });

  it('renders "Max tier reached" when no next tier', async () => {
    const { opts, elements } = makeOpts({
      nextTierName: undefined, pointsToNextTier: 0,
    });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierNextLabel'].text).toBe('Max tier reached');
  });
});

// ── Perks repeater ────────────────────────────────────────────────────────────

describe('initLoyaltyTierBanner — perks repeater', () => {
  it('sets repeater data with top-3 perks', async () => {
    const benefits = ['10% discount', 'Free shipping', 'Early access', 'Gift wrapping'];
    const { opts, elements } = makeOpts({ benefits });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierPerksRepeater'].data).toHaveLength(3);
  });

  it('caps perks at 3 even when more are available', async () => {
    const benefits = ['A', 'B', 'C', 'D', 'E'];
    const { opts, elements } = makeOpts({ benefits });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierPerksRepeater'].data).toHaveLength(3);
  });

  it('renders fewer than 3 perks when tier has only 2 benefits', async () => {
    const benefits = ['10% discount', 'Free shipping'];
    const { opts, elements } = makeOpts({ benefits });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierPerksRepeater'].data).toHaveLength(2);
  });

  it('maps benefit strings to { _id, text } objects', async () => {
    const benefits = ['10% discount', 'Free shipping', 'Early access'];
    const { opts, elements } = makeOpts({ benefits });
    await initLoyaltyTierBanner(opts);
    const data = elements['#tierPerksRepeater'].data;
    expect(data[0]).toMatchObject({ text: '10% discount' });
    expect(data[1]).toMatchObject({ text: 'Free shipping' });
    expect(data[2]).toMatchObject({ text: 'Early access' });
  });

  it('registers onItemReady on repeater', async () => {
    const { opts, elements } = makeOpts();
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierPerksRepeater'].onItemReady).toHaveBeenCalled();
  });

  it('handles empty benefits array without throwing', async () => {
    const { opts } = makeOpts({ benefits: [] });
    await expect(initLoyaltyTierBanner(opts)).resolves.toBeUndefined();
  });
});

// ── Streak chip ───────────────────────────────────────────────────────────────

describe('initLoyaltyTierBanner — streak chip', () => {
  it('shows streak text when shouldShowStreakChip returns true', async () => {
    mockShouldShowStreakChip.mockReturnValue(true);
    mockBuildStreakChipText.mockReturnValue('🔥 7-day streak');
    const { opts, elements } = makeOpts({}, { currentStreak: 7 });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierStreakText'].text).toBe('🔥 7-day streak');
    expect(elements['#tierStreakText'].show).toHaveBeenCalled();
  });

  it('hides streak text when shouldShowStreakChip returns false', async () => {
    mockShouldShowStreakChip.mockReturnValue(false);
    const { opts, elements } = makeOpts({}, { currentStreak: 0 });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierStreakText'].hide).toHaveBeenCalled();
  });

  it('passes streak days to shouldShowStreakChip', async () => {
    const { opts } = makeOpts({}, { currentStreak: 14 });
    await initLoyaltyTierBanner(opts);
    expect(mockShouldShowStreakChip).toHaveBeenCalledWith(14);
  });

  it('still shows banner when getStreakData fails', async () => {
    const { $w, elements } = makeElements();
    await initLoyaltyTierBanner({
      $w,
      getCurrentMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }),
      getMemberTier:    vi.fn().mockResolvedValue(makeTier()),
      getStreakData:     vi.fn().mockRejectedValue(new Error('streak service down')),
    });
    // Banner still shows — streak failure is non-fatal
    expect(elements['#tierBannerSection'].show).toHaveBeenCalled();
  });

  it('uses streak 0 when getStreakData fails', async () => {
    const { $w } = makeElements();
    await initLoyaltyTierBanner({
      $w,
      getCurrentMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }),
      getMemberTier:    vi.fn().mockResolvedValue(makeTier()),
      getStreakData:     vi.fn().mockRejectedValue(new Error('streak error')),
    });
    expect(mockShouldShowStreakChip).toHaveBeenCalledWith(0);
  });
});

// ── cf-4yp: cf-1y7 truthy-error baseline ─────────────────────────────────────
// The getMemberTier handler returns computeTierInfo(0) + `error: 'auth_required'`
// to keep the response shape stable for non-gating consumers. Pre-cf-4yp the
// banner treated that payload as real data and rendered a fake Trail Blazer
// badge + "500 XP to Mountain Guide" copy to viewers who couldn't be served
// real data. Truthy-check (not ===) so future codes (forbidden, rate_limited,
// ...) don't re-open the silent class. Mirrors cf-afx/cf-8qc widget pattern.
describe('initLoyaltyTierBanner — cf-4yp truthy-error branch', () => {
  it('keeps banner hidden when tier carries error: auth_required', async () => {
    const { $w, elements } = makeElements();
    await initLoyaltyTierBanner({
      $w,
      getCurrentMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }),
      getMemberTier:    vi.fn().mockResolvedValue({ ...makeTier(), error: 'auth_required' }),
      getStreakData:     vi.fn().mockResolvedValue(makeStreak()),
    });
    expect(elements['#tierBannerSection'].show).not.toHaveBeenCalled();
  });

  it('keeps banner hidden when tier carries error: forbidden', async () => {
    const { $w, elements } = makeElements();
    await initLoyaltyTierBanner({
      $w,
      getCurrentMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }),
      getMemberTier:    vi.fn().mockResolvedValue({ ...makeTier(), error: 'forbidden' }),
      getStreakData:     vi.fn().mockResolvedValue(makeStreak()),
    });
    expect(elements['#tierBannerSection'].show).not.toHaveBeenCalled();
  });

  it('keeps banner hidden when tier carries error: rate_limited', async () => {
    const { $w, elements } = makeElements();
    await initLoyaltyTierBanner({
      $w,
      getCurrentMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }),
      getMemberTier:    vi.fn().mockResolvedValue({ ...makeTier(), error: 'rate_limited' }),
      getStreakData:     vi.fn().mockResolvedValue(makeStreak()),
    });
    expect(elements['#tierBannerSection'].show).not.toHaveBeenCalled();
  });

  it('keeps banner hidden when tier carries any arbitrary error string', async () => {
    const { $w, elements } = makeElements();
    await initLoyaltyTierBanner({
      $w,
      getCurrentMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }),
      getMemberTier:    vi.fn().mockResolvedValue({ ...makeTier(), error: 'some-future-code' }),
      getStreakData:     vi.fn().mockResolvedValue(makeStreak()),
    });
    expect(elements['#tierBannerSection'].show).not.toHaveBeenCalled();
  });

  it('does not set tier name when tier carries truthy error', async () => {
    const { $w, elements } = makeElements();
    await initLoyaltyTierBanner({
      $w,
      getCurrentMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }),
      getMemberTier:    vi.fn().mockResolvedValue({ ...makeTier({ tierName: 'Trail Blazer' }), error: 'auth_required' }),
      getStreakData:     vi.fn().mockResolvedValue(makeStreak()),
    });
    expect(elements['#tierName'].text).toBe('');
  });

  it('renders normally when tier.error field is absent', async () => {
    const { opts, elements } = makeOpts({ tierName: 'Mountain Guide' });
    await initLoyaltyTierBanner(opts);
    expect(elements['#tierName'].text).toBe('Mountain Guide');
    expect(elements['#tierBannerSection'].show).toHaveBeenCalled();
  });
});
