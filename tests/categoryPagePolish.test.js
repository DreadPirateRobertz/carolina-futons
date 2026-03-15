/**
 * Tests for public/CategoryPagePolish.js
 * Covers: hero styling, filter panel, quick view modal, empty state,
 * swatch dots, recently viewed, sort dropdown, and token application.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock designTokens ───────────────────────────────────────────────

vi.mock('public/designTokens.js', () => ({
  colors: {
    espresso: '#3E2723',
    espressoDark: '#2C1A15',
    sandBase: '#F5F0EB',
    sandDark: '#D4C4B0',
    sandLight: '#FAF7F2',
    offWhite: '#FEFCF9',
    mountainBlue: '#5B8FA8',
    mountainBlueLight: '#D6E8F0',
    sunsetCoral: '#E07A5F',
  },
  shadows: {
    card: '0 2px 8px rgba(0,0,0,0.08)',
    modal: '0 8px 32px rgba(0,0,0,0.2)',
  },
  transitions: {
    fast: '150ms ease',
    medium: '300ms ease',
  },
  spacing: {
    lg: '24px',
  },
  borderRadius: {
    button: '8px',
    lg: '16px',
    pill: 24,
  },
}));

import {
  styleHeroSection,
  styleHeroText,
  styleSortDropdown,
  styleFilterPanel,
  styleFilterChip,
  styleClearFiltersButton,
  styleQuickViewModal,
  styleEmptyState,
  styleResultCount,
  styleSwatchDot,
  styleRecentlyViewed,
  applyCategoryPageTokens,
} from 'public/CategoryPagePolish.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    style: {
      backgroundColor: '',
      backgroundImage: '',
      color: '',
      borderColor: '',
      borderWidth: '',
      borderRadius: '',
      boxShadow: '',
      display: '',
      flexWrap: '',
      gap: '',
      overflowX: '',
      transition: '',
    },
    show: vi.fn(),
    hide: vi.fn(),
    ...overrides,
  };
}

function createMock$w(elements = {}) {
  return (selector) => {
    if (elements[selector]) return elements[selector];
    return createMockElement();
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('CategoryPagePolish — styleHeroSection', () => {
  it('applies gradient to hero section', () => {
    const hero = createMockElement();
    const $w = createMock$w({ '#categoryHeroSection': hero });
    const gradient = 'linear-gradient(135deg, #F5F0EB 0%, #D4C4B0 100%)';

    styleHeroSection($w, gradient);

    expect(hero.style.backgroundColor).toBe('');
    expect(hero.style.backgroundImage).toBe(gradient);
  });

  it('falls back to solid color when gradient throws', () => {
    const hero = createMockElement();
    Object.defineProperty(hero.style, 'backgroundImage', {
      set() { throw new Error('unsupported'); },
      get() { return ''; },
    });
    const $w = createMock$w({ '#categoryHeroSection': hero });
    const gradient = 'linear-gradient(135deg, #F5F0EB 0%, #D4C4B0 100%)';

    styleHeroSection($w, gradient);

    expect(hero.style.backgroundColor).toBe('#F5F0EB');
  });

  it('uses sandBase when gradient has no extractable hex', () => {
    const hero = createMockElement();
    Object.defineProperty(hero.style, 'backgroundImage', {
      set() { throw new Error('unsupported'); },
      get() { return ''; },
    });
    const $w = createMock$w({ '#categoryHeroSection': hero });

    styleHeroSection($w, 'invalid-gradient');

    expect(hero.style.backgroundColor).toBe('#F5F0EB');
  });

  it('handles null $w element gracefully', () => {
    const $w = () => null;
    expect(() => styleHeroSection($w, 'gradient')).not.toThrow();
  });
});

describe('CategoryPagePolish — styleHeroText', () => {
  it('applies espresso colors to title and subtitle', () => {
    const title = createMockElement();
    const subtitle = createMockElement();
    const $w = createMock$w({
      '#categoryHeroTitle': title,
      '#categoryHeroSubtitle': subtitle,
    });

    styleHeroText($w);

    expect(title.style.color).toBe('#3E2723');
    expect(subtitle.style.color).toBe('#2C1A15');
  });
});

describe('CategoryPagePolish — styleSortDropdown', () => {
  it('applies mountain blue border and button radius', () => {
    const dropdown = createMockElement();
    const $w = createMock$w({ '#sortDropdown': dropdown });

    styleSortDropdown($w);

    expect(dropdown.style.borderColor).toBe('#5B8FA8');
    expect(dropdown.style.borderRadius).toBe('8px');
  });

  it('handles missing dropdown gracefully', () => {
    const $w = () => null;
    expect(() => styleSortDropdown($w)).not.toThrow();
  });
});

describe('CategoryPagePolish — styleFilterPanel', () => {
  it('applies offWhite background and card shadow', () => {
    const panel = createMockElement();
    const $w = createMock$w({ '#filterPanel': panel });

    styleFilterPanel($w);

    expect(panel.style.backgroundColor).toBe('#FEFCF9');
    expect(panel.style.boxShadow).toBe('0 2px 8px rgba(0,0,0,0.08)');
  });

  it('styles filter section headers with espresso', () => {
    const header = createMockElement();
    const $w = createMock$w({ '#filterCategoryLabel': header });

    styleFilterPanel($w);

    expect(header.style.color).toBe('#3E2723');
  });
});

describe('CategoryPagePolish — styleFilterChip', () => {
  it('applies mountainBlueLight background and pill radius', () => {
    const chip = createMockElement();

    styleFilterChip(chip);

    expect(chip.style.backgroundColor).toBe('#D6E8F0');
    expect(chip.style.color).toBe('#3E2723');
    expect(chip.style.transition).toBe('150ms ease');
  });

  it('handles null element', () => {
    expect(() => styleFilterChip(null)).not.toThrow();
  });
});

describe('CategoryPagePolish — styleClearFiltersButton', () => {
  it('applies coral color and border', () => {
    const btn = createMockElement();

    styleClearFiltersButton(btn);

    expect(btn.style.color).toBe('#E07A5F');
    expect(btn.style.borderColor).toBe('#E07A5F');
    expect(btn.style.borderRadius).toBe('8px');
  });

  it('handles null element', () => {
    expect(() => styleClearFiltersButton(null)).not.toThrow();
  });
});

describe('CategoryPagePolish — styleQuickViewModal', () => {
  it('applies modal shadow and border radius', () => {
    const modal = createMockElement();
    const $w = createMock$w({ '#quickViewModal': modal });

    styleQuickViewModal($w);

    expect(modal.style.boxShadow).toBe('0 8px 32px rgba(0,0,0,0.2)');
    expect(modal.style.borderRadius).toBe('16px');
    expect(modal.style.backgroundColor).toBe('#FEFCF9');
  });

  it('styles the add-to-cart button with coral', () => {
    const btn = createMockElement();
    const $w = createMock$w({ '#qvAddToCart': btn });

    styleQuickViewModal($w);

    expect(btn.style.backgroundColor).toBe('#E07A5F');
    expect(btn.style.color).toBe('#3E2723');
  });

  it('styles the price text with espresso', () => {
    const price = createMockElement();
    const $w = createMock$w({ '#qvPrice': price });

    styleQuickViewModal($w);

    expect(price.style.color).toBe('#3E2723');
  });
});

describe('CategoryPagePolish — styleEmptyState', () => {
  it('applies espresso colors to empty state text', () => {
    const title = createMockElement();
    const message = createMockElement();
    const $w = createMock$w({
      '#emptyStateTitle': title,
      '#emptyStateMessage': message,
    });

    styleEmptyState($w);

    expect(title.style.color).toBe('#3E2723');
    expect(message.style.color).toBe('#2C1A15');
  });

  it('applies espresso colors to no-matches text', () => {
    const title = createMockElement();
    const message = createMockElement();
    const $w = createMock$w({
      '#noMatchesTitle': title,
      '#noMatchesMessage': message,
    });

    styleEmptyState($w);

    expect(title.style.color).toBe('#3E2723');
    expect(message.style.color).toBe('#2C1A15');
  });
});

describe('CategoryPagePolish — styleResultCount', () => {
  it('applies espressoDark to result count elements', () => {
    const count = createMockElement();
    const filterCount = createMockElement();
    const $w = createMock$w({
      '#resultCount': count,
      '#filterResultCount': filterCount,
    });

    styleResultCount($w);

    expect(count.style.color).toBe('#2C1A15');
    expect(filterCount.style.color).toBe('#2C1A15');
  });
});

describe('CategoryPagePolish — styleSwatchDot', () => {
  it('applies color and circular styling', () => {
    const dot = createMockElement();

    styleSwatchDot(dot, '#FF5733');

    expect(dot.style.backgroundColor).toBe('#FF5733');
    expect(dot.style.borderRadius).toBe('50%');
    expect(dot.style.borderColor).toBe('#D4C4B0');
    expect(dot.style.borderWidth).toBe('1px');
  });

  it('handles null dot', () => {
    expect(() => styleSwatchDot(null, '#FF5733')).not.toThrow();
  });
});

describe('CategoryPagePolish — styleRecentlyViewed', () => {
  it('styles the title with espresso', () => {
    const title = createMockElement();
    const $w = createMock$w({ '#recentlyViewedTitle': title });

    styleRecentlyViewed($w);

    expect(title.style.color).toBe('#3E2723');
  });

  it('sets horizontal scroll layout on repeater', () => {
    const repeater = createMockElement();
    const $w = createMock$w({ '#recentlyViewedRepeater': repeater });

    styleRecentlyViewed($w);

    expect(repeater.style.display).toBe('flex');
    expect(repeater.style.flexWrap).toBe('nowrap');
    expect(repeater.style.gap).toBe('24px');
    expect(repeater.style.overflowX).toBe('auto');
  });
});

describe('CategoryPagePolish — applyCategoryPageTokens', () => {
  it('calls all sub-style functions without error', () => {
    const elements = {};
    const $w = createMock$w(elements);

    expect(() => applyCategoryPageTokens($w)).not.toThrow();
  });

  it('applies styles to hero title when element exists', () => {
    const title = createMockElement();
    const $w = createMock$w({ '#categoryHeroTitle': title });

    applyCategoryPageTokens($w);

    expect(title.style.color).toBe('#3E2723');
  });

  it('applies styles to sort dropdown when element exists', () => {
    const dropdown = createMockElement();
    const $w = createMock$w({ '#sortDropdown': dropdown });

    applyCategoryPageTokens($w);

    expect(dropdown.style.borderColor).toBe('#5B8FA8');
  });

  it('applies styles to quick view modal when element exists', () => {
    const modal = createMockElement();
    const $w = createMock$w({ '#quickViewModal': modal });

    applyCategoryPageTokens($w);

    expect(modal.style.boxShadow).toBe('0 8px 32px rgba(0,0,0,0.2)');
  });
});
