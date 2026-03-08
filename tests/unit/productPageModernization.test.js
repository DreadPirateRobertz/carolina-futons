import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// CF-isru: Product Page Modernization Tests
// Tests for enhanced delivery estimate (zip code input) and
// prominent "Get Free Swatches" CTA
// ═══════════════════════════════════════════════════════════════════

vi.mock('backend/seoHelpers.web', () => ({
  getProductSchema: vi.fn(), getBreadcrumbSchema: vi.fn(),
  getProductOgTags: vi.fn(), getProductFaqSchema: vi.fn(),
}));
vi.mock('backend/emailService.web', () => ({
  submitSwatchRequest: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('public/productPageUtils.js', () => ({
  getCategoryFromCollections: vi.fn(() => ({ label: 'Futon Frames', path: '/futon-frames' })),
  addBusinessDays: vi.fn((date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }),
}));
vi.mock('public/engagementTracker', () => ({
  trackSocialShare: vi.fn(), trackEvent: vi.fn(),
}));
vi.mock('public/a11yHelpers', () => ({
  makeClickable: vi.fn((el, handler) => { if (el && handler) el.onClick(handler); }),
  announce: vi.fn(),
}));
vi.mock('public/validators.js', () => ({
  validateEmail: vi.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
}));
vi.mock('public/designTokens.js', () => ({
  colors: {
    sandBase: '#E8D5B7', espresso: '#3A2518', mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C', white: '#FFFFFF', offWhite: '#FAF7F2',
  },
}));

// ── $w mock factory ─────────────────────────────────────────────────
function createMock$w() {
  const elements = {};

  function getOrCreate(id) {
    if (!elements[id]) {
      elements[id] = {
        text: '',
        value: '',
        label: '',
        src: '',
        hidden: false,
        collapsed: false,
        enabled: true,
        style: {},
        accessibility: {},
        show: vi.fn(function () { this.hidden = false; return Promise.resolve(); }),
        hide: vi.fn(function () { this.hidden = true; return Promise.resolve(); }),
        expand: vi.fn(function () { this.collapsed = false; }),
        collapse: vi.fn(function () { this.collapsed = true; }),
        enable: vi.fn(function () { this.enabled = true; }),
        disable: vi.fn(function () { this.enabled = false; }),
        onClick: vi.fn(),
        onKeyPress: vi.fn(),
        onChange: vi.fn(),
        focus: vi.fn(),
      };
    }
    return elements[id];
  }

  const $w = vi.fn((selector) => getOrCreate(selector));
  $w._elements = elements;
  return $w;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('CF-isru: Enhanced Delivery Estimate', () => {
  let $w, initDeliveryEstimate;

  beforeEach(async () => {
    vi.clearAllMocks();
    $w = createMock$w();
    const mod = await import('../../src/public/ProductDetails.js');
    initDeliveryEstimate = mod.initDeliveryEstimate;
  });

  it('shows default delivery estimate without zip code', () => {
    const state = { product: { name: 'Eureka Futon Frame', weight: 30 } };
    initDeliveryEstimate($w, state);

    const el = $w._elements['#deliveryEstimate'];
    expect(el).toBeTruthy();
    expect(el.text).toContain('Estimated delivery');
    expect(el.show).toHaveBeenCalled();
  });

  it('shows white-glove note for heavy items (weight > 50)', () => {
    const state = { product: { name: 'Heavy Frame', weight: 75 } };
    initDeliveryEstimate($w, state);

    const note = $w._elements['#whiteGloveNote'];
    expect(note.text).toContain('White-glove');
    expect(note.show).toHaveBeenCalled();
  });

  it('shows white-glove note for murphy/platform/futon collections', () => {
    const state = { product: { name: 'Test', weight: 20, collections: ['murphy-cabinet-beds'] } };
    initDeliveryEstimate($w, state);

    const note = $w._elements['#whiteGloveNote'];
    expect(note.text).toContain('White-glove');
    expect(note.show).toHaveBeenCalled();
  });

  it('does not show white-glove for light accessories', () => {
    const state = { product: { name: 'Pillow', weight: 3, collections: ['accessories'] } };
    initDeliveryEstimate($w, state);

    const note = $w._elements['#whiteGloveNote'];
    // Element may not be accessed if condition doesn't match, or show is not called
    if (note) {
      expect(note.show).not.toHaveBeenCalled();
    }
    // If note was never accessed, that's also correct — no white-glove shown
    expect(true).toBe(true);
  });

  it('handles missing product gracefully', () => {
    const state = { product: null };
    expect(() => initDeliveryEstimate($w, state)).not.toThrow();
  });

  it('initializes zip code input if element exists', () => {
    const state = { product: { name: 'Test Frame', weight: 30 } };
    initDeliveryEstimate($w, state);

    const zipInput = $w._elements['#deliveryZipInput'];
    const zipBtn = $w._elements['#deliveryZipBtn'];
    // The zip input should have an onChange or the button should have onClick wired
    expect(zipBtn.onClick).toHaveBeenCalled();
  });

  it('sets ARIA label on zip code input', () => {
    const state = { product: { name: 'Test Frame', weight: 30 } };
    initDeliveryEstimate($w, state);

    const zipInput = $w._elements['#deliveryZipInput'];
    expect(zipInput.accessibility.ariaLabel).toContain('zip');
  });
});

describe('CF-isru: Prominent Swatch CTA', () => {
  let $w, initSwatchCTA;

  beforeEach(async () => {
    vi.clearAllMocks();
    $w = createMock$w();
    const mod = await import('../../src/public/ProductDetails.js');
    initSwatchCTA = mod.initSwatchCTA;
  });

  it('exports initSwatchCTA function', () => {
    expect(typeof initSwatchCTA).toBe('function');
  });

  it('shows swatch CTA button with brand text', () => {
    const state = { product: { name: 'Eureka', productOptions: [{ name: 'Fabric' }] } };
    initSwatchCTA($w, state);

    const btn = $w._elements['#swatchCTABtn'];
    expect(btn.label).toContain('Free Swatch');
    expect(btn.show).toHaveBeenCalled();
  });

  it('applies brand styling to swatch CTA (coral bg, espresso text for WCAG AA)', () => {
    const state = { product: { name: 'Eureka', productOptions: [{ name: 'Fabric' }] } };
    initSwatchCTA($w, state);

    const btn = $w._elements['#swatchCTABtn'];
    expect(btn.style.backgroundColor).toBe('#E8845C');
    expect(btn.style.color).toBe('#3A2518');
  });

  it('sets ARIA label on swatch CTA', () => {
    const state = { product: { name: 'Eureka', productOptions: [{ name: 'Cover' }] } };
    initSwatchCTA($w, state);

    const btn = $w._elements['#swatchCTABtn'];
    expect(btn.accessibility.ariaLabel).toContain('swatch');
  });

  it('handles product without fabric options gracefully', () => {
    const state = { product: { name: 'Wood Frame', productOptions: [{ name: 'Size' }] } };
    initSwatchCTA($w, state);

    const btn = $w._elements['#swatchCTABtn'];
    // Should still show but with generic text
    expect(btn.show).toHaveBeenCalled();
  });

  it('handles missing product gracefully', () => {
    const state = { product: null };
    expect(() => initSwatchCTA($w, state)).not.toThrow();
  });
});
