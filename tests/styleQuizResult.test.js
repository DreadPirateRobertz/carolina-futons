<<<<<<< HEAD
/**
 * styleQuizResult.test.js — Style Quiz result page controller
 * Tests for src/pages/StyleQuizResult.js
 *
 * Covers: initStyleQuizResult, storeQuizAnswers, clearQuizAnswers
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { __reset } from 'wix-storage';

// ── $w Mock Infrastructure ────────────────────────────────────────────
=======
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w mock (capture onReady, don't auto-invoke) ──────────────────────────────
>>>>>>> origin/feat/CF-4qca.1-quiz-persistence-sharing

const elements = new Map();

function createMockElement() {
  return {
<<<<<<< HEAD
    text: '',
    data: [],
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
=======
    text: '', src: '', value: '',
    collapsed: true,
    expand: vi.fn(function () { this.collapsed = false; }),
    collapse: vi.fn(function () { this.collapsed = true; }),
    onClick: vi.fn(),
>>>>>>> origin/feat/CF-4qca.1-quiz-persistence-sharing
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

<<<<<<< HEAD
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: vi.fn() }
);

// ── Backend mocks ─────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getQuizRecommendations: vi.fn(),
  getPersonalizedCopy: vi.fn(),
  safeCall: vi.fn((fn) => { try { fn(); } catch (_) {} }),
  safeCollapse: vi.fn(),
  safeExpand: vi.fn(),
  safeText: vi.fn((_w, sel, text) => { try { _w(sel).text = text; } catch (_) {} }),
}));

vi.mock('backend/styleQuiz.web', () => ({
  getQuizRecommendations: mocks.getQuizRecommendations,
  getPersonalizedCopy: mocks.getPersonalizedCopy,
}));

vi.mock('public/safeInit', () => ({
  safeCall: mocks.safeCall,
  safeCollapse: mocks.safeCollapse,
  safeExpand: mocks.safeExpand,
  safeText: mocks.safeText,
}));

// ── Import the page module ────────────────────────────────────────────

let initStyleQuizResult, storeQuizAnswers, clearQuizAnswers;

beforeAll(async () => {
  const mod = await import('../src/pages/StyleQuizResult.js');
  initStyleQuizResult = mod.initStyleQuizResult;
  storeQuizAnswers = mod.storeQuizAnswers;
  clearQuizAnswers = mod.clearQuizAnswers;
});

// ── Fixtures ──────────────────────────────────────────────────────────

const ANSWERS_KEY = 'styleQuizAnswers';

const SAMPLE_ANSWERS = {
  roomType: 'living-room',
  primaryUse: 'both',
  stylePreference: 'modern',
  budgetRange: '500-1000',
};

const SAMPLE_RECOMMENDATIONS = [
  {
    product: {
      _id: 'prod-1',
      name: 'Modern Futon Frame',
      formattedPrice: '$599',
      mainMedia: 'https://example.com/img1.jpg',
      slug: 'modern-futon-frame',
    },
    reason: 'Perfect for your living room',
    score: 85,
  },
];

beforeEach(() => {
  __reset();
  elements.clear();
  vi.clearAllMocks();
  mocks.safeCall.mockImplementation((fn) => { try { fn(); } catch (_) {} });
  mocks.safeText.mockImplementation((_w, sel, text) => { try { _w(sel).text = text; } catch (_) {} });
  mocks.getQuizRecommendations.mockResolvedValue(SAMPLE_RECOMMENDATIONS);
  mocks.getPersonalizedCopy.mockResolvedValue({ copy: 'Your living room deserves better.', profileType: 'versatile' });
});

// ── storeQuizAnswers / clearQuizAnswers ───────────────────────────────

describe('storeQuizAnswers', () => {
  it('stores answers in session storage as JSON', () => {
    storeQuizAnswers(SAMPLE_ANSWERS);
    const stored = globalThis.sessionStorage.getItem(ANSWERS_KEY);
    expect(JSON.parse(stored)).toEqual(SAMPLE_ANSWERS);
  });

  it('round-trips: stored answers are readable by initStyleQuizResult', async () => {
    storeQuizAnswers(SAMPLE_ANSWERS);
    await initStyleQuizResult($w);
    expect(mocks.getQuizRecommendations).toHaveBeenCalledWith(SAMPLE_ANSWERS);
  });
});

describe('clearQuizAnswers', () => {
  it('removes the stored answers from session storage', () => {
    storeQuizAnswers(SAMPLE_ANSWERS);
    clearQuizAnswers();
    expect(globalThis.sessionStorage.getItem(ANSWERS_KEY)).toBeNull();
  });

  it('after clear, initStyleQuizResult shows missing-answers error', async () => {
    storeQuizAnswers(SAMPLE_ANSWERS);
    clearQuizAnswers();
    await initStyleQuizResult($w);
    const errorMsg = getEl('#quizErrorMsg');
    expect(errorMsg.text).toMatch(/not found/i);
  });
});

// ── initStyleQuizResult — happy path ─────────────────────────────────

describe('initStyleQuizResult — success', () => {
  beforeEach(() => {
    storeQuizAnswers(SAMPLE_ANSWERS);
  });

  it('calls getQuizRecommendations with parsed answers', async () => {
    await initStyleQuizResult($w);
    expect(mocks.getQuizRecommendations).toHaveBeenCalledWith(SAMPLE_ANSWERS);
  });

  it('calls getPersonalizedCopy with parsed answers', async () => {
    await initStyleQuizResult($w);
    expect(mocks.getPersonalizedCopy).toHaveBeenCalledWith(SAMPLE_ANSWERS);
  });

  it('sets #quizPersonalizedCopy.text from getPersonalizedCopy response', async () => {
    await initStyleQuizResult($w);
    expect(mocks.safeText).toHaveBeenCalledWith($w, '#quizPersonalizedCopy', 'Your living room deserves better.');
  });

  it('sets #quizRepeater.data with mapped recommendation items', async () => {
    await initStyleQuizResult($w);
    const data = getEl('#quizRepeater').data;
    expect(data).toHaveLength(1);
    expect(data[0]._id).toBe('prod-1');
    expect(data[0].name).toBe('Modern Futon Frame');
    expect(data[0].price).toBe('$599');
  });

  it('expands #quizResultsSection on success', async () => {
    await initStyleQuizResult($w);
    expect(mocks.safeExpand).toHaveBeenCalledWith($w, '#quizResultsSection');
  });
});

// ── initStyleQuizResult — error paths ────────────────────────────────

describe('initStyleQuizResult — no stored answers', () => {
  it('shows error message when session storage has no answers', async () => {
    await initStyleQuizResult($w);
    const errorMsg = getEl('#quizErrorMsg');
    expect(errorMsg.text).toMatch(/not found/i);
  });

  it('does not call backend when answers are missing', async () => {
    await initStyleQuizResult($w);
    expect(mocks.getQuizRecommendations).not.toHaveBeenCalled();
  });
});

describe('initStyleQuizResult — malformed JSON', () => {
  it('shows error message when stored answers are invalid JSON', async () => {
    globalThis.sessionStorage.setItem(ANSWERS_KEY, '{not-valid-json');
    await initStyleQuizResult($w);
    const errorMsg = getEl('#quizErrorMsg');
    expect(errorMsg.text).toMatch(/could not load/i);
  });

  it('does not call backend when JSON parse fails', async () => {
    globalThis.sessionStorage.setItem(ANSWERS_KEY, '{not-valid-json');
    await initStyleQuizResult($w);
    expect(mocks.getQuizRecommendations).not.toHaveBeenCalled();
  });
});

describe('initStyleQuizResult — recommendations fetch failure', () => {
  it('shows error message when getQuizRecommendations rejects', async () => {
    storeQuizAnswers(SAMPLE_ANSWERS);
    mocks.getQuizRecommendations.mockRejectedValueOnce(new Error('Network error'));
    await initStyleQuizResult($w);
    const errorMsg = getEl('#quizErrorMsg');
    expect(errorMsg.text).toMatch(/could not load/i);
  });

  it('still shows recommendations when getPersonalizedCopy fails', async () => {
    storeQuizAnswers(SAMPLE_ANSWERS);
    mocks.getPersonalizedCopy.mockRejectedValueOnce(new Error('Copy service down'));
    await initStyleQuizResult($w);
    expect(mocks.safeExpand).toHaveBeenCalledWith($w, '#quizResultsSection');
  });

  it('uses empty string for copy when getPersonalizedCopy fails', async () => {
    storeQuizAnswers(SAMPLE_ANSWERS);
    mocks.getPersonalizedCopy.mockRejectedValueOnce(new Error('Copy service down'));
    await initStyleQuizResult($w);
    expect(mocks.safeText).toHaveBeenCalledWith($w, '#quizPersonalizedCopy', '');
  });
});

describe('initStyleQuizResult — empty recommendations', () => {
  it('shows no-results error when recommendations array is empty', async () => {
    storeQuizAnswers(SAMPLE_ANSWERS);
    mocks.getQuizRecommendations.mockResolvedValueOnce([]);
    await initStyleQuizResult($w);
    const errorMsg = getEl('#quizErrorMsg');
    expect(errorMsg.text).toMatch(/no matching products/i);
=======
let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel.startsWith('#') ? sel : `#${sel}`),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── wix-location-frontend mock ────────────────────────────────────────────────

// wixLocationFrontend.path returns string[] (array of segments), not a string.
const mockLocation = { path: [], to: vi.fn() };

function setPath(pathString) {
  mockLocation.path = pathString.split('/').filter(Boolean);
}

// ── Backend mocks ──────────────────────────────────────────────────────────────

const mockGetSharedResult = vi.fn();

vi.mock('backend/styleQuizService.web', () => ({
  getSharedResult: mockGetSharedResult,
  saveQuizResult: vi.fn(),
  getMyResult: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));
vi.mock('wix-location-frontend', () => ({ default: mockLocation, ...mockLocation }));

// Import page to register onReadyHandler
await import('../src/pages/StyleQuizResult.js');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SHARE_ID = 'abc123xyz';
const RESULT = {
  resultTag: 'Your Modern Living Room Style',
  answers: { roomType: 'living-room', primaryUse: 'both', stylePreference: 'modern', sizeNeeds: 'queen' },
  completedAt: new Date('2026-01-20T10:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  elements.clear();
});

// ── share ID extraction ────────────────────────────────────────────────────────

describe('share ID extraction from URL', () => {
  it('reads shareId from the last path segment', async () => {
    setPath(`/style-quiz/result/${SHARE_ID}`);
    mockGetSharedResult.mockResolvedValueOnce(RESULT);

    await onReadyHandler();

    expect(mockGetSharedResult).toHaveBeenCalledWith(SHARE_ID);
  });

  it('shows not-found when path ends with slash (no share segment)', async () => {
    setPath('/style-quiz/result/');
    mockGetSharedResult.mockResolvedValueOnce(null);

    await onReadyHandler();

    expect(getEl('#resultNotFound').expand).toHaveBeenCalled();
  });
});

// ── renderResult ──────────────────────────────────────────────────────────────

describe('renderResult', () => {
  beforeEach(() => {
    setPath(`/style-quiz/result/${SHARE_ID}`);
  });

  it('renders resultTag text', async () => {
    mockGetSharedResult.mockResolvedValueOnce(RESULT);

    await onReadyHandler();

    expect(getEl('#resultTag').text).toBe(RESULT.resultTag);
  });

  it('expands resultContent on success', async () => {
    mockGetSharedResult.mockResolvedValueOnce(RESULT);

    await onReadyHandler();

    expect(getEl('#resultContent').expand).toHaveBeenCalled();
  });

  it('renders a description containing style from answers', async () => {
    mockGetSharedResult.mockResolvedValueOnce(RESULT);

    await onReadyHandler();

    expect(getEl('#resultDescription').text).toContain('Modern');
  });

  it('renders completedAt as a formatted date string', async () => {
    mockGetSharedResult.mockResolvedValueOnce(RESULT);

    await onReadyHandler();

    expect(getEl('#resultDate').text).toMatch(/January 2026/);
  });

  it('wires resultShopBtn onClick', async () => {
    mockGetSharedResult.mockResolvedValueOnce(RESULT);

    await onReadyHandler();

    expect(getEl('#resultShopBtn').onClick).toHaveBeenCalled();
  });

  it('wires resultTakeQuizBtn onClick', async () => {
    mockGetSharedResult.mockResolvedValueOnce(RESULT);

    await onReadyHandler();

    expect(getEl('#resultTakeQuizBtn').onClick).toHaveBeenCalled();
  });
});

// ── applyOgMeta ───────────────────────────────────────────────────────────────

describe('applyOgMeta', () => {
  beforeEach(() => {
    setPath(`/style-quiz/result/${SHARE_ID}`);
  });

  it('sets og:title to resultTag', async () => {
    mockGetSharedResult.mockResolvedValueOnce(RESULT);

    await onReadyHandler();

    expect(getEl('#ogTitle').text).toBe(RESULT.resultTag);
  });

  it('sets og:description mentioning resultTag', async () => {
    mockGetSharedResult.mockResolvedValueOnce(RESULT);

    await onReadyHandler();

    expect(getEl('#ogDescription').text).toContain(RESULT.resultTag);
  });

  it('uses style-specific og:image for modern', async () => {
    mockGetSharedResult.mockResolvedValueOnce(RESULT);

    await onReadyHandler();

    expect(getEl('#ogImage').src).toContain('quiz-og-modern');
  });

  it('uses rustic og:image for rustic style', async () => {
    mockGetSharedResult.mockResolvedValueOnce({
      ...RESULT,
      answers: { ...RESULT.answers, stylePreference: 'rustic' },
    });

    await onReadyHandler();

    expect(getEl('#ogImage').src).toContain('quiz-og-rustic');
  });

  it('falls back to default og:image for unknown style', async () => {
    mockGetSharedResult.mockResolvedValueOnce({
      ...RESULT,
      answers: { ...RESULT.answers, stylePreference: 'industrial' },
    });

    await onReadyHandler();

    expect(getEl('#ogImage').src).toContain('quiz-og-default');
  });
});

// ── renderNotFound ────────────────────────────────────────────────────────────

describe('renderNotFound', () => {
  beforeEach(() => {
    setPath(`/style-quiz/result/bad-token`);
  });

  it('shows not-found when getSharedResult returns null', async () => {
    mockGetSharedResult.mockResolvedValueOnce(null);

    await onReadyHandler();

    expect(getEl('#resultNotFound').expand).toHaveBeenCalled();
    expect(getEl('#resultContent').expand).not.toHaveBeenCalled();
  });

  it('shows not-found when getSharedResult returns an error object', async () => {
    mockGetSharedResult.mockResolvedValueOnce({ error: 'fetch_failed' });

    await onReadyHandler();

    expect(getEl('#resultNotFound').expand).toHaveBeenCalled();
  });

  it('shows not-found when getSharedResult throws', async () => {
    mockGetSharedResult.mockRejectedValueOnce(new Error('network'));

    await onReadyHandler();

    expect(getEl('#resultNotFound').expand).toHaveBeenCalled();
  });

  it('wires notFoundBtn onClick', async () => {
    mockGetSharedResult.mockResolvedValueOnce(null);

    await onReadyHandler();

    expect(getEl('#notFoundBtn').onClick).toHaveBeenCalled();
>>>>>>> origin/feat/CF-4qca.1-quiz-persistence-sharing
  });
});
