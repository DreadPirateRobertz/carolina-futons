import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w mock (capture onReady, don't auto-invoke) ──────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', value: '',
    collapsed: true,
    expand: vi.fn(function () { this.collapsed = false; }),
    collapse: vi.fn(function () { this.collapsed = true; }),
    onClick: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel.startsWith('#') ? sel : `#${sel}`),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── wix-location-frontend mock ────────────────────────────────────────────────

const mockLocation = { path: '/', to: vi.fn() };

function setPath(path) {
  mockLocation.path = path;
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
  });
});
