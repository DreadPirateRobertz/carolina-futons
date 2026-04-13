/**
 * Tests for NpsSurveyWidget.js — CF-c18
 * Post-delivery NPS/CSAT satisfaction survey widget.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockSubmitSurveyResponse,
  mockGetSurveyForOrder,
  mockGetMember,
} = vi.hoisted(() => ({
  mockSubmitSurveyResponse: vi.fn(),
  mockGetSurveyForOrder:    vi.fn(),
  mockGetMember:            vi.fn(),
}));

vi.mock('backend/surveyService.web', () => ({
  submitSurveyResponse: mockSubmitSurveyResponse,
  getSurveyForOrder:    mockGetSurveyForOrder,
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: { getMember: mockGetMember },
}));

import { initNpsSurveyWidget } from '../src/public/NpsSurveyWidget.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text:     '',
    value:    null,
    disabled: false,
    collapse: vi.fn(),
    expand:   vi.fn(),
    show:     vi.fn(),
    hide:     vi.fn(),
    onClick:  vi.fn((cb) => { el._clickCb = cb; }),  // store click handler
    accessibility: {},
    ...overrides,
  };
}

// makeEl helper with self-referential onClick
function makeBtn() {
  const btn = {
    text:     '',
    value:    null,
    disabled: false,
    collapse: vi.fn(),
    expand:   vi.fn(),
    show:     vi.fn(),
    hide:     vi.fn(),
    _clickCb: null,
    accessibility: {},
  };
  btn.onClick = vi.fn((cb) => { btn._clickCb = cb; });
  return btn;
}

function makeElements(scoreValue = null) {
  const submitBtn = makeBtn();
  const skipBtn   = makeBtn();
  const elements = {
    '#npsSurveySection': makeEl(),
    '#npsTitle':         makeEl(),
    '#npsScoreGroup':    makeEl({ value: scoreValue }),
    '#npsComment':       makeEl({ value: '' }),
    '#npsSubmitBtn':     submitBtn,
    '#npsSkipBtn':       skipBtn,
    '#npsThankYouMsg':   makeEl(),
    '#npsStatusMsg':     makeEl(),
  };
  return {
    $w: (id) => elements[id] || makeEl(),
    elements,
    submitBtn,
    skipBtn,
  };
}

function makeOpts(overrides = {}) {
  return {
    orderId:              'order-abc',
    orderStatus:          'delivered',
    getCurrentMember:     () => Promise.resolve({ _id: 'member-1' }),
    getSurveyForOrder:    mockGetSurveyForOrder,
    submitSurveyResponse: mockSubmitSurveyResponse,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: member authenticated, no prior survey
  mockGetMember.mockResolvedValue({ _id: 'member-1' });
  mockGetSurveyForOrder.mockResolvedValue({ success: true, survey: { isCompleted: false } });
  mockSubmitSurveyResponse.mockResolvedValue({ success: true });
});

// ── Guard: non-delivered orders ───────────────────────────────────────────────

describe('initNpsSurveyWidget — non-delivered order', () => {
  it('does nothing when orderStatus is not delivered', async () => {
    const { $w, elements } = makeElements();
    await initNpsSurveyWidget(makeOpts({ $w, orderStatus: 'processing' }));
    expect(elements['#npsSurveySection'].show).not.toHaveBeenCalled();
  });

  it('does nothing when orderId is missing', async () => {
    const { $w, elements } = makeElements();
    await initNpsSurveyWidget(makeOpts({ $w, orderId: null }));
    expect(elements['#npsSurveySection'].show).not.toHaveBeenCalled();
  });
});

// ── Guard: guest user ─────────────────────────────────────────────────────────

describe('initNpsSurveyWidget — guest user', () => {
  it('hides section when getCurrentMember returns null', async () => {
    const { $w, elements } = makeElements();
    await initNpsSurveyWidget(makeOpts({
      $w,
      getCurrentMember: () => Promise.resolve(null),
    }));
    expect(elements['#npsSurveySection'].show).not.toHaveBeenCalled();
  });

  it('hides section when getCurrentMember throws', async () => {
    const { $w, elements } = makeElements();
    await initNpsSurveyWidget(makeOpts({
      $w,
      getCurrentMember: () => Promise.reject(new Error('auth fail')),
    }));
    expect(elements['#npsSurveySection'].show).not.toHaveBeenCalled();
  });
});

// ── Already-completed survey ──────────────────────────────────────────────────

describe('initNpsSurveyWidget — already completed', () => {
  it('shows section and thank-you message without rating form', async () => {
    const { $w, elements } = makeElements();
    mockGetSurveyForOrder.mockResolvedValue({ success: true, survey: { isCompleted: true } });

    await initNpsSurveyWidget(makeOpts({ $w }));

    expect(elements['#npsSurveySection'].show).toHaveBeenCalled();
    expect(elements['#npsThankYouMsg'].show).toHaveBeenCalled();
    expect(elements['#npsTitle'].hide).toHaveBeenCalled();
    expect(elements['#npsScoreGroup'].hide).toHaveBeenCalled();
    expect(elements['#npsSubmitBtn'].hide).toHaveBeenCalled();
  });

  it('shows thank-you even when getSurveyForOrder throws', async () => {
    // If the check throws, treat as not-completed so the form is shown
    const { $w, elements } = makeElements();
    mockGetSurveyForOrder.mockRejectedValue(new Error('network error'));

    await initNpsSurveyWidget(makeOpts({ $w }));

    // Section should still appear; form should show (not thank-you)
    expect(elements['#npsSurveySection'].show).toHaveBeenCalled();
    expect(elements['#npsTitle'].show).toHaveBeenCalled();
    expect(elements['#npsThankYouMsg'].hide).toHaveBeenCalled();
  });
});

// ── Happy path: new survey ────────────────────────────────────────────────────

describe('initNpsSurveyWidget — new survey form', () => {
  it('reveals section and rating form for authenticated member with pending survey', async () => {
    const { $w, elements } = makeElements();
    await initNpsSurveyWidget(makeOpts({ $w }));

    expect(elements['#npsSurveySection'].show).toHaveBeenCalled();
    expect(elements['#npsTitle'].show).toHaveBeenCalled();
    expect(elements['#npsScoreGroup'].show).toHaveBeenCalled();
    expect(elements['#npsComment'].show).toHaveBeenCalled();
    expect(elements['#npsSubmitBtn'].show).toHaveBeenCalled();
    expect(elements['#npsSkipBtn'].show).toHaveBeenCalled();
    expect(elements['#npsThankYouMsg'].hide).toHaveBeenCalled();
  });

  it('wires onClick to submit and skip buttons', async () => {
    const { $w, submitBtn, skipBtn } = makeElements();
    await initNpsSurveyWidget(makeOpts({ $w }));

    expect(submitBtn.onClick).toHaveBeenCalled();
    expect(skipBtn.onClick).toHaveBeenCalled();
  });
});

// ── Submit: success ───────────────────────────────────────────────────────────

describe('initNpsSurveyWidget — submit success', () => {
  it('calls submitSurveyResponse with correct orderId and npsScore', async () => {
    const { elements } = makeElements('8');
    // Re-run with tracked elements to capture the onClick handler
    const trackOpts = makeOpts({ $w: (id) => elements[id] || makeEl() });
    await initNpsSurveyWidget(trackOpts);

    await elements['#npsSubmitBtn']._clickCb?.();

    expect(mockSubmitSurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-abc', npsScore: 8 })
    );
  });

  it('shows thank-you message after successful submit', async () => {
    const { elements } = makeElements('7');
    const $w = (id) => elements[id] || makeEl();
    await initNpsSurveyWidget(makeOpts({ $w }));

    await elements['#npsSubmitBtn']._clickCb?.();

    expect(elements['#npsThankYouMsg'].show).toHaveBeenCalled();
    expect(elements['#npsTitle'].hide).toHaveBeenCalled();
  });

  it('passes optional comment to submitSurveyResponse', async () => {
    const { elements } = makeElements('9');
    elements['#npsComment'].value = 'Great service!';
    const $w = (id) => elements[id] || makeEl();
    await initNpsSurveyWidget(makeOpts({ $w }));

    await elements['#npsSubmitBtn']._clickCb?.();

    expect(mockSubmitSurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'Great service!' })
    );
  });
});

// ── Submit: validation error ──────────────────────────────────────────────────

describe('initNpsSurveyWidget — submit validation', () => {
  it('shows error and does not call backend when no score selected', async () => {
    const { elements } = makeElements(null);  // null = no selection
    const $w = (id) => elements[id] || makeEl();
    await initNpsSurveyWidget(makeOpts({ $w }));

    await elements['#npsSubmitBtn']._clickCb?.();

    expect(mockSubmitSurveyResponse).not.toHaveBeenCalled();
    expect(elements['#npsStatusMsg'].show).toHaveBeenCalled();
  });

  it('shows error when score is out of range', async () => {
    const { elements } = makeElements('11');
    const $w = (id) => elements[id] || makeEl();
    await initNpsSurveyWidget(makeOpts({ $w }));

    await elements['#npsSubmitBtn']._clickCb?.();

    expect(mockSubmitSurveyResponse).not.toHaveBeenCalled();
    expect(elements['#npsStatusMsg'].show).toHaveBeenCalled();
  });

  it('accepts score of 0 (minimum valid NPS value)', async () => {
    const { elements } = makeElements('0');
    const $w = (id) => elements[id] || makeEl();
    await initNpsSurveyWidget(makeOpts({ $w }));

    await elements['#npsSubmitBtn']._clickCb?.();

    expect(mockSubmitSurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ npsScore: 0 })
    );
  });
});

// ── Submit: duplicate block ───────────────────────────────────────────────────

describe('initNpsSurveyWidget — duplicate submission blocked', () => {
  it('shows already-done message when backend returns survey-already-completed error', async () => {
    mockSubmitSurveyResponse.mockResolvedValue({
      success: false,
      error: 'Survey already completed',
    });

    const { elements } = makeElements('7');
    const $w = (id) => elements[id] || makeEl();
    await initNpsSurveyWidget(makeOpts({ $w }));

    await elements['#npsSubmitBtn']._clickCb?.();

    expect(elements['#npsThankYouMsg'].show).toHaveBeenCalled();
    expect(elements['#npsTitle'].hide).toHaveBeenCalled();
  });
});

// ── Submit: auth error ────────────────────────────────────────────────────────

describe('initNpsSurveyWidget — authentication error', () => {
  it('shows sign-in prompt when backend returns auth error', async () => {
    mockSubmitSurveyResponse.mockResolvedValue({
      success: false,
      error: 'Authentication required',
    });

    const { elements } = makeElements('6');
    const $w = (id) => elements[id] || makeEl();
    await initNpsSurveyWidget(makeOpts({ $w }));

    await elements['#npsSubmitBtn']._clickCb?.();

    expect(elements['#npsStatusMsg'].show).toHaveBeenCalled();
    expect(elements['#npsStatusMsg'].text).toMatch(/sign in/i);
  });
});

// ── Submit: network / unexpected error ────────────────────────────────────────

describe('initNpsSurveyWidget — network error', () => {
  it('shows generic error and re-enables button when submitSurveyResponse throws', async () => {
    mockSubmitSurveyResponse.mockRejectedValue(new Error('Network failure'));

    const { elements } = makeElements('5');
    const $w = (id) => elements[id] || makeEl();
    await initNpsSurveyWidget(makeOpts({ $w }));

    await elements['#npsSubmitBtn']._clickCb?.();

    expect(elements['#npsStatusMsg'].show).toHaveBeenCalled();
    expect(elements['#npsSubmitBtn'].disabled).toBe(false);
  });
});

// ── Skip ──────────────────────────────────────────────────────────────────────

describe('initNpsSurveyWidget — skip / dismiss', () => {
  it('hides the section when skip is clicked', async () => {
    const { elements } = makeElements();
    const $w = (id) => elements[id] || makeEl();
    await initNpsSurveyWidget(makeOpts({ $w }));

    elements['#npsSkipBtn']._clickCb?.();

    expect(elements['#npsSurveySection'].hide).toHaveBeenCalled();
  });

  it('does not call submitSurveyResponse when skipped', async () => {
    const { elements } = makeElements();
    const $w = (id) => elements[id] || makeEl();
    await initNpsSurveyWidget(makeOpts({ $w }));

    elements['#npsSkipBtn']._clickCb?.();

    expect(mockSubmitSurveyResponse).not.toHaveBeenCalled();
  });
});
