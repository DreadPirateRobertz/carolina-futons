/**
 * Tests for NpsSurveyWidget.js — CF-c18
 * NPS/CSAT satisfaction survey widget triggered after order delivery.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockSubmitNpsResponse } = vi.hoisted(() => ({
  mockSubmitNpsResponse: vi.fn(),
}));

vi.mock('backend/npsSurveyService.web', () => ({
  submitNpsResponse: mockSubmitNpsResponse,
}));

import { initNpsSurveyWidget } from '../src/components/NpsSurveyWidget.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text:     '',
    value:    null,
    collapse: vi.fn(),
    expand:   vi.fn(),
    show:     vi.fn(),
    hide:     vi.fn(),
    onClick:  vi.fn(),
    ...overrides,
  };
}

function makeElements() {
  const elements = {
    '#npsSurveySection': makeEl(),
    '#npsScoreInput':    makeEl({ value: 8 }),
    '#npsCommentInput':  makeEl({ value: 'Great futon!' }),
    '#npsSubmitBtn':     makeEl(),
    '#npsSkipBtn':       makeEl(),
    '#npsSuccessMsg':    makeEl(),
    '#npsErrorMsg':      makeEl(),
  };
  return {
    $w:       (id) => elements[id] || makeEl(),
    elements,
  };
}

function makeDeliveredState(orderOverrides = {}) {
  return {
    order: { _id: 'order-1', status: 'delivered', ...orderOverrides },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSubmitNpsResponse.mockResolvedValue({ success: true });
});

// ── Visibility — non-delivered / missing state ────────────────────────────────

describe('initNpsSurveyWidget — section visibility', () => {
  it('collapses section when state is null', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: null });
    expect(elements['#npsSurveySection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when order is null', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: { order: null } });
    expect(elements['#npsSurveySection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when order status is pending', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: { order: { _id: 'o-1', status: 'pending' } } });
    expect(elements['#npsSurveySection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when order status is shipped', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: { order: { _id: 'o-1', status: 'shipped' } } });
    expect(elements['#npsSurveySection'].collapse).toHaveBeenCalled();
  });

  it('expands section for delivered order', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: makeDeliveredState() });
    expect(elements['#npsSurveySection'].expand).toHaveBeenCalled();
  });

  it('does not expand section for non-delivered order', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: { order: { _id: 'o-1', status: 'processing' } } });
    expect(elements['#npsSurveySection'].expand).not.toHaveBeenCalled();
  });
});

// ── Initial state ─────────────────────────────────────────────────────────────

describe('initNpsSurveyWidget — initial state', () => {
  it('hides success message on init', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: makeDeliveredState() });
    expect(elements['#npsSuccessMsg'].hide).toHaveBeenCalled();
  });

  it('hides error message on init', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: makeDeliveredState() });
    expect(elements['#npsErrorMsg'].hide).toHaveBeenCalled();
  });

  it('registers onClick on submit button', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: makeDeliveredState() });
    expect(elements['#npsSubmitBtn'].onClick).toHaveBeenCalled();
  });

  it('registers onClick on skip button', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: makeDeliveredState() });
    expect(elements['#npsSkipBtn'].onClick).toHaveBeenCalled();
  });
});

// ── Submit — happy path ───────────────────────────────────────────────────────

describe('initNpsSurveyWidget — submit happy path', () => {
  it('calls submitNpsResponse with orderId and score', async () => {
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 9;
    elements['#npsCommentInput'].value = '';
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    await Promise.resolve();
    expect(mockSubmitNpsResponse).toHaveBeenCalledWith({ orderId: 'order-1', score: 9, comment: '' });
  });

  it('includes comment when provided', async () => {
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 7;
    elements['#npsCommentInput'].value = 'Loved the futon!';
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    await Promise.resolve();
    expect(mockSubmitNpsResponse).toHaveBeenCalledWith(expect.objectContaining({ comment: 'Loved the futon!' }));
  });

  it('shows success message after submission', async () => {
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 8;
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    expect(elements['#npsSuccessMsg'].show).toHaveBeenCalled();
  });

  it('collapses section after successful submission', async () => {
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 10;
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    // collapse called at init (no), but only expand is called at init; collapse after success
    expect(elements['#npsSurveySection'].collapse).toHaveBeenCalled();
  });

  it('hides error message before submitting', async () => {
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 5;
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    expect(elements['#npsErrorMsg'].hide).toHaveBeenCalled();
  });
});

// ── Submit — validation error ─────────────────────────────────────────────────

describe('initNpsSurveyWidget — validation', () => {
  it('shows error when score is null (no selection)', () => {
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = null;
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    expect(elements['#npsErrorMsg'].show).toHaveBeenCalled();
    expect(mockSubmitNpsResponse).not.toHaveBeenCalled();
  });

  it('shows error when score is out of range (0)', () => {
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 0;
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    expect(elements['#npsErrorMsg'].show).toHaveBeenCalled();
    expect(mockSubmitNpsResponse).not.toHaveBeenCalled();
  });

  it('shows error when score is 11', () => {
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 11;
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    expect(elements['#npsErrorMsg'].show).toHaveBeenCalled();
    expect(mockSubmitNpsResponse).not.toHaveBeenCalled();
  });

  it('accepts string score "8" (coerces to int)', async () => {
    const { $w } = makeElements();
    const scoreEl = makeEl({ value: '8' });
    const commentEl = makeEl({ value: '' });
    const submitBtnEl = makeEl();
    const skipBtnEl = makeEl();
    const successEl = makeEl();
    const errorEl = makeEl();
    const sectionEl = makeEl();

    const localEls = {
      '#npsSurveySection': sectionEl,
      '#npsScoreInput':    scoreEl,
      '#npsCommentInput':  commentEl,
      '#npsSubmitBtn':     submitBtnEl,
      '#npsSkipBtn':       skipBtnEl,
      '#npsSuccessMsg':    successEl,
      '#npsErrorMsg':      errorEl,
    };
    const local$w = (id) => localEls[id] || makeEl();

    initNpsSurveyWidget({ $w: local$w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = submitBtnEl.onClick.mock.calls[0][0];
    handler();
    expect(mockSubmitNpsResponse).toHaveBeenCalledWith(expect.objectContaining({ score: 8 }));
  });
});

// ── Submit — network / service error ─────────────────────────────────────────

describe('initNpsSurveyWidget — submission errors', () => {
  it('shows error message when service returns success:false', async () => {
    mockSubmitNpsResponse.mockResolvedValue({ success: false, error: 'internal_error' });
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 6;
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    expect(elements['#npsErrorMsg'].show).toHaveBeenCalled();
  });

  it('shows error message when submitNpsResponse rejects', async () => {
    mockSubmitNpsResponse.mockRejectedValue(new Error('network'));
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 6;
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    expect(elements['#npsErrorMsg'].show).toHaveBeenCalled();
  });

  it('does not show success message on failure', async () => {
    mockSubmitNpsResponse.mockResolvedValue({ success: false });
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 4;
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    expect(elements['#npsSuccessMsg'].show).not.toHaveBeenCalled();
  });
});

// ── Skip ──────────────────────────────────────────────────────────────────────

describe('initNpsSurveyWidget — skip', () => {
  it('collapses section when skip button is clicked', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: makeDeliveredState() });
    const handler = elements['#npsSkipBtn'].onClick.mock.calls[0][0];
    handler();
    expect(elements['#npsSurveySection'].collapse).toHaveBeenCalled();
  });

  it('does not call submitNpsResponse when skipping', () => {
    const { $w, elements } = makeElements();
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSkipBtn'].onClick.mock.calls[0][0];
    handler();
    expect(mockSubmitNpsResponse).not.toHaveBeenCalled();
  });
});

// ── Duplicate submission (alreadySubmitted) ───────────────────────────────────

describe('initNpsSurveyWidget — duplicate submission', () => {
  it('still shows success message when alreadySubmitted is true', async () => {
    mockSubmitNpsResponse.mockResolvedValue({ success: true, alreadySubmitted: true });
    const { $w, elements } = makeElements();
    elements['#npsScoreInput'].value = 9;
    initNpsSurveyWidget({ $w, state: makeDeliveredState(), submitNpsResponse: mockSubmitNpsResponse });
    const handler = elements['#npsSubmitBtn'].onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    expect(elements['#npsSuccessMsg'].show).toHaveBeenCalled();
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('initNpsSurveyWidget — destroy', () => {
  it('returns a destroy function', () => {
    const { $w } = makeElements();
    const result = initNpsSurveyWidget({ $w, state: makeDeliveredState() });
    expect(typeof result.destroy).toBe('function');
  });

  it('destroy() can be called without throwing', () => {
    const { $w } = makeElements();
    const { destroy } = initNpsSurveyWidget({ $w, state: makeDeliveredState() });
    expect(() => destroy()).not.toThrow();
  });

  it('returns destroy even for collapsed non-delivered state', () => {
    const { $w } = makeElements();
    const result = initNpsSurveyWidget({ $w, state: null });
    expect(typeof result.destroy).toBe('function');
  });
});
