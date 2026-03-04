import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initProductQA } from '../src/public/ProductQA.js';
import { futonFrame } from './fixtures/products.js';

// Mock backend
const mockQuestions = {
  success: true,
  data: {
    questions: [
      {
        _id: 'q-1', question: 'Does this come with a mattress?', answer: 'Yes, all packages include a mattress.',
        memberName: 'Alice S.', answeredBy: 'Carolina Futons', answeredAt: new Date('2026-02-15'),
        helpfulVotes: 5, status: 'answered', createdDate: new Date('2026-02-10'),
      },
      {
        _id: 'q-2', question: 'What are the available colors?', answer: null,
        memberName: 'Bob T.', answeredBy: null, answeredAt: null,
        helpfulVotes: 2, status: 'pending', createdDate: new Date('2026-02-12'),
      },
    ],
    page: 1,
    pageSize: 10,
    totalCount: 2,
  },
};

const mockEmptyQuestions = {
  success: true,
  data: { questions: [], page: 1, pageSize: 10, totalCount: 0 },
};

const mockSubmitSuccess = { success: true, data: { _id: 'q-new', question: 'Test question text?' } };
const mockSubmitFail = { success: false, error: 'Question must be at least 10 characters' };
const mockVoteSuccess = { success: true, data: { helpfulVotes: 6 } };
const mockVoteFail = { success: false, error: 'Already voted' };
const mockFlagSuccess = { success: true, data: { flagCount: 1, hidden: false } };
const mockSchema = {
  success: true,
  data: {
    schema: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }],
    },
    questionCount: 1,
  },
};

let mockGetProductQuestions, mockSubmitQuestion, mockVoteHelpful, mockFlagQuestion, mockGetQASchema;

vi.mock('backend/productQA.web', () => ({
  get getProductQuestions() { return mockGetProductQuestions; },
  get submitQuestion() { return mockSubmitQuestion; },
  get voteHelpful() { return mockVoteHelpful; },
  get flagQuestion() { return mockFlagQuestion; },
  get getQASchema() { return mockGetQASchema; },
}));

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    html: '',
    src: '',
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onKeyPress: vi.fn(),
    onItemReady: vi.fn(),
    data: [],
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '', ariaLive: '', role: '' },
  };
}

function create$w() {
  const els = new Map();
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._els = els;
  return $w;
}

describe('ProductQA — initProductQA', () => {
  let $w;
  let state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    state = { product: { ...futonFrame } };
    mockGetProductQuestions = vi.fn(async () => mockQuestions);
    mockSubmitQuestion = vi.fn(async () => mockSubmitSuccess);
    mockVoteHelpful = vi.fn(async () => mockVoteSuccess);
    mockFlagQuestion = vi.fn(async () => mockFlagSuccess);
    mockGetQASchema = vi.fn(async () => mockSchema);
  });

  // ── Section display ──────────────────────────────────────────────

  it('expands Q&A section when product has questions', async () => {
    await initProductQA($w, state);
    expect($w('#qaSection').expand).toHaveBeenCalled();
  });

  it('collapses Q&A section when no product', async () => {
    state.product = null;
    await initProductQA($w, state);
    expect($w('#qaSection').collapse).toHaveBeenCalled();
  });

  it('shows empty state when no questions exist', async () => {
    mockGetProductQuestions = vi.fn(async () => mockEmptyQuestions);
    await initProductQA($w, state);
    expect($w('#qaEmptyState').show).toHaveBeenCalled();
  });

  it('hides empty state when questions exist', async () => {
    await initProductQA($w, state);
    expect($w('#qaEmptyState').hide).toHaveBeenCalled();
  });

  // ── Question count ───────────────────────────────────────────────

  it('displays total question count', async () => {
    await initProductQA($w, state);
    expect($w('#qaCount').text).toContain('2');
  });

  it('displays singular count for 1 question', async () => {
    mockGetProductQuestions = vi.fn(async () => ({
      success: true,
      data: { questions: [mockQuestions.data.questions[0]], page: 1, pageSize: 10, totalCount: 1 },
    }));
    await initProductQA($w, state);
    expect($w('#qaCount').text).toMatch(/1 question$/);
  });

  // ── Questions repeater ───────────────────────────────────────────

  it('populates questions repeater with data', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data).toHaveLength(2);
  });

  it('renders question text, author, and date in repeater items', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    expect($item('#qaQuestionText').text).toBe('Does this come with a mattress?');
    expect($item('#qaAuthorName').text).toBe('Alice S.');
  });

  it('shows answer for answered questions', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    expect($item('#qaAnswerText').text).toBe('Yes, all packages include a mattress.');
    expect($item('#qaAnswerSection').show).toHaveBeenCalled();
    expect($item('#qaAnsweredBy').text).toContain('Carolina Futons');
  });

  it('hides answer section for unanswered questions', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[1]);

    expect($item('#qaAnswerSection').hide).toHaveBeenCalled();
    expect($item('#qaPendingBadge').show).toHaveBeenCalled();
  });

  // ── Helpful voting ───────────────────────────────────────────────

  it('displays helpful vote count', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    expect($item('#qaHelpfulCount').text).toContain('5');
  });

  it('registers helpful vote click handler', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    expect($item('#qaHelpfulBtn').onClick).toHaveBeenCalled();
  });

  it('calls voteHelpful on click and updates count', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    const clickHandler = $item('#qaHelpfulBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockVoteHelpful).toHaveBeenCalledWith('q-1');
    expect($item('#qaHelpfulCount').text).toContain('6');
  });

  it('shows feedback when vote fails (already voted)', async () => {
    mockVoteHelpful = vi.fn(async () => mockVoteFail);
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    const clickHandler = $item('#qaHelpfulBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($item('#qaHelpfulBtn').label).toContain('Voted');
  });

  // ── Flag question ────────────────────────────────────────────────

  it('registers flag click handler', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    expect($item('#qaFlagBtn').onClick).toHaveBeenCalled();
  });

  it('calls flagQuestion on click', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    const clickHandler = $item('#qaFlagBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockFlagQuestion).toHaveBeenCalledWith('q-1');
  });

  // ── Submit question form ─────────────────────────────────────────

  it('registers submit button click handler', async () => {
    await initProductQA($w, state);
    expect($w('#qaSubmitBtn').onClick).toHaveBeenCalled();
  });

  it('submits question and refreshes list on success', async () => {
    await initProductQA($w, state);
    $w('#qaQuestionInput').value = 'Is this suitable for daily sleeping?';

    const clickHandler = $w('#qaSubmitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockSubmitQuestion).toHaveBeenCalledWith(
      futonFrame._id,
      'Is this suitable for daily sleeping?'
    );
    // Should refresh questions list
    expect(mockGetProductQuestions).toHaveBeenCalledTimes(2);
  });

  it('shows error when submission fails', async () => {
    mockSubmitQuestion = vi.fn(async () => mockSubmitFail);
    await initProductQA($w, state);
    $w('#qaQuestionInput').value = 'How?';

    const clickHandler = $w('#qaSubmitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#qaFormError').text).toBeTruthy();
    expect($w('#qaFormError').show).toHaveBeenCalled();
  });

  it('validates empty input before calling backend', async () => {
    await initProductQA($w, state);
    $w('#qaQuestionInput').value = '';

    const clickHandler = $w('#qaSubmitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockSubmitQuestion).not.toHaveBeenCalled();
    expect($w('#qaFormError').show).toHaveBeenCalled();
  });

  it('validates whitespace-only input', async () => {
    await initProductQA($w, state);
    $w('#qaQuestionInput').value = '     ';

    const clickHandler = $w('#qaSubmitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockSubmitQuestion).not.toHaveBeenCalled();
  });

  it('disables submit button during submission', async () => {
    let resolveSubmit;
    mockSubmitQuestion = vi.fn(() => new Promise(r => { resolveSubmit = r; }));

    await initProductQA($w, state);
    $w('#qaQuestionInput').value = 'Valid question about this product?';

    const clickHandler = $w('#qaSubmitBtn').onClick.mock.calls[0][0];
    const submitPromise = clickHandler();

    expect($w('#qaSubmitBtn').disable).toHaveBeenCalled();

    resolveSubmit(mockSubmitSuccess);
    await submitPromise;

    expect($w('#qaSubmitBtn').enable).toHaveBeenCalled();
  });

  it('clears input after successful submission', async () => {
    await initProductQA($w, state);
    $w('#qaQuestionInput').value = 'Valid question about this product?';

    const clickHandler = $w('#qaSubmitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#qaQuestionInput').value).toBe('');
  });

  it('shows success message after submission', async () => {
    await initProductQA($w, state);
    $w('#qaQuestionInput').value = 'Valid question about this product?';

    const clickHandler = $w('#qaSubmitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#qaFormSuccess').show).toHaveBeenCalled();
  });

  // ── Pagination ───────────────────────────────────────────────────

  it('hides load more when all questions loaded', async () => {
    await initProductQA($w, state);
    // totalCount (2) <= questions.length (2) means no more
    expect($w('#qaLoadMoreBtn').hide).toHaveBeenCalled();
  });

  it('shows load more when more questions exist', async () => {
    mockGetProductQuestions = vi.fn(async () => ({
      success: true,
      data: {
        questions: mockQuestions.data.questions,
        page: 1,
        pageSize: 10,
        totalCount: 25,
      },
    }));
    await initProductQA($w, state);
    expect($w('#qaLoadMoreBtn').show).toHaveBeenCalled();
  });

  it('loads next page on load more click', async () => {
    mockGetProductQuestions = vi.fn(async () => ({
      success: true,
      data: {
        questions: mockQuestions.data.questions,
        page: 1,
        pageSize: 10,
        totalCount: 25,
      },
    }));
    await initProductQA($w, state);
    expect($w('#qaLoadMoreBtn').onClick).toHaveBeenCalled();

    const clickHandler = $w('#qaLoadMoreBtn').onClick.mock.calls[0][0];
    await clickHandler();

    // Should request page 2
    expect(mockGetProductQuestions).toHaveBeenCalledWith(
      futonFrame._id,
      expect.objectContaining({ page: 2 })
    );
  });

  // ── FAQ Schema injection ─────────────────────────────────────────

  it('calls getQASchema for SEO', async () => {
    await initProductQA($w, state);
    expect(mockGetQASchema).toHaveBeenCalledWith(futonFrame._id);
  });

  // ── Error handling ───────────────────────────────────────────────

  it('collapses section on backend error', async () => {
    mockGetProductQuestions = vi.fn(async () => { throw new Error('Network error'); });
    await initProductQA($w, state);
    expect($w('#qaSection').collapse).toHaveBeenCalled();
  });

  it('handles getProductQuestions returning success:false', async () => {
    mockGetProductQuestions = vi.fn(async () => ({ success: false, error: 'Failed' }));
    await initProductQA($w, state);
    expect($w('#qaSection').collapse).toHaveBeenCalled();
  });

  it('handles voteHelpful network error gracefully', async () => {
    mockVoteHelpful = vi.fn(async () => { throw new Error('Network error'); });
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    const clickHandler = $item('#qaHelpfulBtn').onClick.mock.calls[0][0];
    // Should not throw
    await expect(clickHandler()).resolves.not.toThrow();
  });

  it('handles flagQuestion network error gracefully', async () => {
    mockFlagQuestion = vi.fn(async () => { throw new Error('Network error'); });
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    const clickHandler = $item('#qaFlagBtn').onClick.mock.calls[0][0];
    await expect(clickHandler()).resolves.not.toThrow();
  });

  it('handles submit network error gracefully', async () => {
    mockSubmitQuestion = vi.fn(async () => { throw new Error('Network error'); });
    await initProductQA($w, state);
    $w('#qaQuestionInput').value = 'Valid question about this product?';

    const clickHandler = $w('#qaSubmitBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#qaFormError').show).toHaveBeenCalled();
    expect($w('#qaSubmitBtn').enable).toHaveBeenCalled();
  });

  // ── Accessibility ────────────────────────────────────────────────

  it('sets ARIA labels on section', async () => {
    await initProductQA($w, state);
    expect($w('#qaSection').accessibility.ariaLabel).toBeTruthy();
    expect($w('#qaSection').accessibility.role).toBe('region');
  });

  it('sets ARIA label on submit button', async () => {
    await initProductQA($w, state);
    expect($w('#qaSubmitBtn').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets ARIA label on question input', async () => {
    await initProductQA($w, state);
    expect($w('#qaQuestionInput').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets ARIA labels on helpful buttons in repeater items', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    expect($item('#qaHelpfulBtn').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets ARIA labels on flag buttons in repeater items', async () => {
    await initProductQA($w, state);
    const repeater = $w('#qaRepeater');
    const onItemReady = repeater.onItemReady.mock.calls[0][0];

    const $item = create$w();
    onItemReady($item, mockQuestions.data.questions[0]);

    expect($item('#qaFlagBtn').accessibility.ariaLabel).toBeTruthy();
  });
});
