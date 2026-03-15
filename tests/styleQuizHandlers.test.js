import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w mock infrastructure ────────────────────────────────────────
const elements = new Map();
function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', placeholder: '',
    options: [], data: [], html: '', link: '', target: '',
    style: { color: '', fontWeight: '', backgroundColor: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
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

// ── Mock data ─────────────────────────────────────────────────────
const mockQuizOptions = {
  roomTypes: [{ value: 'living', label: 'Living Room', description: 'Main living area' }],
  primaryUses: [{ value: 'daily', label: 'Daily Sitting' }],
  stylePreferences: [{ value: 'modern', label: 'Modern' }],
  sizeOptions: [{ value: 'full', label: 'Full Size' }],
  budgetRanges: [{ value: 'mid', label: '$500-$1000' }],
};

const mockResults = [{
  product: {
    _id: 'p1', name: 'Asheville Frame', slug: 'asheville',
    price: 699, formattedPrice: '$699.00', mainMedia: 'https://cdn/img.jpg',
  },
  score: 85,
  reason: 'Great for daily use',
}];

// ── vi.mock declarations (factory runs before variable assignment) ─
vi.mock('backend/styleQuiz.web', () => ({
  getQuizOptions: vi.fn(() => Promise.resolve({
    roomTypes: [{ value: 'living', label: 'Living Room', description: 'Main living area' }],
    primaryUses: [{ value: 'daily', label: 'Daily Sitting' }],
    stylePreferences: [{ value: 'modern', label: 'Modern' }],
    sizeOptions: [{ value: 'full', label: 'Full Size' }],
    budgetRanges: [{ value: 'mid', label: '$500-$1000' }],
  })),
  getQuizRecommendations: vi.fn(() => Promise.resolve([{
    product: {
      _id: 'p1', name: 'Asheville Frame', slug: 'asheville',
      price: 699, formattedPrice: '$699.00', mainMedia: 'https://cdn/img.jpg',
    },
    score: 85,
    reason: 'Great for daily use',
  }])),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { mountainBlue: '#4A7C59', white: '#FFFFFF', espresso: '#3C2415' },
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn((p) => `${p.name} product image`),
}));

vi.mock('wix-location-frontend', () => ({ to: vi.fn() }));

// ── Obtain mock references via await import ───────────────────────
const { getQuizOptions, getQuizRecommendations } = await import('backend/styleQuiz.web');
const { trackEvent } = await import('public/engagementTracker');
const { initBackToTop } = await import('public/mobileHelpers');
const { announce, makeClickable } = await import('public/a11yHelpers');
const { initPageSeo } = await import('public/pageSeo.js');
const { buildGridAlt } = await import('public/productPageUtils.js');

// ── Import the module under test (registers onReady handler) ──────
await import('../src/pages/Style Quiz.js');

// ── Helpers ───────────────────────────────────────────────────────

/** Trigger the onItemReady callback for a repeater element */
function fireOnItemReady(repeaterId, $itemLookup, itemData) {
  const rep = getEl(repeaterId);
  const handler = rep.onItemReady.mock.calls.at(-1)?.[0];
  if (handler) handler($itemLookup, itemData);
}

/** Click the next button via its makeClickable handler */
function clickNext() {
  const call = makeClickable.mock.calls.find(c => c[0] === getEl('#quizNextBtn'));
  if (call) call[1]();
}

/** Click the back button via its makeClickable handler */
function clickBack() {
  const call = makeClickable.mock.calls.find(c => c[0] === getEl('#quizBackBtn'));
  if (call) call[1]();
}

/** Click the restart button via its makeClickable handler */
function clickRestart() {
  const call = makeClickable.mock.calls.find(c => c[0] === getEl('#quizRestartBtn'));
  if (call) call[1]();
}

/** Select an option by triggering onItemReady + click on the optionContainer */
function selectOption(repeaterId, itemData) {
  const itemElements = new Map();
  const $item = (sel) => {
    if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
    return itemElements.get(sel);
  };
  fireOnItemReady(repeaterId, $item, itemData);
  const clickHandler = $item('#optionContainer').onClick.mock.calls.at(-1)?.[0];
  if (clickHandler) clickHandler();
}

/** Answer choices for all 5 quiz steps */
const ALL_ANSWERS = [
  { value: 'living', label: 'Living Room', description: 'Main living area' },
  { value: 'daily', label: 'Daily Sitting' },
  { value: 'modern', label: 'Modern' },
  { value: 'full', label: 'Full Size' },
  { value: 'mid', label: '$500-$1000' },
];

/** Select all 5 answers and click next through to submission */
function fillAndSubmitQuiz() {
  for (let i = 0; i < ALL_ANSWERS.length - 1; i++) {
    selectOption('#quizOptionsRepeater', ALL_ANSWERS[i]);
    clickNext();
  }
  // Select last answer
  selectOption('#quizOptionsRepeater', ALL_ANSWERS[4]);
  // Click next on final step triggers submitQuiz
  clickNext();
}

// ── Test Suite ────────────────────────────────────────────────────

describe('Style Quiz page', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    // Restore default mock implementations after clearAllMocks wipes them
    getQuizOptions.mockImplementation(() => Promise.resolve({
      roomTypes: [{ value: 'living', label: 'Living Room', description: 'Main living area' }],
      primaryUses: [{ value: 'daily', label: 'Daily Sitting' }],
      stylePreferences: [{ value: 'modern', label: 'Modern' }],
      sizeOptions: [{ value: 'full', label: 'Full Size' }],
      budgetRanges: [{ value: 'mid', label: '$500-$1000' }],
    }));
    getQuizRecommendations.mockImplementation(() => Promise.resolve([{
      product: {
        _id: 'p1', name: 'Asheville Frame', slug: 'asheville',
        price: 699, formattedPrice: '$699.00', mainMedia: 'https://cdn/img.jpg',
      },
      score: 85,
      reason: 'Great for daily use',
    }]));
    buildGridAlt.mockImplementation((p) => `${p.name} product image`);
  });

  // ── 1. Initialization ──────────────────────────────────────────

  describe('initialization', () => {
    it('calls initBackToTop on ready', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with styleQuiz', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('styleQuiz');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'style-quiz' });
    });

    it('calls getQuizOptions to load options', async () => {
      await onReadyHandler();
      expect(getQuizOptions).toHaveBeenCalled();
    });
  });

  // ── 2. Quiz init layout ────────────────────────────────────────

  describe('quiz init', () => {
    it('collapses results section', async () => {
      await onReadyHandler();
      expect(getEl('#quizResults').collapse).toHaveBeenCalled();
    });

    it('collapses loading state', async () => {
      await onReadyHandler();
      expect(getEl('#quizLoadingState').collapse).toHaveBeenCalled();
    });

    it('expands quiz section', async () => {
      await onReadyHandler();
      expect(getEl('#quizSection').expand).toHaveBeenCalled();
    });
  });

  // ── 3. Nav buttons ─────────────────────────────────────────────

  describe('navigation buttons', () => {
    it('wires next button via makeClickable', async () => {
      await onReadyHandler();
      expect(makeClickable).toHaveBeenCalledWith(
        getEl('#quizNextBtn'),
        expect.any(Function),
        { ariaLabel: 'Next step' }
      );
    });

    it('wires back button via makeClickable', async () => {
      await onReadyHandler();
      expect(makeClickable).toHaveBeenCalledWith(
        getEl('#quizBackBtn'),
        expect.any(Function),
        { ariaLabel: 'Previous step' }
      );
    });

    it('wires restart button via makeClickable', async () => {
      await onReadyHandler();
      expect(makeClickable).toHaveBeenCalledWith(
        getEl('#quizRestartBtn'),
        expect.any(Function),
        { ariaLabel: 'Restart quiz' }
      );
    });
  });

  // ── 4. First step render ───────────────────────────────────────
  // NOTE: module state (state.step, state.answers) persists between tests.
  // Each test calls restartQuiz via clickRestart() after onReadyHandler()
  // to guarantee step=0 and answers={} regardless of prior test side effects.

  describe('first step render', () => {
    it('sets progress bar to 20%', async () => {
      await onReadyHandler();
      clickRestart(); // reset module state to step 0
      expect(getEl('#quizProgressBar').value).toBe(20);
    });

    it('sets progress text to Step 1 of 5', async () => {
      await onReadyHandler();
      clickRestart();
      expect(getEl('#quizProgressText').text).toBe('Step 1 of 5');
    });

    it('sets step title from STEPS[0]', async () => {
      await onReadyHandler();
      clickRestart();
      expect(getEl('#quizStepTitle').text).toBe('Where will your futon live?');
    });

    it('collapses back button on first step', async () => {
      await onReadyHandler();
      clickRestart();
      expect(getEl('#quizBackBtn').collapse).toHaveBeenCalled();
    });
  });

  // ── 5. Options repeater ────────────────────────────────────────

  describe('options repeater', () => {
    it('sets repeater data from quiz options', async () => {
      await onReadyHandler();
      clickRestart();
      const rep = getEl('#quizOptionsRepeater');
      expect(rep.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: 'living', label: 'Living Room', _id: 'opt-0' }),
        ])
      );
    });

    it('onItemReady sets label and description', async () => {
      await onReadyHandler();
      clickRestart();
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      fireOnItemReady('#quizOptionsRepeater', $item, {
        value: 'living', label: 'Living Room', description: 'Main living area',
      });
      expect($item('#optionLabel').text).toBe('Living Room');
      expect($item('#optionDescription').text).toBe('Main living area');
    });
  });

  // ── 6. Option ARIA ─────────────────────────────────────────────

  describe('option ARIA attributes', () => {
    it('sets role=radio, ariaLabel, ariaChecked=false, tabIndex=0', async () => {
      await onReadyHandler();
      clickRestart();
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      fireOnItemReady('#quizOptionsRepeater', $item, {
        value: 'living', label: 'Living Room', description: 'Main living area',
      });
      const acc = $item('#optionContainer').accessibility;
      expect(acc.role).toBe('radio');
      expect(acc.ariaLabel).toBe('Living Room');
      expect(acc.ariaChecked).toBe(false);
      expect(acc.tabIndex).toBe(0);
    });
  });

  // ── 7. Option click ────────────────────────────────────────────

  describe('option click', () => {
    it('tracks quiz_answer event on click', async () => {
      await onReadyHandler();
      clickRestart();
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      fireOnItemReady('#quizOptionsRepeater', $item, {
        value: 'living', label: 'Living Room', description: 'Main living area',
      });
      const clickHandler = $item('#optionContainer').onClick.mock.calls.at(-1)[0];
      clickHandler();
      expect(trackEvent).toHaveBeenCalledWith('quiz_answer', {
        step: 'roomType', answer: 'living',
      });
    });
  });

  // ── 8. Next without selection ──────────────────────────────────

  describe('next without selection', () => {
    it('shows validation message and announces error', async () => {
      await onReadyHandler();
      clickRestart();
      clickNext();
      expect(getEl('#quizValidation').text).toBe('Please select an option');
      expect(getEl('#quizValidation').expand).toHaveBeenCalled();
      expect(announce).toHaveBeenCalledWith($w, 'Please select an option before continuing');
    });
  });

  // ── 9. Next with selection ─────────────────────────────────────

  describe('next with selection', () => {
    it('advances to step 2 with 40% progress', async () => {
      await onReadyHandler();
      clickRestart();
      selectOption('#quizOptionsRepeater', {
        value: 'living', label: 'Living Room', description: 'Main living area',
      });
      clickNext();
      expect(getEl('#quizProgressBar').value).toBe(40);
      expect(getEl('#quizProgressText').text).toBe('Step 2 of 5');
    });
  });

  // ── 10. Last step button label ─────────────────────────────────

  describe('last step next button', () => {
    it('label says See My Recommendations on last step', async () => {
      await onReadyHandler();
      clickRestart();

      // Advance through steps 0-3
      const stepOptions = [
        { value: 'living', label: 'Living Room', description: 'Main living area' },
        { value: 'daily', label: 'Daily Sitting' },
        { value: 'modern', label: 'Modern' },
        { value: 'full', label: 'Full Size' },
      ];
      for (const opt of stepOptions) {
        selectOption('#quizOptionsRepeater', opt);
        clickNext();
      }

      expect(getEl('#quizNextBtn').label).toBe('See My Recommendations');
    });
  });

  // ── 11. Back button ────────────────────────────────────────────

  describe('back button', () => {
    it('goes back one step', async () => {
      await onReadyHandler();
      clickRestart();
      selectOption('#quizOptionsRepeater', {
        value: 'living', label: 'Living Room',
      });
      clickNext();
      expect(getEl('#quizProgressText').text).toBe('Step 2 of 5');

      clickBack();
      expect(getEl('#quizProgressText').text).toBe('Step 1 of 5');
    });
  });

  // ── 12. Submit quiz ────────────────────────────────────────────

  describe('submit quiz', () => {
    it('collapses quiz, expands loading, calls getQuizRecommendations, tracks quiz_submit', async () => {
      await onReadyHandler();
      clickRestart();
      fillAndSubmitQuiz();

      await vi.waitFor(() => {
        expect(getQuizRecommendations).toHaveBeenCalled();
      });

      expect(getEl('#quizSection').collapse).toHaveBeenCalled();
      expect(getEl('#quizLoadingState').expand).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('quiz_submit', expect.objectContaining({
        answers: expect.any(Object),
      }));
    });
  });

  // ── 13. Results render ─────────────────────────────────────────

  describe('results render', () => {
    it('expands results section, sets title, and populates repeater', async () => {
      await onReadyHandler();
      clickRestart();
      fillAndSubmitQuiz();

      await vi.waitFor(() => {
        expect(getQuizRecommendations).toHaveBeenCalled();
      });

      expect(getEl('#quizResults').expand).toHaveBeenCalled();
      expect(getEl('#resultsTitle').text).toBe('Your Top 1 Match');

      const rep = getEl('#resultsRepeater');
      expect(rep.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ _id: 'result-0', score: 85 }),
        ])
      );
    });
  });

  // ── 14. Result onItemReady ─────────────────────────────────────

  describe('result onItemReady', () => {
    it('sets product name, price, match badge, reason, and image', async () => {
      await onReadyHandler();
      clickRestart();
      fillAndSubmitQuiz();

      await vi.waitFor(() => {
        expect(getQuizRecommendations).toHaveBeenCalled();
      });

      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      fireOnItemReady('#resultsRepeater', $item, {
        _id: 'result-0',
        product: {
          _id: 'p1', name: 'Asheville Frame', slug: 'asheville',
          price: 699, formattedPrice: '$699.00', mainMedia: 'https://cdn/img.jpg',
        },
        score: 85,
        reason: 'Great for daily use',
      });

      expect($item('#resultProductName').text).toBe('Asheville Frame');
      expect($item('#resultProductPrice').text).toBe('$699.00');
      expect($item('#resultMatchBadge').text).toBe('Top Pick');
      expect($item('#resultMatchReason').text).toBe('Great for daily use');
      expect($item('#resultProductImage').src).toBe('https://cdn/img.jpg');
      expect(buildGridAlt).toHaveBeenCalledWith(expect.objectContaining({ name: 'Asheville Frame' }));
    });
  });

  // ── 15. No results ────────────────────────────────────────────

  describe('no results', () => {
    it('shows no exact matches title and browse button', async () => {
      // Set empty results BEFORE onReadyHandler (which does not call
      // getQuizRecommendations — only getQuizOptions). The mockResolvedValueOnce
      // will be consumed when submitQuiz calls getQuizRecommendations.
      getQuizRecommendations.mockResolvedValueOnce([]);

      await onReadyHandler();
      clickRestart();
      fillAndSubmitQuiz();

      await vi.waitFor(() => {
        expect(getQuizRecommendations).toHaveBeenCalled();
      });

      expect(getEl('#resultsTitle').text).toBe('No exact matches found');
      expect(getEl('#resultsBrowseBtn').expand).toHaveBeenCalled();
    });
  });

  // ── 16. Restart quiz ──────────────────────────────────────────

  describe('restart quiz', () => {
    it('resets to step 0 and tracks quiz_restart', async () => {
      await onReadyHandler();
      clickRestart();

      // Advance to step 1
      selectOption('#quizOptionsRepeater', {
        value: 'living', label: 'Living Room',
      });
      clickNext();
      expect(getEl('#quizProgressText').text).toBe('Step 2 of 5');

      // Restart
      clickRestart();
      expect(getEl('#quizProgressText').text).toBe('Step 1 of 5');
      expect(getEl('#quizStepTitle').text).toBe('Where will your futon live?');
      expect(trackEvent).toHaveBeenCalledWith('quiz_restart');
    });
  });
});
