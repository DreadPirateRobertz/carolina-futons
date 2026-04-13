/**
 * Tests for SommelierWidget.js — CF-d9s
 * "Find Your Perfect Futon" quiz widget on PDP.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockGetRecommendations,
  mockSavePreferences,
  mockGetMyPreferences,
  mockGetMember,
} = vi.hoisted(() => ({
  mockGetRecommendations: vi.fn(),
  mockSavePreferences:    vi.fn(),
  mockGetMyPreferences:   vi.fn(),
  mockGetMember:          vi.fn(),
}));

vi.mock('backend/sommelierService.web', () => ({
  getRecommendations: mockGetRecommendations,
  savePreferences:    mockSavePreferences,
  getMyPreferences:   mockGetMyPreferences,
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: { getMember: mockGetMember },
}));

import { initSommelierWidget } from '../src/public/SommelierWidget.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    link: '',
    data: [],
    collapse: vi.fn(),
    expand:   vi.fn(),
    show:     vi.fn(),
    hide:     vi.fn(),
    onClick:  vi.fn(),
    onItemReady: vi.fn(),
    accessibility: {},
    ...overrides,
  };
}

function makeRepeater() {
  const el = makeEl();
  el._itemEls = {};
  el.onItemReady = vi.fn((cb) => { el._onItemReadyCb = cb; });
  Object.defineProperty(el, 'data', {
    get() { return el._data || []; },
    set(items) {
      el._data = items;
      if (el._onItemReadyCb) {
        for (const item of items) {
          if (!el._itemEls[item._id]) {
            el._itemEls[item._id] = {
              smProductImage: makeEl(),
              smProductName:  makeEl(),
              smMatchScore:   makeEl(),
              smCTA:          makeEl(),
            };
          }
          const itemEls = el._itemEls[item._id];
          const $item = (id) => itemEls[id.replace('#', '')] || makeEl();
          el._onItemReadyCb($item, item);
        }
      }
    },
  });
  return el;
}

function makeElements() {
  const repeater = makeRepeater();
  const elements = {
    '#sommelierSection':     makeEl(),
    '#sommelierTitle':       makeEl(),
    '#sommelierComfort':     makeEl(),
    '#sommelierSize':        makeEl(),
    '#sommelierBudget':      makeEl(),
    '#sommelierFindBtn':     makeEl(),
    '#sommelierError':       makeEl(),
    '#sommelierRepeater':    repeater,
    '#sommelierGuestPrompt': makeEl(),
  };
  return {
    $w: (id) => elements[id] || makeEl(),
    elements,
    repeater,
  };
}

function makeRecs(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    product: {
      _id: `prod-${i}`,
      name: `Futon ${i}`,
      slug: `futon-${i}`,
      price: 600 + i * 100,
      mainMedia: `wix:image://v1/img${i}.jpg`,
    },
    score: 90 - i * 10,
    matchScore: `${90 - i * 10}% match`,
  }));
}

const VALID_PARAMS = { comfort: 'medium', size: 'full', budget: '500-1000' };

beforeEach(() => {
  vi.clearAllMocks();
  // Default: guest user
  mockGetMember.mockResolvedValue(null);
  mockGetRecommendations.mockResolvedValue({ success: true, recommendations: makeRecs() });
  mockSavePreferences.mockResolvedValue({ success: true });
  mockGetMyPreferences.mockResolvedValue({ success: true, prefs: null });
});

// ── Section visibility ────────────────────────────────────────────────────────

describe('initSommelierWidget — section visibility', () => {
  it('expands the section on init', async () => {
    const { $w, elements } = makeElements();
    await initSommelierWidget($w, {});
    expect(elements['#sommelierSection'].expand).toHaveBeenCalled();
  });

  it('sets section title to Find Your Perfect Futon', async () => {
    const { $w, elements } = makeElements();
    await initSommelierWidget($w, {});
    expect(elements['#sommelierTitle'].text).toBe('Find Your Perfect Futon');
  });

  it('sets accessibility role to region', async () => {
    const { $w, elements } = makeElements();
    await initSommelierWidget($w, {});
    expect(elements['#sommelierSection'].accessibility.role).toBe('region');
  });

  it('sets accessibility ariaLabel', async () => {
    const { $w, elements } = makeElements();
    await initSommelierWidget($w, {});
    expect(elements['#sommelierSection'].accessibility.ariaLabel).toBe('Futon finder quiz');
  });
});

// ── Member preference hydration ───────────────────────────────────────────────

describe('initSommelierWidget — member preference hydration', () => {
  beforeEach(() => {
    mockGetMember.mockResolvedValue({ _id: 'mem-1' });
    mockGetMyPreferences.mockResolvedValue({
      success: true,
      prefs: { comfort: 'plush', size: 'queen', budget: '1000-2000' },
    });
  });

  it('pre-fills comfort dropdown from saved prefs', async () => {
    const { $w, elements } = makeElements();
    await initSommelierWidget($w, {});
    expect(elements['#sommelierComfort'].value).toBe('plush');
  });

  it('pre-fills size dropdown from saved prefs', async () => {
    const { $w, elements } = makeElements();
    await initSommelierWidget($w, {});
    expect(elements['#sommelierSize'].value).toBe('queen');
  });

  it('pre-fills budget dropdown from saved prefs', async () => {
    const { $w, elements } = makeElements();
    await initSommelierWidget($w, {});
    expect(elements['#sommelierBudget'].value).toBe('1000-2000');
  });

  it('does not pre-fill dropdowns for guest', async () => {
    mockGetMember.mockResolvedValue(null);
    const { $w, elements } = makeElements();
    await initSommelierWidget($w, {});
    // Dropdowns remain at default empty value
    expect(elements['#sommelierComfort'].value).toBe('');
    expect(elements['#sommelierSize'].value).toBe('');
    expect(elements['#sommelierBudget'].value).toBe('');
  });

  it('does not pre-fill when getMyPreferences returns null prefs', async () => {
    mockGetMyPreferences.mockResolvedValue({ success: true, prefs: null });
    const { $w, elements } = makeElements();
    await initSommelierWidget($w, {});
    expect(elements['#sommelierComfort'].value).toBe('');
  });
});

// ── Submit — no selection ─────────────────────────────────────────────────────

describe('initSommelierWidget — submit with missing selection', () => {
  it('shows error when comfort is not selected', async () => {
    const { $w, elements } = makeElements();
    await initSommelierWidget($w, {});
    // All dropdowns empty — click Find My Futon
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(elements['#sommelierError'].text).toContain('select all');
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });

  it('shows error when only comfort is selected', async () => {
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = 'plush';
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(elements['#sommelierError'].text).toContain('select all');
  });
});

// ── Submit — match found ──────────────────────────────────────────────────────

describe('initSommelierWidget — match found', () => {
  it('calls getRecommendations with correct params on submit', async () => {
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = VALID_PARAMS.comfort;
    elements['#sommelierSize'].value    = VALID_PARAMS.size;
    elements['#sommelierBudget'].value  = VALID_PARAMS.budget;
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(mockGetRecommendations).toHaveBeenCalledWith(VALID_PARAMS);
  });

  it('renders recommendations to the repeater', async () => {
    const { $w, elements, repeater } = makeElements();
    elements['#sommelierComfort'].value = 'medium';
    elements['#sommelierSize'].value    = 'full';
    elements['#sommelierBudget'].value  = '500-1000';
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(repeater._data).toHaveLength(3);
  });

  it('sets product name in repeater item', async () => {
    const { $w, repeater } = makeElements();
    const recs = makeRecs(1);
    mockGetRecommendations.mockResolvedValue({ success: true, recommendations: recs });
    const elems = {
      '#sommelierSection': makeEl(), '#sommelierTitle': makeEl(),
      '#sommelierComfort': { ...makeEl(), value: 'medium' },
      '#sommelierSize':    { ...makeEl(), value: 'full' },
      '#sommelierBudget':  { ...makeEl(), value: '500-1000' },
      '#sommelierFindBtn': makeEl(), '#sommelierError': makeEl(),
      '#sommelierRepeater': repeater, '#sommelierGuestPrompt': makeEl(),
    };
    const $w2 = (id) => elems[id] || makeEl();
    await initSommelierWidget($w2, {});
    const handler = elems['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    const recId = repeater._data[0]._id;
    expect(repeater._itemEls[recId].smProductName.text).toBe('Futon 0');
  });

  it('sets matchScore text in repeater item', async () => {
    const { $w, repeater } = makeElements();
    const recs = makeRecs(1);
    mockGetRecommendations.mockResolvedValue({ success: true, recommendations: recs });
    const elems = {
      '#sommelierSection': makeEl(), '#sommelierTitle': makeEl(),
      '#sommelierComfort': { ...makeEl(), value: 'firm' },
      '#sommelierSize':    { ...makeEl(), value: 'queen' },
      '#sommelierBudget':  { ...makeEl(), value: '1000-2000' },
      '#sommelierFindBtn': makeEl(), '#sommelierError': makeEl(),
      '#sommelierRepeater': repeater, '#sommelierGuestPrompt': makeEl(),
    };
    const $w2 = (id) => elems[id] || makeEl();
    await initSommelierWidget($w2, {});
    const handler = elems['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    const recId = repeater._data[0]._id;
    expect(repeater._itemEls[recId].smMatchScore.text).toBe('90% match');
  });

  it('clears error text on successful submission', async () => {
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = 'medium';
    elements['#sommelierSize'].value    = 'full';
    elements['#sommelierBudget'].value  = '500-1000';
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(elements['#sommelierError'].text).toBe('');
  });
});

// ── Submit — no match ─────────────────────────────────────────────────────────

describe('initSommelierWidget — no match', () => {
  it('shows empty-state message when recommendations is empty', async () => {
    mockGetRecommendations.mockResolvedValue({ success: true, recommendations: [] });
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = 'plush';
    elements['#sommelierSize'].value    = 'twin';
    elements['#sommelierBudget'].value  = 'under-500';
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(elements['#sommelierError'].text).toContain('No matches');
  });
});

// ── Submit — query error ──────────────────────────────────────────────────────

describe('initSommelierWidget — query error', () => {
  it('shows error when getRecommendations returns success:false', async () => {
    mockGetRecommendations.mockResolvedValue({ success: false, recommendations: [], error: 'internal_error' });
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = 'medium';
    elements['#sommelierSize'].value    = 'full';
    elements['#sommelierBudget'].value  = '500-1000';
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(elements['#sommelierError'].text).toMatch(/load recommendations/i);
  });

  it('shows error when getRecommendations throws', async () => {
    mockGetRecommendations.mockRejectedValue(new Error('network'));
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = 'medium';
    elements['#sommelierSize'].value    = 'full';
    elements['#sommelierBudget'].value  = '500-1000';
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(elements['#sommelierError'].text).toMatch(/try again/i);
  });
});

// ── Guest vs member ───────────────────────────────────────────────────────────

describe('initSommelierWidget — guest vs member', () => {
  it('shows guest prompt after results for a guest', async () => {
    mockGetMember.mockResolvedValue(null);
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = 'medium';
    elements['#sommelierSize'].value    = 'full';
    elements['#sommelierBudget'].value  = '500-1000';
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(elements['#sommelierGuestPrompt'].show).toHaveBeenCalled();
    expect(elements['#sommelierGuestPrompt'].text).toContain('Sign in');
  });

  it('does not call savePreferences for a guest', async () => {
    mockGetMember.mockResolvedValue(null);
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = 'medium';
    elements['#sommelierSize'].value    = 'full';
    elements['#sommelierBudget'].value  = '500-1000';
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(mockSavePreferences).not.toHaveBeenCalled();
  });

  it('calls savePreferences with correct params for a member', async () => {
    mockGetMember.mockResolvedValue({ _id: 'mem-1' });
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = 'firm';
    elements['#sommelierSize'].value    = 'king';
    elements['#sommelierBudget'].value  = 'over-2000';
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(mockSavePreferences).toHaveBeenCalledWith({ comfort: 'firm', size: 'king', budget: 'over-2000' });
  });

  it('does not show guest prompt for a member after results', async () => {
    mockGetMember.mockResolvedValue({ _id: 'mem-1' });
    mockGetMyPreferences.mockResolvedValue({ success: true, prefs: null });
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = 'medium';
    elements['#sommelierSize'].value    = 'full';
    elements['#sommelierBudget'].value  = '500-1000';
    await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    await handler?.();
    expect(elements['#sommelierGuestPrompt'].show).not.toHaveBeenCalled();
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('initSommelierWidget — destroy', () => {
  it('returns a destroy function', async () => {
    const { $w } = makeElements();
    const result = await initSommelierWidget($w, {});
    expect(typeof result.destroy).toBe('function');
  });

  it('clicking Find My Futon after destroy does not call getRecommendations', async () => {
    const { $w, elements } = makeElements();
    elements['#sommelierComfort'].value = 'medium';
    elements['#sommelierSize'].value    = 'full';
    elements['#sommelierBudget'].value  = '500-1000';
    const { destroy } = await initSommelierWidget($w, {});
    const handler = elements['#sommelierFindBtn'].onClick.mock.calls[0]?.[0];
    destroy();
    await handler?.();
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });
});
