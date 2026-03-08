import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __reset } from '../__mocks__/wix-data.js';
import {
  COMFORT_ICONS,
  renderComfortCard,
  initComfortCards,
  initComfortFilter,
} from '../../src/public/ComfortStoryCards.js';
import { getComfortSvg } from '../../src/public/comfortIllustrations.js';

// ── Seed Data ──────────────────────────────────────────────────────

const COMFORT_LEVELS = [
  {
    _id: 'cl-plush',
    slug: 'plush',
    name: 'Plush',
    tagline: 'Sink in and unwind',
    description: 'Cloud-soft comfort that cradles you.',
    illustration: 'wix:image://v1/plush-illustration.jpg',
    illustrationAlt: 'Plush comfort cloud illustration',
    sortOrder: 1,
  },
  {
    _id: 'cl-medium',
    slug: 'medium',
    name: 'Medium',
    tagline: 'Balanced support',
    description: 'The best of both worlds — soft yet supportive.',
    illustration: 'wix:image://v1/medium-illustration.jpg',
    illustrationAlt: 'Medium comfort balanced illustration',
    sortOrder: 2,
  },
  {
    _id: 'cl-firm',
    slug: 'firm',
    name: 'Firm',
    tagline: 'Structured and supportive',
    description: 'Rock-solid support for those who need it.',
    illustration: 'wix:image://v1/firm-illustration.jpg',
    illustrationAlt: 'Firm comfort structured illustration',
    sortOrder: 3,
  },
];

const PRODUCT_COMFORT_MAPPINGS = [
  { _id: 'pc-1', productId: 'prod-futon-001', comfortLevelId: 'cl-plush', sortOrder: 1 },
  { _id: 'pc-2', productId: 'prod-futon-002', comfortLevelId: 'cl-firm', sortOrder: 2 },
];

// ── $w Mock Factory ────────────────────────────────────────────────

function make$w(elements = {}) {
  return function $w(selector) {
    if (!elements[selector]) {
      elements[selector] = {
        text: '', src: '', alt: '', html: '', value: '', options: [], data: null,
        _expanded: false, _collapsed: false, _handlers: {},
        expand() { this._expanded = true; this._collapsed = false; },
        collapse() { this._collapsed = true; this._expanded = false; },
        show() {}, hide() {},
        onChange(fn) { this._handlers.change = fn; },
        accessibility: {},
      };
    }
    return elements[selector];
  };
}

// ── Setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  __reset();
  __seed('ComfortLevels', COMFORT_LEVELS);
  __seed('ProductComfort', PRODUCT_COMFORT_MAPPINGS);
});

// ── COMFORT_ICONS ──────────────────────────────────────────────────

describe('COMFORT_ICONS', () => {
  it('has plush entry with icon and label', () => {
    expect(COMFORT_ICONS.plush).toBeDefined();
    expect(typeof COMFORT_ICONS.plush.icon).toBe('string');
    expect(COMFORT_ICONS.plush.icon.length).toBeGreaterThan(0);
    expect(typeof COMFORT_ICONS.plush.label).toBe('string');
    expect(COMFORT_ICONS.plush.label.length).toBeGreaterThan(0);
  });

  it('has medium entry with icon and label', () => {
    expect(COMFORT_ICONS.medium).toBeDefined();
    expect(typeof COMFORT_ICONS.medium.icon).toBe('string');
    expect(COMFORT_ICONS.medium.icon.length).toBeGreaterThan(0);
    expect(typeof COMFORT_ICONS.medium.label).toBe('string');
    expect(COMFORT_ICONS.medium.label.length).toBeGreaterThan(0);
  });

  it('has firm entry with icon and label', () => {
    expect(COMFORT_ICONS.firm).toBeDefined();
    expect(typeof COMFORT_ICONS.firm.icon).toBe('string');
    expect(COMFORT_ICONS.firm.icon.length).toBeGreaterThan(0);
    expect(typeof COMFORT_ICONS.firm.label).toBe('string');
    expect(COMFORT_ICONS.firm.label.length).toBeGreaterThan(0);
  });

  it('has exactly three comfort levels', () => {
    const keys = Object.keys(COMFORT_ICONS);
    expect(keys).toHaveLength(3);
    expect(keys).toContain('plush');
    expect(keys).toContain('medium');
    expect(keys).toContain('firm');
  });
});

// ── renderComfortCard ──────────────────────────────────────────────

describe('renderComfortCard', () => {
  it('sets comfort name text', () => {
    const $item = make$w();
    renderComfortCard($item, COMFORT_LEVELS[0]);
    expect($item('#comfortName').text).toBe('Plush');
  });

  it('sets comfort tagline text', () => {
    const $item = make$w();
    renderComfortCard($item, COMFORT_LEVELS[0]);
    expect($item('#comfortTagline').text).toBe('Sink in and unwind');
  });

  it('sets comfort description text', () => {
    const $item = make$w();
    renderComfortCard($item, COMFORT_LEVELS[0]);
    expect($item('#comfortDescription').text).toBe('Cloud-soft comfort that cradles you.');
  });

  it('sets illustration src and alt', () => {
    const $item = make$w();
    renderComfortCard($item, COMFORT_LEVELS[0]);
    expect($item('#comfortIllustration').src).toBe('wix:image://v1/plush-illustration.jpg');
    expect($item('#comfortIllustration').alt).toBe('Plush comfort cloud illustration');
  });

  it('provides default alt text when illustrationAlt is missing', () => {
    const $item = make$w();
    const comfort = {
      name: 'Plush',
      tagline: 'Sink in',
      description: 'Soft.',
      illustration: 'wix:image://v1/plush.jpg',
      // no illustrationAlt
    };
    renderComfortCard($item, comfort);
    expect($item('#comfortIllustration').alt).toBe('Plush comfort level illustration');
  });

  it('does nothing for null comfort', () => {
    const elements = {};
    const $item = make$w(elements);
    renderComfortCard($item, null);
    // No elements should have been created/accessed
    expect(Object.keys(elements)).toHaveLength(0);
  });

  it('does nothing for undefined comfort', () => {
    const elements = {};
    const $item = make$w(elements);
    renderComfortCard($item, undefined);
    expect(Object.keys(elements)).toHaveLength(0);
  });

  it('handles missing name field gracefully (null -> empty string)', () => {
    const $item = make$w();
    renderComfortCard($item, { name: null, tagline: 'T', description: 'D', illustration: null });
    expect($item('#comfortName').text).toBe('');
  });

  it('handles missing tagline field gracefully (undefined -> empty string)', () => {
    const $item = make$w();
    renderComfortCard($item, { name: 'N', description: 'D', illustration: null });
    expect($item('#comfortTagline').text).toBe('');
  });

  it('handles missing description field gracefully', () => {
    const $item = make$w();
    renderComfortCard($item, { name: 'N', tagline: 'T', illustration: null });
    expect($item('#comfortDescription').text).toBe('');
  });

  it('does not set illustration src when illustration is falsy', () => {
    const $item = make$w();
    renderComfortCard($item, { name: 'N', tagline: 'T', description: 'D', illustration: '' });
    // src should remain default empty string
    expect($item('#comfortIllustration').src).toBe('');
  });

  it('does not set illustration src when illustration is null', () => {
    const $item = make$w();
    renderComfortCard($item, { name: 'N', tagline: 'T', description: 'D', illustration: null });
    expect($item('#comfortIllustration').src).toBe('');
  });

  it('renders all three comfort levels correctly', () => {
    for (const level of COMFORT_LEVELS) {
      const $item = make$w();
      renderComfortCard($item, level);
      expect($item('#comfortName').text).toBe(level.name);
      expect($item('#comfortTagline').text).toBe(level.tagline);
      expect($item('#comfortDescription').text).toBe(level.description);
      expect($item('#comfortIllustration').src).toBe(level.illustration);
    }
  });
});

// ── renderComfortCard — SVG fallback ─────────────────────────────

describe('renderComfortCard — SVG fallback', () => {
  it('sets SVG html when illustration missing and slug is valid', () => {
    const $item = make$w();
    const comfort = { name: 'Plush', tagline: 'Soft', description: 'Cloud-soft.', slug: 'plush', illustration: null };
    renderComfortCard($item, comfort);
    expect($item('#comfortIllustrationSvg').html).toBe(getComfortSvg('plush'));
  });

  it('prefers CMS illustration over SVG', () => {
    const $item = make$w();
    const comfort = {
      name: 'Plush', tagline: 'Soft', description: 'Cloud-soft.',
      slug: 'plush', illustration: 'wix:image://v1/plush.jpg',
    };
    renderComfortCard($item, comfort);
    expect($item('#comfortIllustration').src).toBe('wix:image://v1/plush.jpg');
    expect($item('#comfortIllustrationSvg').html).toBeFalsy();
  });

  it('handles unknown slug gracefully', () => {
    const $item = make$w();
    const comfort = { name: 'Custom', tagline: 'T', description: 'D', slug: 'custom', illustration: null };
    renderComfortCard($item, comfort);
    expect($item('#comfortIllustrationSvg').html).toBeFalsy();
  });

  it('handles missing #comfortIllustrationSvg element gracefully', () => {
    const elements = {};
    const $item = function (selector) {
      if (selector === '#comfortIllustrationSvg') throw new Error('Element not found');
      if (!elements[selector]) {
        elements[selector] = {
          text: '', src: '', alt: '', html: '', value: '', options: [], data: null,
          _expanded: false, _collapsed: false, _handlers: {},
          expand() { this._expanded = true; this._collapsed = false; },
          collapse() { this._collapsed = true; this._expanded = false; },
          show() {}, hide() {},
          onChange(fn) { this._handlers.change = fn; },
          accessibility: {},
        };
      }
      return elements[selector];
    };
    const comfort = { name: 'Plush', tagline: 'Soft', description: 'D', slug: 'plush', illustration: null };
    expect(() => renderComfortCard($item, comfort)).not.toThrow();
  });

  it('sets SVG for all three comfort levels', () => {
    for (const slug of ['plush', 'medium', 'firm']) {
      const $item = make$w();
      const comfort = { name: slug, tagline: 'T', description: 'D', slug, illustration: null };
      renderComfortCard($item, comfort);
      expect($item('#comfortIllustrationSvg').html).toBe(getComfortSvg(slug));
    }
  });
});

// ── initComfortCards ───────────────────────────────────────────────

describe('initComfortCards', () => {
  it('expands section for product with comfort mapping', async () => {
    const $w = make$w();
    const state = { product: { _id: 'prod-futon-001' } };
    await initComfortCards($w, state);
    expect($w('#comfortSection')._expanded).toBe(true);
    expect($w('#comfortSection')._collapsed).toBe(false);
  });

  it('renders comfort data for product with mapping', async () => {
    const $w = make$w();
    const state = { product: { _id: 'prod-futon-001' } };
    await initComfortCards($w, state);
    // prod-futon-001 maps to cl-plush
    expect($w('#comfortName').text).toBe('Plush');
    expect($w('#comfortTagline').text).toBe('Sink in and unwind');
    expect($w('#comfortDescription').text).toBe('Cloud-soft comfort that cradles you.');
  });

  it('collapses section for product with no comfort mapping', async () => {
    const $w = make$w();
    const state = { product: { _id: 'prod-no-mapping' } };
    await initComfortCards($w, state);
    expect($w('#comfortSection')._collapsed).toBe(true);
    expect($w('#comfortSection')._expanded).toBe(false);
  });

  it('collapses section for null product', async () => {
    const $w = make$w();
    const state = { product: null };
    await initComfortCards($w, state);
    expect($w('#comfortSection')._collapsed).toBe(true);
  });

  it('collapses section for null state', async () => {
    const $w = make$w();
    await initComfortCards($w, null);
    expect($w('#comfortSection')._collapsed).toBe(true);
  });

  it('collapses section for undefined state', async () => {
    const $w = make$w();
    await initComfortCards($w, undefined);
    expect($w('#comfortSection')._collapsed).toBe(true);
  });

  it('collapses section for state with no product property', async () => {
    const $w = make$w();
    await initComfortCards($w, {});
    expect($w('#comfortSection')._collapsed).toBe(true);
  });

  it('handles second comfort level mapping (firm)', async () => {
    const $w = make$w();
    const state = { product: { _id: 'prod-futon-002' } };
    await initComfortCards($w, state);
    // prod-futon-002 maps to cl-firm
    expect($w('#comfortName').text).toBe('Firm');
    expect($w('#comfortSection')._expanded).toBe(true);
  });

  it('does not throw when section elements are missing', async () => {
    // The function wraps everything in try/catch
    const $w = make$w();
    const state = { product: { _id: 'prod-futon-001' } };
    await expect(initComfortCards($w, state)).resolves.not.toThrow();
  });
});

// ── initComfortFilter ──────────────────────────────────────────────

describe('initComfortFilter', () => {
  it('populates dropdown with All + 3 comfort levels', async () => {
    const $w = make$w();
    await initComfortFilter($w);
    const options = $w('#comfortFilter').options;
    expect(options).toHaveLength(4); // All + Plush + Medium + Firm
    expect(options[0].label).toBe('All Comfort Levels');
    expect(options[0].value).toBe('');
  });

  it('includes all three comfort levels in sorted order', async () => {
    const $w = make$w();
    await initComfortFilter($w);
    const options = $w('#comfortFilter').options;
    // Sorted by sortOrder: Plush(1), Medium(2), Firm(3)
    expect(options[1].label).toBe('Plush');
    expect(options[1].value).toBe('plush');
    expect(options[2].label).toBe('Medium');
    expect(options[2].value).toBe('medium');
    expect(options[3].label).toBe('Firm');
    expect(options[3].value).toBe('firm');
  });

  it('sets default value to empty string (All)', async () => {
    const $w = make$w();
    await initComfortFilter($w);
    expect($w('#comfortFilter').value).toBe('');
  });

  it('registers an onChange handler', async () => {
    const $w = make$w();
    await initComfortFilter($w);
    expect($w('#comfortFilter')._handlers.change).toBeDefined();
    expect(typeof $w('#comfortFilter')._handlers.change).toBe('function');
  });

  it('onChange handler populates comfortFilterResults for specific slug', async () => {
    const $w = make$w();
    await initComfortFilter($w);
    const filter = $w('#comfortFilter');

    // Simulate selecting "plush"
    filter.value = 'plush';
    await filter._handlers.change();

    // Should populate with product IDs that have plush comfort
    const results = $w('#comfortFilterResults').data;
    expect(Array.isArray(results)).toBe(true);
    expect(results).toContain('prod-futon-001');
  });

  it('onChange handler returns early for empty slug (All selected)', async () => {
    const $w = make$w();
    await initComfortFilter($w);
    const filter = $w('#comfortFilter');

    // Simulate selecting "All" (empty value)
    filter.value = '';
    await filter._handlers.change();

    // comfortFilterResults should NOT be set (stays null from make$w default)
    expect($w('#comfortFilterResults').data).toBeNull();
  });

  it('handles empty ComfortLevels collection gracefully', async () => {
    __seed('ComfortLevels', []);
    const $w = make$w();
    await initComfortFilter($w);
    const options = $w('#comfortFilter').options;
    expect(options).toHaveLength(1); // Only "All Comfort Levels"
    expect(options[0].label).toBe('All Comfort Levels');
  });
});
