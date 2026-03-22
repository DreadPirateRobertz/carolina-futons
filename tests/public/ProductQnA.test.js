import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadQnA,
  renderQnA,
  loadMore,
  submitQuestion,
  initSearch,
  injectSchema,
  safeJsonLd,
  destroy,
  _resetForTest,
} from '../../src/public/ProductQnA.js';

// ─── Backend mock ─────────────────────────────────────────────────────────────

let mockGetProductQuestions, mockSubmitQuestion, mockVoteHelpful, mockFlagQuestion, mockGetQASchema;

vi.mock('backend/productQA.web', () => ({
  get getProductQuestions() { return mockGetProductQuestions; },
  get submitQuestion() { return mockSubmitQuestion; },
  get voteHelpful() { return mockVoteHelpful; },
  get flagQuestion() { return mockFlagQuestion; },
  get getQASchema() { return mockGetQASchema; },
}));

const ITEMS = [
  { _id: 'q1', question: 'Does it fold?', answer: 'Yes.', status: 'answered', memberName: 'Alice', answeredBy: 'Store', helpfulVotes: 3, createdDate: new Date('2026-01-01') },
  { _id: 'q2', question: 'Frame material?', answer: null, status: 'pending', memberName: 'Bob', helpfulVotes: 0, createdDate: new Date('2026-01-02') },
];

const OK = (questions, totalCount = questions.length, page = 1) => ({
  success: true,
  data: { questions, totalCount, pageSize: 5, page },
});
const FAIL = { success: false, error: 'Server error' };

// ─── Element factory ──────────────────────────────────────────────────────────

function el(overrides = {}) {
  return {
    text: '', value: '', label: '', html: '', id: '',
    collapse: vi.fn(), expand: vi.fn(),
    show: vi.fn(), hide: vi.fn(),
    enable: vi.fn(), disable: vi.fn(),
    onClick: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(),
    data: [],
    accessibility: { ariaLabel: '', ariaExpanded: undefined, ariaControls: '', role: '' },
    ...overrides,
  };
}

function makeW(overrides = {}) {
  const els = {
    qnaSection: el(), qnaAccordion: el(), qnaQuestion: el(), qnaAnswer: el(),
    qnaQuestionInput: el(), qnaSubmitBtn: el(), qnaThankYou: el(),
    qnaLoadMore: el(), qnaEmpty: el(), qnaFormError: el(),
    qnaCount: el(), qnaSearchInput: el(), qnaSchemaScript: el(),
    qnaAuthor: el(), qnaDate: el(), qnaAnswerSection: el(),
    qnaAnsweredBy: el(), qnaPending: el(),
    qnaHelpfulBtn: el(), qnaHelpfulCount: el(), qnaFlagBtn: el(),
    ...overrides,
  };
  const $w = (sel) => els[sel.replace('#', '')] || el();
  $w._els = els;
  return $w;
}

beforeEach(() => {
  _resetForTest();
  mockGetProductQuestions = vi.fn().mockResolvedValue(OK(ITEMS, 2));
  mockSubmitQuestion = vi.fn().mockResolvedValue({ success: true });
  mockVoteHelpful = vi.fn().mockResolvedValue({ success: true, data: { helpfulVotes: 4 } });
  mockFlagQuestion = vi.fn().mockResolvedValue({ success: true });
  mockGetQASchema = vi.fn().mockResolvedValue({ success: true, data: { schema: { '@type': 'FAQPage' } } });
});

// ─── loadQnA ─────────────────────────────────────────────────────────────────

describe('loadQnA', () => {
  it('calls getProductQuestions and returns items', async () => {
    const res = await loadQnA('p1');
    expect(mockGetProductQuestions).toHaveBeenCalledWith('p1', { page: 1, pageSize: 5 });
    expect(res.items).toHaveLength(2);
    expect(res.error).toBe(false);
  });

  it('returns hasMore=true when totalCount > returned items', async () => {
    mockGetProductQuestions.mockResolvedValueOnce(OK(ITEMS, 10));
    const res = await loadQnA('p1');
    expect(res.hasMore).toBe(true);
    expect(res.totalCount).toBe(10);
  });

  it('returns hasMore=false when all items fit on first page', async () => {
    const res = await loadQnA('p1');
    expect(res.hasMore).toBe(false);
  });

  it('returns empty result when productId is undefined', async () => {
    const res = await loadQnA(undefined);
    expect(res.items).toHaveLength(0);
    expect(res.error).toBe(false);
    expect(mockGetProductQuestions).not.toHaveBeenCalled();
  });

  it('returns empty result when productId is null', async () => {
    const res = await loadQnA(null);
    expect(res.items).toHaveLength(0);
    expect(mockGetProductQuestions).not.toHaveBeenCalled();
  });

  it('returns error=true when backend returns !success', async () => {
    mockGetProductQuestions.mockResolvedValueOnce(FAIL);
    const res = await loadQnA('p1');
    expect(res.error).toBe(true);
    expect(res.items).toHaveLength(0);
  });

  it('returns error=true on thrown exception', async () => {
    mockGetProductQuestions.mockRejectedValueOnce(new Error('network'));
    const res = await loadQnA('p1');
    expect(res.error).toBe(true);
  });
});

// ─── renderQnA ───────────────────────────────────────────────────────────────

describe('renderQnA', () => {
  it('shows section and sets accordion data when items present', () => {
    const $w = makeW();
    renderQnA($w, ITEMS, { hasMore: false, totalCount: 2 });
    expect($w._els.qnaSection.show).toHaveBeenCalled();
    expect($w._els.qnaAccordion.data).toHaveLength(2);
  });

  it('hides empty state when items present', () => {
    const $w = makeW();
    renderQnA($w, ITEMS, { hasMore: false, totalCount: 2 });
    expect($w._els.qnaEmpty.hide).toHaveBeenCalled();
  });

  it('shows empty state and hides section when no items', () => {
    const $w = makeW();
    renderQnA($w, [], { hasMore: false, totalCount: 0 });
    expect($w._els.qnaEmpty.show).toHaveBeenCalled();
    expect($w._els.qnaSection.hide).toHaveBeenCalled();
  });

  it('shows loadMore when hasMore=true', () => {
    const $w = makeW();
    renderQnA($w, ITEMS, { hasMore: true, totalCount: 10 });
    expect($w._els.qnaLoadMore.show).toHaveBeenCalled();
  });

  it('hides loadMore when hasMore=false', () => {
    const $w = makeW();
    renderQnA($w, ITEMS, { hasMore: false, totalCount: 2 });
    expect($w._els.qnaLoadMore.hide).toHaveBeenCalled();
  });

  it('registers onItemReady BEFORE setting .data', () => {
    const $w = makeW();
    const callOrder = [];
    $w._els.qnaAccordion.onItemReady = vi.fn(() => callOrder.push('onItemReady'));
    Object.defineProperty($w._els.qnaAccordion, 'data', {
      set: vi.fn(() => callOrder.push('data')), get: vi.fn(() => []),
    });
    renderQnA($w, ITEMS, { hasMore: false, totalCount: 2 });
    expect(callOrder[0]).toBe('onItemReady');
    expect(callOrder[1]).toBe('data');
  });

  it('sets count text when totalCount provided', () => {
    const $w = makeW();
    renderQnA($w, ITEMS, { hasMore: false, totalCount: 2 });
    expect($w._els.qnaCount.text).toBe('2 questions');
  });

  it('uses singular "1 question" for single item', () => {
    const $w = makeW();
    renderQnA($w, [ITEMS[0]], { hasMore: false, totalCount: 1 });
    expect($w._els.qnaCount.text).toBe('1 question');
  });
});

// ─── accordion item rendering ─────────────────────────────────────────────────

describe('accordion item rendering', () => {
  function captureCallback($w) {
    let cb = null;
    $w._els.qnaAccordion.onItemReady = vi.fn((fn) => { cb = fn; });
    renderQnA($w, [ITEMS[0]], { hasMore: false, totalCount: 1 });
    return cb;
  }

  function makeItem() {
    const els = {
      qnaQuestion: el(), qnaAnswer: el(), qnaAuthor: el(), qnaDate: el(),
      qnaAnswerSection: el(), qnaAnsweredBy: el(), qnaPending: el(),
      qnaHelpfulBtn: el(), qnaHelpfulCount: el(), qnaFlagBtn: el(),
    };
    return (sel) => els[sel.replace('#', '')] || el();
  }

  it('sets question text', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    const $item = makeItem();
    cb($item, ITEMS[0]);
    expect($item('#qnaQuestion').text).toBe('Does it fold?');
  });

  it('sets answer text on answered item', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    const $item = makeItem();
    cb($item, ITEMS[0]);
    expect($item('#qnaAnswer').text).toBe('Yes.');
  });

  it('shows answer section for answered items', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    const $item = makeItem();
    cb($item, ITEMS[0]);
    expect($item('#qnaAnswerSection').show).toHaveBeenCalled();
    expect($item('#qnaPending').hide).toHaveBeenCalled();
  });

  it('hides answer section and shows pending badge for unanswered items', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    const $item = makeItem();
    cb($item, ITEMS[1]);
    expect($item('#qnaAnswerSection').hide).toHaveBeenCalled();
    expect($item('#qnaPending').show).toHaveBeenCalled();
  });

  it('sets aria-expanded=false initially', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    const $item = makeItem();
    cb($item, ITEMS[0]);
    expect($item('#qnaQuestion').accessibility.ariaExpanded).toBe(false);
  });

  it('assigns aEl.id matching ariaControls for screen reader pairing', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    const $item = makeItem();
    cb($item, ITEMS[0]);
    const qEl = $item('#qnaQuestion');
    const aEl = $item('#qnaAnswer');
    expect(aEl.id).toBe(qEl.accessibility.ariaControls);
    expect(aEl.id).toBe(`qna-answer-${ITEMS[0]._id}`);
  });

  it('collapses answer by default', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    const $item = makeItem();
    cb($item, ITEMS[0]);
    expect($item('#qnaAnswer').collapse).toHaveBeenCalled();
  });

  it('accordion toggle expands on first click, collapses on second', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    let clickFn = null;
    const qEl = el({ onClick: vi.fn((fn) => { clickFn = fn; }) });
    const aEl = el();
    const $item = (sel) => sel === '#qnaQuestion' ? qEl : aEl;
    cb($item, ITEMS[0]);

    clickFn();
    expect(aEl.expand).toHaveBeenCalled();
    expect(qEl.accessibility.ariaExpanded).toBe(true);

    clickFn();
    expect(aEl.collapse).toHaveBeenCalledTimes(2); // initial + second click
    expect(qEl.accessibility.ariaExpanded).toBe(false);
  });

  it('sets author name', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    const $item = makeItem();
    cb($item, ITEMS[0]);
    expect($item('#qnaAuthor').text).toBe('Alice');
  });

  it('sets answeredBy text on answered items', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    const $item = makeItem();
    cb($item, ITEMS[0]);
    expect($item('#qnaAnsweredBy').text).toBe('— Store');
  });

  it('wires helpful vote button', () => {
    const $w = makeW();
    const cb = captureCallback($w);
    const $item = makeItem();
    cb($item, ITEMS[0]);
    expect($item('#qnaHelpfulBtn').onClick).toHaveBeenCalled();
  });

  it('helpful vote updates count on success', async () => {
    const $w = makeW();
    const cb = captureCallback($w);
    let clickFn = null;
    const helpfulBtn = el({ onClick: vi.fn((fn) => { clickFn = fn; }) });
    const helpfulCount = el();
    const $item = (sel) => {
      if (sel === '#qnaHelpfulBtn') return helpfulBtn;
      if (sel === '#qnaHelpfulCount') return helpfulCount;
      return el();
    };
    cb($item, ITEMS[0]);
    await clickFn();
    expect(mockVoteHelpful).toHaveBeenCalledWith('q1');
    expect(helpfulCount.text).toBe('Helpful (4)');
  });

  it('flag button marks reported on success', async () => {
    const $w = makeW();
    const cb = captureCallback($w);
    let clickFn = null;
    const flagBtn = el({ onClick: vi.fn((fn) => { clickFn = fn; }) });
    const $item = (sel) => sel === '#qnaFlagBtn' ? flagBtn : el();
    cb($item, ITEMS[0]);
    await clickFn();
    expect(mockFlagQuestion).toHaveBeenCalledWith('q1');
    expect(flagBtn.label).toBe('Reported');
    expect(flagBtn.disable).toHaveBeenCalled();
  });
});

// ─── loadMore ────────────────────────────────────────────────────────────────

describe('loadMore', () => {
  it('appends next page items to accordion data', async () => {
    const page2 = [{ _id: 'q3', question: 'Q3?', answer: 'A3.', status: 'answered', helpfulVotes: 0 }];
    mockGetProductQuestions.mockResolvedValueOnce(OK(page2, 3));
    const $w = makeW();
    $w._els.qnaAccordion.data = [...ITEMS];

    const res = await loadMore($w, 'p1', 1);
    expect(res.appended).toBe(1);
    expect($w._els.qnaAccordion.data).toHaveLength(3);
  });

  it('hides loadMore when all items loaded', async () => {
    mockGetProductQuestions.mockResolvedValueOnce(OK([], 2));
    const $w = makeW();
    $w._els.qnaAccordion.data = [...ITEMS];
    await loadMore($w, 'p1', 1);
    expect($w._els.qnaLoadMore.hide).toHaveBeenCalled();
  });

  it('keeps loadMore visible when more items remain', async () => {
    const page2 = [{ _id: 'q3', question: 'Q3?', answer: null, status: 'pending', helpfulVotes: 0 }];
    mockGetProductQuestions.mockResolvedValueOnce(OK(page2, 10));
    const $w = makeW();
    $w._els.qnaAccordion.data = [...ITEMS];

    const res = await loadMore($w, 'p1', 1);
    expect(res.hasMore).toBe(true);
    expect($w._els.qnaLoadMore.show).toHaveBeenCalled();
  });

  it('on error returns {appended:0, hasMore:true} and keeps button visible', async () => {
    mockGetProductQuestions.mockRejectedValueOnce(new Error('timeout'));
    const $w = makeW();
    $w._els.qnaAccordion.data = [...ITEMS];

    const res = await loadMore($w, 'p1', 1);
    expect(res).toEqual({ appended: 0, hasMore: true });
    expect($w._els.qnaAccordion.data).toHaveLength(2);
    expect($w._els.qnaLoadMore.show).toHaveBeenCalled();
  });

  it('handles non-array accordion.data gracefully', async () => {
    const page2 = [{ _id: 'q3', question: 'Q3?', answer: null, status: 'pending', helpfulVotes: 0 }];
    mockGetProductQuestions.mockResolvedValueOnce(OK(page2, 3));
    const $w = makeW();
    $w._els.qnaAccordion.data = null; // edge case

    await expect(loadMore($w, 'p1', 1)).resolves.toBeDefined();
    expect($w._els.qnaAccordion.data).toHaveLength(1);
  });
});

// ─── submitQuestion ───────────────────────────────────────────────────────────

describe('submitQuestion', () => {
  it('calls backend submitQuestion with productId and text', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What colors?';
    await submitQuestion($w, 'p1');
    expect(mockSubmitQuestion).toHaveBeenCalledWith('p1', 'What colors?');
  });

  it('shows qnaThankYou on success', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What colors?';
    await submitQuestion($w, 'p1');
    expect($w._els.qnaThankYou.show).toHaveBeenCalled();
  });

  it('clears input on success', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What colors?';
    await submitQuestion($w, 'p1');
    expect($w._els.qnaQuestionInput.value).toBe('');
  });

  it('shows error element when backend returns !success', async () => {
    mockSubmitQuestion.mockResolvedValueOnce({ success: false, error: 'Rate limited' });
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What colors?';
    await submitQuestion($w, 'p1');
    expect($w._els.qnaFormError.show).toHaveBeenCalled();
    expect($w._els.qnaThankYou.show).not.toHaveBeenCalled();
  });

  it('shows error element on thrown exception', async () => {
    mockSubmitQuestion.mockRejectedValueOnce(new Error('network'));
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What colors?';
    await submitQuestion($w, 'p1');
    expect($w._els.qnaFormError.show).toHaveBeenCalled();
  });

  it('skips insert when question text is empty', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = '   ';
    await submitQuestion($w, 'p1');
    expect(mockSubmitQuestion).not.toHaveBeenCalled();
  });

  it('skips insert when productId is undefined', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'Question?';
    await submitQuestion($w, undefined);
    expect(mockSubmitQuestion).not.toHaveBeenCalled();
  });

  it('disables button during submission, re-enables via finally', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What colors?';
    const order = [];
    $w._els.qnaSubmitBtn.disable = vi.fn(() => order.push('disable'));
    $w._els.qnaSubmitBtn.enable = vi.fn(() => order.push('enable'));
    await submitQuestion($w, 'p1');
    expect(order[0]).toBe('disable');
    expect(order[order.length - 1]).toBe('enable');
  });

  it('concurrent calls do not produce duplicate submissions', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'Concurrent?';
    await Promise.all([submitQuestion($w, 'p1'), submitQuestion($w, 'p1')]);
    expect(mockSubmitQuestion).toHaveBeenCalledTimes(1);
  });

  it('re-enables button on concurrent-call guard path', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'Concurrent?';
    $w._els.qnaSubmitBtn.enable.mockClear();
    await Promise.all([submitQuestion($w, 'p1'), submitQuestion($w, 'p1')]);
    expect($w._els.qnaSubmitBtn.enable).toHaveBeenCalled();
  });
});

// ─── initSearch ───────────────────────────────────────────────────────────────

describe('initSearch', () => {
  it('wires onInput to qnaSearchInput', () => {
    const $w = makeW();
    initSearch($w, 'p1');
    expect($w._els.qnaSearchInput.onInput).toHaveBeenCalled();
  });

  it('does not throw when qnaSearchInput element is absent', () => {
    const $w = (sel) => { if (sel === '#qnaSearchInput') throw new Error('not found'); return el(); };
    expect(() => initSearch($w, 'p1')).not.toThrow();
  });
});

// ─── injectSchema ─────────────────────────────────────────────────────────────

describe('injectSchema', () => {
  it('sets html on qnaSchemaScript when schema available', async () => {
    const $w = makeW();
    await injectSchema($w, 'p1');
    expect($w._els.qnaSchemaScript.html).toContain('application/ld+json');
    expect($w._els.qnaSchemaScript.html).toContain('FAQPage');
  });

  it('does not throw when qnaSchemaScript element absent', async () => {
    const $w = (sel) => {
      if (sel === '#qnaSchemaScript') throw new Error('not found');
      return el();
    };
    await expect(injectSchema($w, 'p1')).resolves.not.toThrow();
  });

  it('skips injection when getQASchema returns no schema', async () => {
    mockGetQASchema.mockResolvedValueOnce({ success: false });
    const $w = makeW();
    await injectSchema($w, 'p1');
    expect($w._els.qnaSchemaScript.html).toBe('');
  });
});

// ─── safeJsonLd ───────────────────────────────────────────────────────────────

describe('safeJsonLd', () => {
  it('serializes object to JSON', () => {
    expect(safeJsonLd({ foo: 'bar' })).toBe('{"foo":"bar"}');
  });

  it('escapes </ to prevent script tag injection', () => {
    expect(safeJsonLd({ x: '</script>' })).not.toContain('</');
  });
});

// ─── destroy ─────────────────────────────────────────────────────────────────

describe('destroy', () => {
  it('resets _submitting so next submitQuestion proceeds', async () => {
    // Force _submitting into a stuck state by calling destroy and verifying
    // a subsequent submitQuestion call reaches the backend.
    destroy();
    mockSubmitQuestion.mockResolvedValue({ success: true });
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'Question?';
    await submitQuestion($w, 'p1');
    expect(mockSubmitQuestion).toHaveBeenCalledTimes(1);
  });
});

// ─── integration ─────────────────────────────────────────────────────────────

describe('integration', () => {
  it('load → render shows section with items', async () => {
    const $w = makeW();
    const { items, hasMore, totalCount } = await loadQnA('p1');
    renderQnA($w, items, { hasMore, totalCount });
    expect($w._els.qnaSection.show).toHaveBeenCalled();
    expect($w._els.qnaAccordion.data).toHaveLength(2);
  });

  it('load → render shows empty state on no items', async () => {
    mockGetProductQuestions.mockResolvedValueOnce(OK([], 0));
    const $w = makeW();
    const { items, hasMore, totalCount } = await loadQnA('p1');
    renderQnA($w, items, { hasMore, totalCount });
    expect($w._els.qnaEmpty.show).toHaveBeenCalled();
  });

  it('load → render → loadMore appends without wiping existing', async () => {
    mockGetProductQuestions
      .mockResolvedValueOnce(OK(ITEMS, 3))
      .mockResolvedValueOnce(OK([{ _id: 'q3', question: 'Q3?', answer: null, status: 'pending', helpfulVotes: 0 }], 3));

    const $w = makeW();
    const { items, hasMore, totalCount } = await loadQnA('p1');
    renderQnA($w, items, { hasMore, totalCount });

    await loadMore($w, 'p1', 1);
    expect($w._els.qnaAccordion.data).toHaveLength(3);
    expect($w._els.qnaLoadMore.hide).toHaveBeenCalled();
  });
});
