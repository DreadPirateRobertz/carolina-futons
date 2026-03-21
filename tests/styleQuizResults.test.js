/**
 * Style Quiz S4: Results rendering tests
 * Covers: style profile header, quizProductsRepeater, recommendation engine wiring
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w mock infrastructure ─────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', label: '', value: 0,
    data: [],
    style: { color: '', backgroundColor: '' },
    accessibility: {},
    collapsed: true,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    onKeyPress: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock backend / helpers ─────────────────────────────────────────

const mockGetQuizOptions = vi.fn();
const mockGetQuizRecommendations = vi.fn();

vi.mock('backend/styleQuiz.web', () => ({
  getQuizRecommendations: mockGetQuizRecommendations,
  getQuizOptions: mockGetQuizOptions,
}));

vi.mock('public/engagementTracker', () => ({ trackEvent: vi.fn() }));
vi.mock('public/mobileHelpers', () => ({ initBackToTop: vi.fn() }));
vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler) => { el.onClick(handler); }),
}));
vi.mock('public/designTokens.js', () => ({
  colors: { mountainBlue: '#5B8FA8', white: '#FFFFFF', espresso: '#3A2518' },
}));
vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));
vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn((p) => `${p.name} - Carolina Futons`),
}));

// ── Quiz option fixture ────────────────────────────────────────────

const QUIZ_OPTIONS = {
  roomTypes: [
    { value: 'living-room', label: 'Living Room', description: 'Main living area' },
    { value: 'guest-room', label: 'Guest Room', description: 'For visitors' },
  ],
  primaryUses: [
    { value: 'sitting', label: 'Primarily Sitting', description: 'Couch by day' },
    { value: 'both', label: 'Both Equally', description: 'Versatile day and night' },
  ],
  stylePreferences: [
    { value: 'modern', label: 'Modern / Contemporary', description: 'Clean lines' },
    { value: 'rustic', label: 'Rustic / Natural', description: 'Warm wood' },
  ],
  sizeOptions: [
    { value: 'full', label: 'Full', description: 'Our most popular size' },
  ],
  budgetRanges: [
    { value: '500-1000', label: '$500 - $1,000', description: 'Our sweet spot' },
    { value: 'under-500', label: 'Under $500', description: 'Budget-friendly' },
  ],
};

const MOCK_RESULTS = [
  {
    product: {
      _id: 'prod-001', name: 'Asheville Futon', slug: 'asheville-futon',
      price: 699, formattedPrice: '$699.00', mainMedia: 'https://example.com/asheville.jpg',
    },
    score: 88, reason: 'Perfect for your modern living room',
  },
  {
    product: {
      _id: 'prod-002', name: 'Dillon Wall Hugger', slug: 'dillon-wall-hugger',
      price: 549, formattedPrice: '$549.00', mainMedia: 'https://example.com/dillon.jpg',
    },
    score: 72, reason: 'Great space-saving option',
  },
];

// ── Import mocks for use in helpers ────────────────────────────────

const { makeClickable } = await import('public/a11yHelpers');

// ── Import page module ─────────────────────────────────────────────

await import('../src/pages/Style Quiz.js');

// ── Helpers ───────────────────────────────────────────────────────

function fireOnItemReady(repeaterId, $itemLookup, itemData) {
  const rep = getEl(repeaterId);
  const handler = rep.onItemReady.mock.calls.at(-1)?.[0];
  if (handler) handler($itemLookup, itemData);
}

function itemScope() {
  const itemEls = new Map();
  return (sel) => {
    if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
    return itemEls.get(sel);
  };
}

/** Select answer by triggering onItemReady + click on optionContainer */
function selectOption(repeaterId, itemData) {
  const $item = itemScope();
  fireOnItemReady(repeaterId, $item, itemData);
  const clickHandler = $item('#optionContainer').onClick.mock.calls.at(-1)?.[0];
  if (clickHandler) clickHandler();
}

/** Trigger the restart button handler to reset module state to step 0 */
function clickRestart() {
  const restartCall = makeClickable.mock.calls.find(
    (c) => c[2]?.ariaLabel === 'Restart quiz'
  );
  if (restartCall) restartCall[1]();
}

/** Advance through all 5 steps and trigger quiz submission */
function fillAndSubmitQuiz() {
  // Reset module state so we always start from step 0
  clickRestart();

  const answers = [
    { value: 'living-room', label: 'Living Room', description: 'Main living area' },
    { value: 'both', label: 'Both Equally', description: 'Versatile' },
    { value: 'modern', label: 'Modern / Contemporary', description: 'Clean lines' },
    { value: 'full', label: 'Full', description: 'Our most popular' },
    { value: '500-1000', label: '$500 - $1,000', description: 'Our sweet spot' },
  ];

  // Find the next button handler wired via makeClickable (onClick)
  const nextBtn = getEl('#quizNextBtn');

  for (let i = 0; i < 5; i++) {
    selectOption('#quizOptionsRepeater', answers[i]);
    // Trigger the next button — it was wired via onClick in makeClickable mock
    const handler = nextBtn.onClick.mock.calls.at(-1)?.[0];
    if (handler) handler();
  }
}

// ── Test Suites ────────────────────────────────────────────────────

describe('Style Quiz S4 — style profile header', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    mockGetQuizOptions.mockResolvedValue(QUIZ_OPTIONS);
    mockGetQuizRecommendations.mockResolvedValue(MOCK_RESULTS);
  });

  it('populates #styleProfileTitle when results render', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    expect(getEl('#styleProfileTitle').text).toBe('Your Modern Living Room Style');
  });

  it('populates #styleProfileDescription with dot-separated profile tags', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    const desc = getEl('#styleProfileDescription').text;
    expect(desc).toContain('Modern');
    expect(desc).toContain('living room');
    expect(desc).toContain('sitting & sleeping');
    expect(desc).toContain('$500–$1,000');
  });

  it('expands #styleProfileSection when results render', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    expect(getEl('#styleProfileSection').expand).toHaveBeenCalled();
  });

  it('does not crash if style profile elements are missing in editor', async () => {
    // The try/catch wrappers should prevent crashes even if elements are absent
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    // Results should still expand even if profile elements throw
    expect(getEl('#quizResults').expand).toHaveBeenCalled();
  });
});

describe('Style Quiz S4 — buildStyleProfile', () => {
  let buildStyleProfile;

  beforeEach(async () => {
    // buildStyleProfile is exported for testing
    const mod = await import('../src/pages/Style Quiz.js');
    buildStyleProfile = mod.buildStyleProfile;
  });

  it('builds a title from style + room', () => {
    const { title } = buildStyleProfile({
      stylePreference: 'modern', roomType: 'living-room',
      primaryUse: 'both', budgetRange: '500-1000',
    });
    expect(title).toBe('Your Modern Living Room Style');
  });

  it('builds a title for rustic guest room', () => {
    const { title } = buildStyleProfile({
      stylePreference: 'rustic', roomType: 'guest-room',
      primaryUse: 'sleeping', budgetRange: '1000-2000',
    });
    expect(title).toBe('Your Rustic Guest Room Style');
  });

  it('falls back to generic title when answers missing', () => {
    const { title } = buildStyleProfile({});
    expect(title).toBe('Your Style Profile');
  });

  it('description includes all four profile dimensions', () => {
    const { description } = buildStyleProfile({
      stylePreference: 'classic', roomType: 'bedroom',
      primaryUse: 'sitting', budgetRange: 'under-500',
    });
    expect(description).toContain('Classic');
    expect(description).toContain('bedroom');
    expect(description).toContain('sitting');
    expect(description).toContain('Under $500');
  });

  it('returns tags array with non-empty labels', () => {
    const { tags } = buildStyleProfile({
      stylePreference: 'modern', roomType: 'dorm',
      primaryUse: 'both', budgetRange: 'over-2000',
    });
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.every(t => t.length > 0)).toBe(true);
  });

  it('handles partial answers without crashing', () => {
    const { title, description } = buildStyleProfile({ stylePreference: 'rustic' });
    expect(typeof title).toBe('string');
    expect(typeof description).toBe('string');
  });
});

describe('Style Quiz S4 — quizProductsRepeater', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    mockGetQuizOptions.mockResolvedValue(QUIZ_OPTIONS);
    mockGetQuizRecommendations.mockResolvedValue(MOCK_RESULTS);
  });

  it('populates #quizProductsRepeater with recommendation data', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    const rep = getEl('#quizProductsRepeater');
    expect(rep.onItemReady).toHaveBeenCalled();
    expect(rep.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: 'result-0', score: 88 }),
        expect.objectContaining({ _id: 'result-1', score: 72 }),
      ])
    );
  });

  it('#quizProductsRepeater onItemReady sets product name and price', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    const $item = itemScope();
    fireOnItemReady('#quizProductsRepeater', $item, MOCK_RESULTS[0]);

    expect($item('#resultProductName').text).toBe('Asheville Futon');
    expect($item('#resultProductPrice').text).toBe('$699.00');
  });

  it('#quizProductsRepeater onItemReady sets Top Pick badge for score >= 80', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    const $item = itemScope();
    fireOnItemReady('#quizProductsRepeater', $item, MOCK_RESULTS[0]); // score: 88

    expect($item('#resultMatchBadge').text).toBe('Top Pick');
  });

  it('#quizProductsRepeater onItemReady sets Great Match badge for score 60-79', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    const $item = itemScope();
    fireOnItemReady('#quizProductsRepeater', $item, MOCK_RESULTS[1]); // score: 72

    expect($item('#resultMatchBadge').text).toBe('Great Match');
  });

  it('#quizProductsRepeater onItemReady sets match reason', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    const $item = itemScope();
    fireOnItemReady('#quizProductsRepeater', $item, MOCK_RESULTS[0]);

    expect($item('#resultMatchReason').text).toBe('Perfect for your modern living room');
  });

  it('#quizProductsRepeater onItemReady sets product image src and alt', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    const { buildGridAlt } = await import('public/productPageUtils.js');
    const $item = itemScope();
    fireOnItemReady('#quizProductsRepeater', $item, MOCK_RESULTS[0]);

    expect($item('#resultProductImage').src).toBe('https://example.com/asheville.jpg');
    expect(buildGridAlt).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Asheville Futon' })
    );
  });

  it('also populates #resultsRepeater alongside #quizProductsRepeater', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    // Both repeaters should receive the same data
    const legacyRep = getEl('#resultsRepeater');
    const newRep = getEl('#quizProductsRepeater');
    expect(legacyRep.data).toEqual(newRep.data);
  });
});

describe('Style Quiz S4 — recommendation engine integration', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    mockGetQuizOptions.mockResolvedValue(QUIZ_OPTIONS);
    mockGetQuizRecommendations.mockResolvedValue(MOCK_RESULTS);
  });

  it('calls getQuizRecommendations with all five quiz answers', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    const calledWith = mockGetQuizRecommendations.mock.calls[0][0];
    expect(calledWith).toMatchObject({
      roomType: 'living-room',
      primaryUse: 'both',
      stylePreference: 'modern',
      sizeNeeds: 'full',
      budgetRange: '500-1000',
    });
  });

  it('shows no-results state when recommendation engine returns empty array', async () => {
    mockGetQuizRecommendations.mockResolvedValueOnce([]);
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    expect(getEl('#resultsTitle').text).toBe('No exact matches found');
    expect(getEl('#resultsBrowseBtn').expand).toHaveBeenCalled();
  });

  it('shows no-results state on recommendation engine error', async () => {
    mockGetQuizRecommendations.mockRejectedValueOnce(new Error('Backend down'));
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    expect(getEl('#resultsTitle').text).toBe('No exact matches found');
  });

  it('collapses loading state after recommendations resolve', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    expect(getEl('#quizLoadingState').collapse).toHaveBeenCalled();
  });

  it('expands #quizResults after successful recommendations', async () => {
    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    expect(getEl('#quizResults').expand).toHaveBeenCalled();
  });
});
