/**
 * Tests for FurnitureCareGuideWidget.js — CF-gbv
 * Collapsible per-product care instructions on the PDP.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initFurnitureCareGuideWidget } from '../src/public/FurnitureCareGuideWidget.js';

// ── Mock backend service ──────────────────────────────────────────────────────

const mockGetCareGuide = vi.hoisted(() => vi.fn());

vi.mock('backend/furnitureCareGuideService.web', () => ({
  getCareGuide: mockGetCareGuide,
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    label: '',
    collapse: vi.fn(),
    expand:   vi.fn(),
    show:     vi.fn(),
    hide:     vi.fn(),
    accessibility: {},
    ...overrides,
  };
}

function makeElements() {
  const elements = {
    '#careGuideSection':    makeEl(),
    '#careGuideTitle':      makeEl(),
    '#careGuideMaterial':   makeEl(),
    '#careGuideCleaning':   makeEl(),
    '#careGuideMaintenance': makeEl(),
    '#careGuideWarnings':   makeEl(),
  };
  return {
    $w: (id) => elements[id] || makeEl(),
    elements,
  };
}

function makeGuide(overrides = {}) {
  return {
    material:        'fabric',
    cleaningMethod:  'Blot stains immediately.',
    maintenanceTips: 'Rotate cushions monthly.',
    warningNotes:    'Do not use bleach.',
    ...overrides,
  };
}

function makeState(overrides = {}) {
  return {
    product: {
      _id:   'prod-1',
      slug:  'comfort-futon',
      name:  'Comfort Futon',
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Fabric product ────────────────────────────────────────────────────────────

describe('initFurnitureCareGuideWidget — fabric product', () => {
  it('expands the section for a fabric product', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideSection'].expand).toHaveBeenCalled();
  });

  it('sets section title to Care & Maintenance', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideTitle'].text).toBe('Care & Maintenance');
  });

  it('sets material label to Fabric Care', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide({ material: 'fabric' }) });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideMaterial'].text).toBe('Fabric Care');
  });

  it('sets cleaningMethod from guide', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideCleaning'].text).toBe('Blot stains immediately.');
  });

  it('sets maintenanceTips from guide', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideMaintenance'].text).toBe('Rotate cushions monthly.');
  });

  it('sets warningNotes from guide', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideWarnings'].text).toBe('Do not use bleach.');
  });

  it('sets section accessibility role to region', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideSection'].accessibility.role).toBe('region');
  });

  it('sets section accessibility ariaLabel', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideSection'].accessibility.ariaLabel).toBe('Care and maintenance guide');
  });
});

// ── Wood product ──────────────────────────────────────────────────────────────

describe('initFurnitureCareGuideWidget — wood product', () => {
  it('sets material label to Wood Care', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide({ material: 'wood' }) });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideMaterial'].text).toBe('Wood Care');
  });

  it('expands the section', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide({ material: 'wood' }) });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideSection'].expand).toHaveBeenCalled();
  });
});

// ── Metal product ─────────────────────────────────────────────────────────────

describe('initFurnitureCareGuideWidget — metal product', () => {
  it('sets material label to Metal Care', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide({ material: 'metal' }) });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideMaterial'].text).toBe('Metal Care');
  });
});

// ── Leather product ───────────────────────────────────────────────────────────

describe('initFurnitureCareGuideWidget — leather product', () => {
  it('sets material label to Leather Care', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide({ material: 'leather' }) });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideMaterial'].text).toBe('Leather Care');
  });
});

// ── Generic fallback — no CMS record ─────────────────────────────────────────

describe('initFurnitureCareGuideWidget — generic fallback (guide null)', () => {
  it('still expands the section when guide is null', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: null });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideSection'].expand).toHaveBeenCalled();
  });

  it('sets material label to General Care for fallback', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: null });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideMaterial'].text).toBe('General Care');
  });

  it('populates cleaningMethod with generic copy', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: null });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideCleaning'].text).toContain('soft');
  });

  it('populates maintenanceTips with generic copy', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: null });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideMaintenance'].text).toContain('sunlight');
  });

  it('populates warningNotes with generic copy', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: null });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideWarnings'].text).toContain('bleach');
  });

  it('does not collapse the section', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: null });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideSection'].collapse).not.toHaveBeenCalled();
  });
});

// ── Generic fallback — service failure ───────────────────────────────────────

describe('initFurnitureCareGuideWidget — generic fallback (service error)', () => {
  it('still expands section when service throws', async () => {
    mockGetCareGuide.mockRejectedValue(new Error('network error'));
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideSection'].expand).toHaveBeenCalled();
  });

  it('shows generic material label on service failure', async () => {
    mockGetCareGuide.mockRejectedValue(new Error('network error'));
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideMaterial'].text).toBe('General Care');
  });

  it('still expands when service returns success false', async () => {
    mockGetCareGuide.mockResolvedValue({ success: false, error: 'internal_error' });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideSection'].expand).toHaveBeenCalled();
  });
});

// ── Missing fields in guide ───────────────────────────────────────────────────

describe('initFurnitureCareGuideWidget — guide with missing fields', () => {
  it('falls back to generic cleaning when cleaningMethod is empty', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide({ cleaningMethod: '' }) });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideCleaning'].text).toContain('soft');
  });

  it('falls back to generic maintenance when maintenanceTips is empty', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide({ maintenanceTips: '' }) });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideMaintenance'].text).toContain('sunlight');
  });

  it('falls back to generic warnings when warningNotes is empty', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide({ warningNotes: '' }) });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideWarnings'].text).toContain('bleach');
  });

  it('sets General Care label for unknown material type', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide({ material: 'unknown' }) });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideMaterial'].text).toBe('General Care');
  });
});

// ── Collapse — missing slug ───────────────────────────────────────────────────

describe('initFurnitureCareGuideWidget — collapse on missing slug', () => {
  it('collapses section when state is null', async () => {
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, null);
    expect(elements['#careGuideSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when state.product is null', async () => {
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, { product: null });
    expect(elements['#careGuideSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when product has no slug', async () => {
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, { product: { _id: 'prod-1' } });
    expect(elements['#careGuideSection'].collapse).toHaveBeenCalled();
  });

  it('does not call getCareGuide when slug is missing', async () => {
    const { $w } = makeElements();
    await initFurnitureCareGuideWidget($w, null);
    expect(mockGetCareGuide).not.toHaveBeenCalled();
  });
});

// ── Expand/collapse interaction ───────────────────────────────────────────────

describe('initFurnitureCareGuideWidget — expand/collapse interaction', () => {
  it('does not collapse when guide is present', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w, elements } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(elements['#careGuideSection'].collapse).not.toHaveBeenCalled();
  });

  it('calls getCareGuide with the product slug', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w } = makeElements();
    await initFurnitureCareGuideWidget($w, makeState());
    expect(mockGetCareGuide).toHaveBeenCalledWith('comfort-futon');
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('initFurnitureCareGuideWidget — destroy', () => {
  it('returns a destroy function', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w } = makeElements();
    const result = await initFurnitureCareGuideWidget($w, makeState());
    expect(typeof result.destroy).toBe('function');
  });

  it('destroy() can be called without throwing', async () => {
    mockGetCareGuide.mockResolvedValue({ success: true, guide: makeGuide() });
    const { $w } = makeElements();
    const { destroy } = await initFurnitureCareGuideWidget($w, makeState());
    expect(() => destroy()).not.toThrow();
  });

  it('returns destroy even when section collapses', async () => {
    const { $w } = makeElements();
    const result = await initFurnitureCareGuideWidget($w, null);
    expect(typeof result.destroy).toBe('function');
  });
});
