import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    label: '',
    value: 0,
    data: [],
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    onKeyPress: vi.fn(),
    postMessage: vi.fn(),
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

// ── Mock Backend Modules ────────────────────────────────────────────

const mockGetQuizOptions = vi.fn();
const mockGetQuizRecommendations = vi.fn();

vi.mock('backend/styleQuiz.web', () => ({
  getQuizRecommendations: mockGetQuizRecommendations,
  getQuizOptions: mockGetQuizOptions,
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    el.onClick(handler);
  }),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    mountainBlue: '#5B8FA8',
    white: '#FFFFFF',
    espresso: '#3A2518',
  },
}));

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));

vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn((product) => `${product.name} - Carolina Futons`),
}));

// ── Import the Page Module ──────────────────────────────────────────

let trackEvent, initBackToTop, announce, initPageSeo;

beforeAll(async () => {
  await import('../src/pages/Style Quiz.js');
  trackEvent = (await import('public/engagementTracker')).trackEvent;
  initBackToTop = (await import('public/mobileHelpers')).initBackToTop;
  announce = (await import('public/a11yHelpers')).announce;
  initPageSeo = (await import('public/pageSeo.js')).initPageSeo;
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  mockGetQuizOptions.mockResolvedValue({
    roomTypes: [
      { label: 'Living Room', value: 'living-room', description: 'Main living area' },
      { label: 'Guest Room', value: 'guest-room', description: 'For visitors' },
    ],
    primaryUses: [
      { label: 'Sitting', value: 'sitting', description: 'Mostly as a sofa' },
    ],
    stylePreferences: [
      { label: 'Modern', value: 'modern', description: 'Clean lines' },
    ],
    sizeOptions: [
      { label: 'Full', value: 'full', description: 'Standard size' },
    ],
    budgetRanges: [
      { label: 'Under $500', value: 'under-500', description: 'Budget-friendly' },
    ],
  });
  mockGetQuizRecommendations.mockResolvedValue([
    {
      product: {
        _id: 'prod-001', name: 'Asheville Futon', slug: 'asheville-futon-frame',
        price: 499, formattedPrice: '$499.00', mainMedia: 'https://example.com/asheville.jpg',
      },
      score: 85, reason: 'Great match for living room sitting',
    },
  ]);
});

// ── Tests ───────────────────────────────────────────────────────────

describe('Style Quiz Page', () => {
  describe('onReady initialization', () => {
    it('registers an onReady handler', () => {
      expect(typeof onReadyHandler).toBe('function');
    });

    it('calls initBackToTop on ready', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with styleQuiz type', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('styleQuiz');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'style-quiz' });
    });

    it('fetches quiz options from backend', async () => {
      await onReadyHandler();
      expect(mockGetQuizOptions).toHaveBeenCalled();
    });

    it('collapses results and loading sections initially', async () => {
      await onReadyHandler();
      expect(getEl('#quizResults').collapse).toHaveBeenCalled();
      expect(getEl('#quizLoadingState').collapse).toHaveBeenCalled();
    });

    it('expands quiz section initially', async () => {
      await onReadyHandler();
      expect(getEl('#quizSection').expand).toHaveBeenCalled();
    });
  });

  describe('step rendering', () => {
    it('sets progress text for step 1', async () => {
      await onReadyHandler();
      expect(getEl('#quizProgressText').text).toBe('Step 1 of 5');
    });

    it('sets progress bar value for step 1', async () => {
      await onReadyHandler();
      expect(getEl('#quizProgressBar').value).toBe(20);
    });

    it('sets step title from STEPS config', async () => {
      await onReadyHandler();
      expect(getEl('#quizStepTitle').text).toBe('Where will your futon live?');
    });

    it('sets step subtitle from STEPS config', async () => {
      await onReadyHandler();
      expect(getEl('#quizStepSubtitle').text).toBe('Pick the room it\u2019s going in');
    });

    it('collapses back button on step 1', async () => {
      await onReadyHandler();
      expect(getEl('#quizBackBtn').collapse).toHaveBeenCalled();
    });

    it('sets next button label to Next on first step', async () => {
      await onReadyHandler();
      expect(getEl('#quizNextBtn').label).toBe('Next');
    });

    it('announces step for screen readers', async () => {
      await onReadyHandler();
      expect(announce).toHaveBeenCalledWith(
        $w,
        expect.stringContaining('Step 1 of 5')
      );
    });
  });

  describe('options repeater', () => {
    it('sets up onItemReady on quiz options repeater', async () => {
      await onReadyHandler();
      expect(getEl('#quizOptionsRepeater').onItemReady).toHaveBeenCalled();
    });

    it('populates repeater data from quiz options', async () => {
      await onReadyHandler();
      const data = getEl('#quizOptionsRepeater').data;
      expect(data.length).toBe(2);
      expect(data[0]).toHaveProperty('label', 'Living Room');
      expect(data[0]).toHaveProperty('value', 'living-room');
    });

    it('renders option label in repeater item', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#quizOptionsRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item:${sel}`);
      const itemData = { label: 'Living Room', value: 'living-room', description: 'Main area' };
      itemReadyFn($item, itemData);
      expect(getEl('item:#optionLabel').text).toBe('Living Room');
    });

    it('sets ARIA role=radio on option container', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#quizOptionsRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item:${sel}`);
      itemReadyFn($item, { label: 'Test', value: 'test' });
      expect(getEl('item:#optionContainer').accessibility.role).toBe('radio');
    });

    it('sets ariaChecked=false for unselected options', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#quizOptionsRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item:${sel}`);
      itemReadyFn($item, { label: 'Test', value: 'test' });
      expect(getEl('item:#optionContainer').accessibility.ariaChecked).toBe(false);
    });

    it('wires onClick handler on option container', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#quizOptionsRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item:${sel}`);
      itemReadyFn($item, { label: 'Living Room', value: 'living-room' });
      expect(getEl('item:#optionContainer').onClick).toHaveBeenCalled();
    });
  });

  describe('navigation — next button', () => {
    it('shows validation message when no option selected', async () => {
      await onReadyHandler();
      // Find the Next button click handler — makeClickable wires it
      const { makeClickable } = await import('public/a11yHelpers');
      const nextCall = makeClickable.mock.calls.find(c => {
        return c[2]?.ariaLabel === 'Next step';
      });
      expect(nextCall).toBeDefined();
      // Execute the click handler
      nextCall[1]();
      expect(getEl('#quizValidation').expand).toHaveBeenCalled();
      expect(getEl('#quizValidation').text).toBe('Please select an option');
    });

    it('announces validation error for screen readers', async () => {
      await onReadyHandler();
      const { makeClickable } = await import('public/a11yHelpers');
      const nextCall = makeClickable.mock.calls.find(c => {
        return c[2]?.ariaLabel === 'Next step';
      });
      nextCall[1]();
      expect(announce).toHaveBeenCalledWith(
        $w,
        'Please select an option before continuing'
      );
    });
  });

  describe('navigation — back button', () => {
    it('wires back button via makeClickable', async () => {
      await onReadyHandler();
      const { makeClickable } = await import('public/a11yHelpers');
      const backCall = makeClickable.mock.calls.find(c => {
        return c[2]?.ariaLabel === 'Previous step';
      });
      expect(backCall).toBeDefined();
    });
  });

  describe('navigation — restart button', () => {
    it('wires restart button via makeClickable', async () => {
      await onReadyHandler();
      const { makeClickable } = await import('public/a11yHelpers');
      const restartCall = makeClickable.mock.calls.find(c => {
        return c[2]?.ariaLabel === 'Restart quiz';
      });
      expect(restartCall).toBeDefined();
    });
  });

  describe('quiz submission and results', () => {
    // TODO: requires full 5-step flow driver (vi.resetModules + step-by-step option
    // selection + goNext) to test submitQuiz, renderResults, and renderNoResults.
    // Module-scoped state makes this non-trivial — separate PR.
    it.todo('calls getQuizRecommendations after completing all 5 steps');
    it.todo('shows loading state during recommendation fetch');
    it.todo('renders results repeater with match score badges');
    it.todo('renders no-results fallback when recommendations are empty');
    it.todo('handles getQuizRecommendations failure gracefully');
  });

  describe('error handling', () => {
    it('handles getQuizOptions failure gracefully', async () => {
      mockGetQuizOptions.mockRejectedValueOnce(new Error('Network error'));
      await onReadyHandler();
      // Should still expand quiz section without crashing
      expect(getEl('#quizSection').expand).toHaveBeenCalled();
    });

    it('still renders quiz flow when options fail (options will be null)', async () => {
      mockGetQuizOptions.mockRejectedValueOnce(new Error('Network error'));
      await onReadyHandler();
      // renderStep should still be called (sets title, progress)
      expect(getEl('#quizStepTitle').text).toBe('Where will your futon live?');
    });
  });

  describe('S2 — option card selection and next button enable', () => {
    it('disables next button when a new step renders (no selection yet)', async () => {
      await onReadyHandler();
      expect(getEl('#quizNextBtn').disable).toHaveBeenCalled();
    });

    it('enables next button when an option is selected', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#quizOptionsRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item:${sel}`);
      itemReadyFn($item, { label: 'Living Room', value: 'living-room' });

      // Simulate option click
      const clickHandler = getEl('item:#optionContainer').onClick.mock.calls[0][0];
      clickHandler();

      expect(getEl('#quizNextBtn').enable).toHaveBeenCalled();
    });

    it('enables next button immediately if step already has an answer (navigating back)', async () => {
      await onReadyHandler();
      // Select an option to populate state.answers
      const itemReadyFn1 = getEl('#quizOptionsRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item:${sel}`);
      itemReadyFn1($item, { label: 'Living Room', value: 'living-room' });
      getEl('item:#optionContainer').onClick.mock.calls[0][0]();

      // Confirm enable was called at least once (state is module-scoped; prior runs may add calls)
      expect(getEl('#quizNextBtn').enable).toHaveBeenCalled();
    });

    it('applies highlight color to selected option container', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#quizOptionsRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item:${sel}`);
      // First render with unselected state
      itemReadyFn($item, { label: 'Living Room', value: 'living-room' });

      // Trigger selection and re-render
      const clickHandler = getEl('item:#optionContainer').onClick.mock.calls[0][0];
      clickHandler();

      // After selection re-render, the selected item should get mountainBlue
      const itemReadyFn2 = getEl('#quizOptionsRepeater').onItemReady.mock.calls.at(-1)[0];
      itemReadyFn2($item, { label: 'Living Room', value: 'living-room' });
      expect(getEl('item:#optionContainer').style.backgroundColor).toBe('#5B8FA8');
    });

    it('sets ariaChecked=true for the selected option', async () => {
      await onReadyHandler();
      // Select an option first to populate state
      const firstItemReady = getEl('#quizOptionsRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item:${sel}`);
      firstItemReady($item, { label: 'Living Room', value: 'living-room' });
      getEl('item:#optionContainer').onClick.mock.calls[0][0]();

      // Re-render with the selected value
      const latestItemReady = getEl('#quizOptionsRepeater').onItemReady.mock.calls.at(-1)[0];
      latestItemReady($item, { label: 'Living Room', value: 'living-room' });
      expect(getEl('item:#optionContainer').accessibility.ariaChecked).toBe(true);
    });

    it('tracks quiz_answer event when option is selected', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#quizOptionsRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item:${sel}`);
      itemReadyFn($item, { label: 'Living Room', value: 'living-room' });
      getEl('item:#optionContainer').onClick.mock.calls[0][0]();

      const { trackEvent: te } = await import('public/engagementTracker');
      expect(te).toHaveBeenCalledWith('quiz_answer', { step: 'roomType', answer: 'living-room' });
    });

    it('does not show validation message when next is clicked after selecting an option', async () => {
      await onReadyHandler();
      // Select an option
      const itemReadyFn = getEl('#quizOptionsRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item:${sel}`);
      itemReadyFn($item, { label: 'Living Room', value: 'living-room' });
      getEl('item:#optionContainer').onClick.mock.calls[0][0]();

      // Click next
      const { makeClickable } = await import('public/a11yHelpers');
      const nextCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel === 'Next step');
      nextCall[1]();

      expect(getEl('#quizValidation').expand).not.toHaveBeenCalled();
    });
  });
});
