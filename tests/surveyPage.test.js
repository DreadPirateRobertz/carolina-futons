/**
 * surveyPage.test.js
 * CF-1mlj — NPS survey page controller
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Global $w stub (hoisted so page module evaluates cleanly) ─────────────────

vi.hoisted(() => {
  globalThis.$w = Object.assign(
    vi.fn(() => ({ value: '', text: '', onClick: vi.fn(), onChange: vi.fn(), show: vi.fn(), hide: vi.fn(), expand: vi.fn(), collapse: vi.fn(), enable: vi.fn(), disable: vi.fn() })),
    { onReady: vi.fn() }
  );
});

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('wix-location', () => ({ default: { query: {}, to: vi.fn() } }));

vi.mock('backend/surveyService.web', () => ({
  submitSurveyResponse: vi.fn(),
  getSurveyForOrder: vi.fn(),
}));

vi.mock('public/safeInit', () => ({
  safeCall: vi.fn((fn) => { try { fn(); } catch {} }),
  safeCollapse: vi.fn(),
  safeExpand: vi.fn(),
  safeText: vi.fn(),
}));

import { initSurveyPage } from '../src/pages/Survey.js';
import { submitSurveyResponse, getSurveyForOrder } from 'backend/surveyService.web';
import { safeCollapse, safeExpand, safeText } from 'public/safeInit';
import wixLocation from 'wix-location';

const mockSubmit = vi.mocked(submitSurveyResponse);
const mockGetSurvey = vi.mocked(getSurveyForOrder);
const mockLocation = /** @type {any} */ (wixLocation);

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEl() {
  return {
    value: '',
    text: '',
    onClick: vi.fn(),
    onChange: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    expand: vi.fn(),
    collapse: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  };
}

function make$w(overrides = {}) {
  const els = {
    '#surveyNpsSlider': makeEl(),
    '#surveyNpsScore': makeEl(),
    '#surveyComment': { ...makeEl(), value: '' },
    '#surveySubmitBtn': { ...makeEl(), onClick: vi.fn() },
    '#surveySuccessMsg': makeEl(),
    '#surveyErrorMsg': makeEl(),
    '#surveyAlreadyDone': makeEl(),
    '#surveyLoadingIndicator': makeEl(),
    ...overrides,
  };
  return vi.fn((id) => els[id] ?? makeEl());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('initSurveyPage', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.query = { orderId: 'order-nps-1' };
    mockGetSurvey.mockResolvedValue({ success: true, survey: null });
    mockSubmit.mockResolvedValue({ success: true });
    $w = make$w();
  });

  it('collapses status messages on init', async () => {
    await initSurveyPage($w);
    expect(safeCollapse).toHaveBeenCalledWith($w, '#surveySuccessMsg');
    expect(safeCollapse).toHaveBeenCalledWith($w, '#surveyErrorMsg');
    expect(safeCollapse).toHaveBeenCalledWith($w, '#surveyAlreadyDone');
  });

  it('shows error when orderId is missing', async () => {
    mockLocation.query = {};
    await initSurveyPage($w);
    expect(safeExpand).toHaveBeenCalledWith($w, '#surveyErrorMsg');
    expect(safeText).toHaveBeenCalledWith($w, '#surveyErrorMsg', expect.stringMatching(/order/i));
  });

  it('shows already-done message when survey is completed', async () => {
    mockGetSurvey.mockResolvedValue({
      success: true,
      survey: { isCompleted: true, npsScore: 9 },
    });
    await initSurveyPage($w);
    expect(safeExpand).toHaveBeenCalledWith($w, '#surveyAlreadyDone');
  });

  it('wires the submit button', async () => {
    const btn = { ...makeEl(), onClick: vi.fn() };
    const $wWithBtn = make$w({ '#surveySubmitBtn': btn });
    await initSurveyPage($wWithBtn);
    expect(btn.onClick).toHaveBeenCalled();
  });
});

describe('survey submission', () => {
  let $w;
  let submitHandler;
  let changeHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.query = { orderId: 'order-nps-1' };
    mockGetSurvey.mockResolvedValue({ success: true, survey: null });
    mockSubmit.mockResolvedValue({ success: true });

    const slider = { ...makeEl(), onChange: vi.fn((fn) => { changeHandler = fn; }) };
    const btn = { ...makeEl(), onClick: vi.fn((fn) => { submitHandler = fn; }), enable: vi.fn(), disable: vi.fn() };
    $w = make$w({ '#surveyNpsSlider': slider, '#surveySubmitBtn': btn });
  });

  async function triggerSubmitWithScore(score) {
    await initSurveyPage($w);
    if (changeHandler) changeHandler({ target: { value: score } });
    await submitHandler();
  }

  it('submits with selected score', async () => {
    await triggerSubmitWithScore(8);
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-nps-1',
      npsScore: 8,
    }));
  });

  it('shows success message on successful submit', async () => {
    await triggerSubmitWithScore(9);
    expect(safeExpand).toHaveBeenCalledWith($w, '#surveySuccessMsg');
  });

  it('shows error if no score selected', async () => {
    await initSurveyPage($w);
    // Don't set a score
    await submitHandler();
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(safeExpand).toHaveBeenCalledWith($w, '#surveyErrorMsg');
  });

  it('shows error on submit failure', async () => {
    mockSubmit.mockResolvedValue({ success: false, error: 'Survey not found' });
    await triggerSubmitWithScore(7);
    expect(safeExpand).toHaveBeenCalledWith($w, '#surveyErrorMsg');
    expect(safeText).toHaveBeenCalledWith($w, '#surveyErrorMsg', 'Survey not found');
  });

  it('shows generic error on unexpected throw', async () => {
    mockSubmit.mockRejectedValue(new Error('network error'));
    await triggerSubmitWithScore(6);
    expect(safeExpand).toHaveBeenCalledWith($w, '#surveyErrorMsg');
  });
});
