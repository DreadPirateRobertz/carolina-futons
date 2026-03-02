import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/comfortService.web', () => ({
  getComfortLevels: vi.fn().mockResolvedValue([
    {
      slug: 'plush', name: 'Plush', tagline: 'Sink in and let go',
      description: 'Like being hugged by a cloud.',
      illustration: 'wix:image://plush.svg',
      illustrationAlt: 'Figure sinking into cushion',
    },
    {
      slug: 'medium', name: 'Medium', tagline: 'The best of both worlds',
      description: 'Supportive enough for all-day sitting.',
      illustration: 'wix:image://medium.svg',
      illustrationAlt: 'Figure in balanced position',
    },
    {
      slug: 'firm', name: 'Firm', tagline: 'Sit tall, feel strong',
      description: 'Solid support that keeps posture happy.',
      illustration: 'wix:image://firm.svg',
      illustrationAlt: 'Figure sitting upright',
    },
  ]),
  getProductComfort: vi.fn().mockResolvedValue({
    slug: 'medium', name: 'Medium', tagline: 'The best of both worlds',
    description: 'Supportive enough for all-day sitting.',
    illustration: 'wix:image://medium.svg',
    illustrationAlt: 'Figure in balanced position',
  }),
  getComfortProducts: vi.fn().mockResolvedValue(['prod-1', 'prod-2', 'prod-3']),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    mountainBlue: '#5B8FA8', sandBase: '#E8D5B7', sandDark: '#D4BC96',
    espresso: '#3A2518', sunsetCoral: '#E8845C', white: '#FFFFFF',
    sandLight: '#F2E8D5', mountainBlueLight: '#A8CCD8',
    espressoLight: '#5C4033', sunsetCoralLight: '#F2A882',
    offWhite: '#FAF7F2', skyGradientTop: '#B8D4E3', skyGradientBottom: '#F0C87A',
    mountainBlueDark: '#3D6B80',
  },
  spacing: { sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  borderRadius: { card: '12px', md: '8px' },
  shadows: { card: '0 2px 8px rgba(0,0,0,0.1)' },
}));

import {
  initComfortCards,
  initComfortFilter,
  renderComfortCard,
  COMFORT_ICONS,
} from '../src/public/ComfortStoryCards.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', html: '', label: '',
    style: { color: '', backgroundColor: '', borderColor: '', borderWidth: '', display: '' },
    options: [], data: [], items: [],
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onInput: vi.fn(),
    focus: vi.fn(),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

// ── Comfort Story Cards Rendering ───────────────────────────────────

describe('ComfortStoryCards — renderComfortCard', () => {
  it('renders a comfort card with name and tagline', () => {
    const $item = create$w();
    const comfort = {
      slug: 'plush', name: 'Plush', tagline: 'Sink in and let go',
      description: 'Like being hugged by a cloud.',
      illustration: 'wix:image://plush.svg',
      illustrationAlt: 'Figure sinking into cushion',
    };
    renderComfortCard($item, comfort);
    expect($item('#comfortName').text).toBe('Plush');
    expect($item('#comfortTagline').text).toBe('Sink in and let go');
  });

  it('renders description text', () => {
    const $item = create$w();
    const comfort = {
      slug: 'firm', name: 'Firm', tagline: 'Sit tall',
      description: 'Solid support.',
      illustration: 'wix:image://firm.svg',
      illustrationAlt: 'Upright figure',
    };
    renderComfortCard($item, comfort);
    expect($item('#comfortDescription').text).toBe('Solid support.');
  });

  it('sets SVG illustration from comfortIllustrations module', () => {
    const $item = create$w();
    const comfort = {
      slug: 'medium', name: 'Medium', tagline: 'Best of both',
      description: 'Balanced.',
      illustration: 'wix:image://medium.svg',
      illustrationAlt: 'Balanced figure',
    };
    renderComfortCard($item, comfort);
    // SVG illustrations take priority over CMS illustration URLs
    expect($item('#comfortIllustration').src).toMatch(/^data:image\/svg\+xml,/);
    expect($item('#comfortIllustration').alt).toBeTruthy();
  });

  it('handles missing illustration gracefully', () => {
    const $item = create$w();
    const comfort = {
      slug: 'firm', name: 'Firm', tagline: 'Strong',
      description: 'Support.', illustration: '', illustrationAlt: '',
    };
    // Should not throw
    expect(() => renderComfortCard($item, comfort)).not.toThrow();
  });

  it('handles null comfort data gracefully', () => {
    const $item = create$w();
    expect(() => renderComfortCard($item, null)).not.toThrow();
  });

  it('falls back to emoji for unknown comfort slug', () => {
    const $item = create$w();
    const comfort = {
      slug: 'ultra-plush', name: 'Ultra Plush', tagline: 'Extreme softness',
      description: 'The softest.', illustration: '', illustrationAlt: '',
    };
    // Should not throw — no SVG and no CMS illustration, unknown slug emoji
    expect(() => renderComfortCard($item, comfort)).not.toThrow();
  });

  it('uses SVG data URI for all known comfort levels', () => {
    for (const slug of ['plush', 'medium', 'firm']) {
      const $item = create$w();
      const comfort = {
        slug, name: slug, tagline: 'Test', description: 'Test.',
        illustration: `wix:image://${slug}.svg`, illustrationAlt: 'Test alt',
      };
      renderComfortCard($item, comfort);
      expect($item('#comfortIllustration').src).toMatch(/^data:image\/svg\+xml,/);
    }
  });
});

// ── COMFORT_ICONS ───────────────────────────────────────────────────

describe('ComfortStoryCards — COMFORT_ICONS', () => {
  it('exports icon/emoji map for plush, medium, firm', () => {
    expect(COMFORT_ICONS).toBeDefined();
    expect(COMFORT_ICONS.plush).toBeTruthy();
    expect(COMFORT_ICONS.medium).toBeTruthy();
    expect(COMFORT_ICONS.firm).toBeTruthy();
  });
});

// ── initComfortCards (Product Page) ─────────────────────────────────

describe('ComfortStoryCards — initComfortCards', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = { product: { _id: 'prod-1', name: 'Eureka Frame' } };
  });

  it('initializes comfort section on product page', async () => {
    await initComfortCards($w, state);
    expect($w('#comfortSection').expand).toHaveBeenCalled();
  });

  it('renders the product comfort card', async () => {
    await initComfortCards($w, state);
    expect($w('#comfortName').text).toBe('Medium');
    expect($w('#comfortTagline').text).toBe('The best of both worlds');
  });

  it('sets SVG illustration on product comfort card', async () => {
    await initComfortCards($w, state);
    // SVG illustrations from comfortIllustrations take priority
    expect($w('#comfortIllustration').src).toMatch(/^data:image\/svg\+xml,/);
    expect($w('#comfortIllustration').alt).toBeTruthy();
  });

  it('collapses section when product has no comfort data', async () => {
    const { getProductComfort } = await import('backend/comfortService.web');
    getProductComfort.mockResolvedValueOnce(null);
    await initComfortCards($w, state);
    expect($w('#comfortSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when no product in state', async () => {
    state.product = null;
    await initComfortCards($w, state);
    expect($w('#comfortSection').collapse).toHaveBeenCalled();
  });

  it('handles backend error gracefully', async () => {
    const { getProductComfort } = await import('backend/comfortService.web');
    getProductComfort.mockRejectedValueOnce(new Error('DB error'));
    await initComfortCards($w, state);
    expect($w('#comfortSection').collapse).toHaveBeenCalled();
  });
});

// ── initComfortFilter (Category Page) ───────────────────────────────

describe('ComfortStoryCards — initComfortFilter', () => {
  let $w;

  beforeEach(() => {
    $w = create$w();
  });

  it('populates comfort filter dropdown with options', async () => {
    await initComfortFilter($w);
    const opts = $w('#comfortFilter').options;
    expect(opts[0]).toEqual({ label: 'All Comfort Levels', value: '' });
    expect(opts.length).toBe(4); // All + plush + medium + firm
  });

  it('includes comfort level names in filter options', async () => {
    await initComfortFilter($w);
    const opts = $w('#comfortFilter').options;
    const labels = opts.map(o => o.label);
    expect(labels).toContain('Plush');
    expect(labels).toContain('Medium');
    expect(labels).toContain('Firm');
  });

  it('registers onChange handler on filter', async () => {
    await initComfortFilter($w);
    expect($w('#comfortFilter').onChange).toHaveBeenCalled();
  });

  it('handles empty comfort levels gracefully', async () => {
    const { getComfortLevels } = await import('backend/comfortService.web');
    getComfortLevels.mockResolvedValueOnce([]);
    await initComfortFilter($w);
    const opts = $w('#comfortFilter').options;
    expect(opts).toHaveLength(1); // Just "All"
  });

  it('handles backend error gracefully', async () => {
    const { getComfortLevels } = await import('backend/comfortService.web');
    getComfortLevels.mockRejectedValueOnce(new Error('DB error'));
    // Should not throw
    await expect(initComfortFilter($w)).resolves.not.toThrow();
  });
});
