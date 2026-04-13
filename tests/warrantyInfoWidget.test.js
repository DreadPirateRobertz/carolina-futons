/**
 * Tests for WarrantyInfoWidget.js — CF-bog
 * Collapsible warranty info section on PDP.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initWarrantyInfoWidget } from '../src/public/WarrantyInfoWidget.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    label: '',
    link: '',
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
    '#warrantySection':  makeEl(),
    '#warrantyTitle':    makeEl(),
    '#warrantyDuration': makeEl(),
    '#warrantyCoverage': makeEl(),
    '#warrantyClaimBtn': makeEl(),
  };
  return {
    $w: (id) => elements[id] || makeEl(),
    elements,
  };
}

function makeProduct(overrides = {}) {
  return {
    _id:           'prod-1',
    warrantyYears: 2,
    warrantyType:  'limited',
    ...overrides,
  };
}

function makeState(productOverrides = {}) {
  return { product: makeProduct(productOverrides) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Standard limited warranty ─────────────────────────────────────────────────

describe('initWarrantyInfoWidget — standard limited warranty', () => {
  it('expands the section for a product with warranty data', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState());
    expect(elements['#warrantySection'].expand).toHaveBeenCalled();
  });

  it('sets section title to Warranty & Guarantee', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState());
    expect(elements['#warrantyTitle'].text).toBe('Warranty & Guarantee');
  });

  it('renders 2-Year Limited Warranty for 2 years limited', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyYears: 2, warrantyType: 'limited' }));
    expect(elements['#warrantyDuration'].text).toBe('2-Year Limited Warranty');
  });

  it('renders 1-Year Limited Warranty (singular) for 1 year', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyYears: 1, warrantyType: 'limited' }));
    expect(elements['#warrantyDuration'].text).toBe('1-Year Limited Warranty');
  });

  it('renders 5-Year Full Warranty for 5 years full', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyYears: 5, warrantyType: 'full' }));
    expect(elements['#warrantyDuration'].text).toBe('5-Year Full Warranty');
  });

  it('sets coverage text for limited warranty', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyYears: 2, warrantyType: 'limited' }));
    expect(elements['#warrantyCoverage'].text).toContain('limited warranty');
  });

  it('sets coverage text for full warranty', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyYears: 3, warrantyType: 'full' }));
    expect(elements['#warrantyCoverage'].text).toContain('full warranty');
  });

  it('sets claim button label', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState());
    expect(elements['#warrantyClaimBtn'].label).toBe('File a Warranty Claim');
  });

  it('sets claim button link to warranty claim page', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState());
    expect(elements['#warrantyClaimBtn'].link).toBe('/warranty-claim');
  });

  it('sets section accessibility role to region', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState());
    expect(elements['#warrantySection'].accessibility.role).toBe('region');
  });

  it('sets section accessibility ariaLabel', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState());
    expect(elements['#warrantySection'].accessibility.ariaLabel).toBe('Warranty information');
  });
});

// ── Lifetime warranty ─────────────────────────────────────────────────────────

describe('initWarrantyInfoWidget — lifetime warranty', () => {
  it('renders Lifetime Warranty label for warrantyType lifetime', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyType: 'lifetime', warrantyYears: 999 }));
    expect(elements['#warrantyDuration'].text).toBe('Lifetime Warranty');
  });

  it('renders Lifetime Warranty even when warrantyYears is 0', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyType: 'lifetime', warrantyYears: 0 }));
    expect(elements['#warrantyDuration'].text).toBe('Lifetime Warranty');
  });

  it('sets lifetime coverage text', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyType: 'lifetime', warrantyYears: 999 }));
    expect(elements['#warrantyCoverage'].text).toContain('lifetime warranty');
  });

  it('expands the section for lifetime warranty', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyType: 'lifetime', warrantyYears: 999 }));
    expect(elements['#warrantySection'].expand).toHaveBeenCalled();
  });
});

// ── No warranty — fallback ────────────────────────────────────────────────────

describe('initWarrantyInfoWidget — no warranty fallback', () => {
  it('collapses section when warrantyType is none', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyType: 'none', warrantyYears: 0 }));
    expect(elements['#warrantySection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when warrantyYears is 0 and no type', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyYears: 0, warrantyType: '' }));
    expect(elements['#warrantySection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when product has no warranty fields', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, { product: { _id: 'prod-bare' } });
    expect(elements['#warrantySection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when state is null', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, null);
    expect(elements['#warrantySection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when state.product is null', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, { product: null });
    expect(elements['#warrantySection'].collapse).toHaveBeenCalled();
  });

  it('collapses section for unknown warrantyType', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyType: 'extended', warrantyYears: 3 }));
    expect(elements['#warrantySection'].collapse).toHaveBeenCalled();
  });

  it('does not set duration text when no warranty', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyType: 'none', warrantyYears: 0 }));
    expect(elements['#warrantyDuration'].text).toBe('');
  });
});

// ── Claim link ────────────────────────────────────────────────────────────────

describe('initWarrantyInfoWidget — claim link', () => {
  it('always points to the warranty claim URL', () => {
    const { $w, elements } = makeElements();
    initWarrantyInfoWidget($w, makeState({ warrantyYears: 5, warrantyType: 'full' }));
    expect(elements['#warrantyClaimBtn'].link).toBe('/warranty-claim');
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('initWarrantyInfoWidget — destroy', () => {
  it('returns a destroy function', () => {
    const { $w } = makeElements();
    const result = initWarrantyInfoWidget($w, makeState());
    expect(typeof result.destroy).toBe('function');
  });

  it('destroy() can be called without throwing', () => {
    const { $w } = makeElements();
    const { destroy } = initWarrantyInfoWidget($w, makeState());
    expect(() => destroy()).not.toThrow();
  });
});
