/**
 * Style Quiz S4: prior-result banner, retake button, saveAndShowShareUrl.
 * These paths require mocking backend/styleQuizService.web which the
 * existing styleQuizResults.test.js does not cover.
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

// ── Mock backend modules ───────────────────────────────────────────

const mockGetQuizOptions = vi.fn();
const mockGetQuizRecommendations = vi.fn();
const mockSaveQuizResult = vi.fn();
const mockGetMyResult = vi.fn();

vi.mock('backend/styleQuiz.web', () => ({
  getQuizRecommendations: mockGetQuizRecommendations,
  getQuizOptions: mockGetQuizOptions,
}));

vi.mock('backend/styleQuizService.web', () => ({
  saveQuizResult: mockSaveQuizResult,
  getMyResult: mockGetMyResult,
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

// ── Import mocks for use in helpers ────────────────────────────────

const { makeClickable } = await import('public/a11yHelpers');

// ── Import page module ─────────────────────────────────────────────

await import('../src/pages/Style Quiz.js');

// ── Fixtures ──────────────────────────────────────────────────────

const QUIZ_OPTIONS = {
  roomTypes: [{ value: 'living-room', label: 'Living Room' }],
  primaryUses: [{ value: 'both', label: 'Both Equally' }],
  stylePreferences: [{ value: 'modern', label: 'Modern / Contemporary' }],
  sizeOptions: [{ value: 'full', label: 'Full' }],
  budgetRanges: [{ value: '500-1000', label: '$500 - $1,000' }],
};

const MOCK_RESULTS = [
  {
    product: {
      _id: 'prod-001', name: 'Asheville Futon', slug: 'asheville-futon',
      price: 699, formattedPrice: '$699.00', mainMedia: 'https://example.com/asheville.jpg',
    },
    score: 88, reason: 'Perfect for your modern living room',
  },
];

const PRIOR_RESULT = {
  resultTag: 'Your Modern Living Room Style',
  shareId: 'abc123xyz',
  shareUrl: 'https://www.carolinafutons.com/style-quiz/result/abc123xyz',
  answers: { roomType: 'living-room', primaryUse: 'both', stylePreference: 'modern', sizeNeeds: 'full', budgetRange: '500-1000' },
  completedAt: new Date('2026-01-20T10:00:00Z'),
};

// ── Helpers ───────────────────────────────────────────────────────

function itemScope() {
  const itemEls = new Map();
  return (sel) => {
    if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
    return itemEls.get(sel);
  };
}

function fireOnItemReady(repeaterId, $itemLookup, itemData) {
  const rep = getEl(repeaterId);
  const handler = rep.onItemReady.mock.calls.at(-1)?.[0];
  if (handler) handler($itemLookup, itemData);
}

function selectOption(repeaterId, itemData) {
  const $item = itemScope();
  fireOnItemReady(repeaterId, $item, itemData);
  const clickHandler = $item('#optionContainer').onClick.mock.calls.at(-1)?.[0];
  if (clickHandler) clickHandler();
}

function clickRestart() {
  const restartCall = makeClickable.mock.calls.find(
    (c) => c[2]?.ariaLabel === 'Restart quiz'
  );
  if (restartCall) restartCall[1]();
}

function fillAndSubmitQuiz() {
  clickRestart();
  const answers = [
    { value: 'living-room', label: 'Living Room' },
    { value: 'both', label: 'Both Equally' },
    { value: 'modern', label: 'Modern / Contemporary' },
    { value: 'full', label: 'Full' },
    { value: '500-1000', label: '$500 - $1,000' },
  ];
  const nextBtn = getEl('#quizNextBtn');
  for (let i = 0; i < 5; i++) {
    selectOption('#quizOptionsRepeater', answers[i]);
    const handler = nextBtn.onClick.mock.calls.at(-1)?.[0];
    if (handler) handler();
  }
}

// ── Prior-result banner ────────────────────────────────────────────

describe('Style Quiz S4 — prior result banner', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    mockGetQuizOptions.mockResolvedValue(QUIZ_OPTIONS);
    mockGetQuizRecommendations.mockResolvedValue(MOCK_RESULTS);
    mockSaveQuizResult.mockResolvedValue({
      shareId: 'new123',
      shareUrl: 'https://www.carolinafutons.com/style-quiz/result/new123',
    });
  });

  it('shows #priorResultBanner and collapses #quizSection when prior result exists', async () => {
    mockGetMyResult.mockResolvedValueOnce(PRIOR_RESULT);
    await onReadyHandler();

    await vi.waitFor(() => {
      expect(mockGetMyResult).toHaveBeenCalled();
    });

    expect(getEl('#priorResultBanner').expand).toHaveBeenCalled();
    expect(getEl('#quizSection').collapse).toHaveBeenCalled();
  });

  it('populates #priorResultTag with the saved resultTag', async () => {
    mockGetMyResult.mockResolvedValueOnce(PRIOR_RESULT);
    await onReadyHandler();

    await vi.waitFor(() => {
      expect(mockGetMyResult).toHaveBeenCalled();
    });

    expect(getEl('#priorResultTag').text).toBe('Your Modern Living Room Style');
  });

  it('populates #priorShareUrl with the share URL', async () => {
    mockGetMyResult.mockResolvedValueOnce(PRIOR_RESULT);
    await onReadyHandler();

    await vi.waitFor(() => {
      expect(mockGetMyResult).toHaveBeenCalled();
    });

    expect(getEl('#priorShareUrl').text).toBe(PRIOR_RESULT.shareUrl);
  });

  it('skips banner and proceeds to quiz when no prior result', async () => {
    mockGetMyResult.mockResolvedValueOnce(null);
    await onReadyHandler();

    await vi.waitFor(() => {
      expect(mockGetMyResult).toHaveBeenCalled();
    });

    expect(getEl('#priorResultBanner').expand).not.toHaveBeenCalled();
    expect(getEl('#quizSection').expand).toHaveBeenCalled();
  });

  it('proceeds to quiz when getMyResult throws', async () => {
    mockGetMyResult.mockRejectedValueOnce(new Error('network error'));
    await onReadyHandler();

    await vi.waitFor(() => {
      expect(mockGetMyResult).toHaveBeenCalled();
    });

    expect(getEl('#priorResultBanner').expand).not.toHaveBeenCalled();
    expect(getEl('#quizSection').expand).toHaveBeenCalled();
  });
});

// ── Retake button ──────────────────────────────────────────────────

describe('Style Quiz S4 — retake button', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    mockGetQuizOptions.mockResolvedValue(QUIZ_OPTIONS);
    mockGetMyResult.mockResolvedValueOnce(PRIOR_RESULT);
  });

  it('collapses #priorResultBanner and expands #quizSection on retake click', async () => {
    await onReadyHandler();

    await vi.waitFor(() => {
      expect(mockGetMyResult).toHaveBeenCalled();
    });

    // Fire the retake button onClick
    const retakeBtn = getEl('#priorRetakeBtn');
    const retakeHandler = retakeBtn.onClick.mock.calls.at(-1)?.[0];
    expect(retakeHandler).toBeDefined();
    retakeHandler();

    expect(getEl('#priorResultBanner').collapse).toHaveBeenCalled();
    expect(getEl('#quizSection').expand).toHaveBeenCalled();
  });
});

// ── saveAndShowShareUrl ────────────────────────────────────────────

describe('Style Quiz S4 — saveAndShowShareUrl', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    mockGetQuizOptions.mockResolvedValue(QUIZ_OPTIONS);
    mockGetQuizRecommendations.mockResolvedValue(MOCK_RESULTS);
    mockGetMyResult.mockResolvedValueOnce(null);
  });

  it('expands #shareSection after successful save', async () => {
    const shareUrl = 'https://www.carolinafutons.com/style-quiz/result/new123';
    mockSaveQuizResult.mockResolvedValueOnce({ shareId: 'new123', shareUrl });

    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(mockSaveQuizResult).toHaveBeenCalled();
    });

    expect(getEl('#shareSection').expand).toHaveBeenCalled();
  });

  it('populates #shareUrlText with the returned shareUrl', async () => {
    const shareUrl = 'https://www.carolinafutons.com/style-quiz/result/new123';
    mockSaveQuizResult.mockResolvedValueOnce({ shareId: 'new123', shareUrl });

    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockSaveQuizResult).toHaveBeenCalled();
    });

    expect(getEl('#shareUrlText').text).toBe(shareUrl);
  });

  it('does not expand #shareSection when saveQuizResult returns no shareUrl', async () => {
    mockSaveQuizResult.mockResolvedValueOnce({ error: 'unauthenticated' });

    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    // Allow save to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(getEl('#shareSection').expand).not.toHaveBeenCalled();
  });

  it('does not crash when saveQuizResult throws (non-member)', async () => {
    mockSaveQuizResult.mockRejectedValueOnce(new Error('Not a member'));

    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockGetQuizRecommendations).toHaveBeenCalled();
    });

    // Results still render despite save failure
    expect(getEl('#quizResults').expand).toHaveBeenCalled();
  });

  it('calls saveQuizResult with quiz answers and style profile title', async () => {
    mockSaveQuizResult.mockResolvedValueOnce({ shareId: 'x', shareUrl: 'https://x.com/x' });

    await onReadyHandler();
    fillAndSubmitQuiz();

    await vi.waitFor(() => {
      expect(mockSaveQuizResult).toHaveBeenCalled();
    });

    const [savedAnswers, savedTag] = mockSaveQuizResult.mock.calls[0];
    expect(savedAnswers).toMatchObject({ roomType: 'living-room', stylePreference: 'modern' });
    expect(typeof savedTag).toBe('string');
    expect(savedTag.length).toBeGreaterThan(0);
  });
});
