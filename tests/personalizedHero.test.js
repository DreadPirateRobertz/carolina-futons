/**
 * Tests for PersonalizedHero.js — Member-personalized homepage hero
 * CF-tj6f
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('backend/futonSommelier.web', () => ({
  getSommelierResults: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('public/productCache', () => ({
  getRecentlyViewed: vi.fn(() => []),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

import {
  getPersonalizedHero,
  applyPersonalizedHero,
  CATEGORY_HERO_CONFIG,
} from '../src/public/PersonalizedHero.js';

import { currentMember } from 'wix-members-frontend';
import { getSommelierResults } from 'backend/futonSommelier.web';
import { getRecentlyViewed } from 'public/productCache';

function createMockElement() {
  return {
    text: '',
    label: '',
    src: '',
    onClick: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.getMember.mockResolvedValue(null);
  getSommelierResults.mockResolvedValue({ success: false });
  getRecentlyViewed.mockReturnValue([]);
});

// ── getPersonalizedHero ─────────────────────────────────────────────

describe('getPersonalizedHero', () => {
  it('returns null for anonymous visitors', async () => {
    currentMember.getMember.mockResolvedValue(null);
    const result = await getPersonalizedHero();
    expect(result).toBeNull();
  });

  it('returns sommelier-based hero when quiz data exists', async () => {
    currentMember.getMember.mockResolvedValue({ _id: 'mem-1' });
    getSommelierResults.mockResolvedValue({
      success: true,
      result: { topCategory: 'murphy-cabinet-beds' },
    });

    const result = await getPersonalizedHero();
    expect(result).not.toBeNull();
    expect(result.source).toBe('sommelier');
    expect(result.headline).toContain('Murphy');
    expect(result.ctaPath).toBe('/murphy-cabinet-beds');
  });

  it('falls back to browse history when no sommelier data', async () => {
    currentMember.getMember.mockResolvedValue({ _id: 'mem-1' });
    getSommelierResults.mockResolvedValue({ success: true, result: null });
    getRecentlyViewed.mockReturnValue([
      { collections: ['futon-frames'] },
      { collections: ['futon-frames'] },
      { collections: ['mattresses'] },
    ]);

    const result = await getPersonalizedHero();
    expect(result).not.toBeNull();
    expect(result.source).toBe('browse-history');
    expect(result.ctaPath).toBe('/futon-frames'); // highest count
  });

  it('returns null when logged in but no data sources have results', async () => {
    currentMember.getMember.mockResolvedValue({ _id: 'mem-1' });
    getSommelierResults.mockResolvedValue({ success: true, result: null });
    getRecentlyViewed.mockReturnValue([]);

    const result = await getPersonalizedHero();
    expect(result).toBeNull();
  });

  it('ignores browse history categories not in config', async () => {
    currentMember.getMember.mockResolvedValue({ _id: 'mem-1' });
    getSommelierResults.mockResolvedValue({ success: true, result: null });
    getRecentlyViewed.mockReturnValue([
      { collections: ['gift-cards'] },
      { collections: ['random-category'] },
    ]);

    const result = await getPersonalizedHero();
    expect(result).toBeNull();
  });

  it('handles sommelier API failure gracefully', async () => {
    currentMember.getMember.mockResolvedValue({ _id: 'mem-1' });
    getSommelierResults.mockRejectedValue(new Error('API down'));
    getRecentlyViewed.mockReturnValue([
      { collections: ['platform-beds'] },
    ]);

    const result = await getPersonalizedHero();
    expect(result.source).toBe('browse-history');
    expect(result.ctaPath).toBe('/platform-beds');
  });
});

// ── applyPersonalizedHero ───────────────────────────────────────────

describe('applyPersonalizedHero', () => {
  it('sets hero title, subtitle, and CTA from config', () => {
    const elements = {};
    const $w = (id) => {
      if (!elements[id]) elements[id] = createMockElement();
      return elements[id];
    };

    const config = CATEGORY_HERO_CONFIG['futon-frames'];
    applyPersonalizedHero($w, { ...config, source: 'sommelier' });

    expect(elements['#heroTitle'].text).toBe(config.headline);
    expect(elements['#heroSubtitle'].text).toBe(config.subtitle);
    expect(elements['#heroCTA'].label).toBe(config.cta);
    expect(elements['#heroCTA'].onClick).toHaveBeenCalled();
  });

  it('swaps hero image when getHeroImage is provided', () => {
    const elements = {};
    const $w = (id) => {
      if (!elements[id]) elements[id] = createMockElement();
      return elements[id];
    };

    const config = CATEGORY_HERO_CONFIG['mattresses'];
    const getHeroImage = vi.fn(() => 'https://cdn.example.com/mattress-hero.jpg');

    applyPersonalizedHero($w, { ...config, source: 'sommelier' }, getHeroImage);

    expect(getHeroImage).toHaveBeenCalledWith('mattresses');
    expect(elements['#heroBg'].src).toBe('https://cdn.example.com/mattress-hero.jpg');
  });

  it('does nothing when heroConfig is null', () => {
    const $w = vi.fn();
    applyPersonalizedHero($w, null);
    expect($w).not.toHaveBeenCalled();
  });
});

// ── CATEGORY_HERO_CONFIG ────────────────────────────────────────────

describe('CATEGORY_HERO_CONFIG', () => {
  it('has config for all main categories', () => {
    const expectedCategories = [
      'futon-frames', 'murphy-cabinet-beds', 'platform-beds',
      'mattresses', 'casegoods-accessories', 'wall-huggers',
    ];
    for (const cat of expectedCategories) {
      expect(CATEGORY_HERO_CONFIG[cat]).toBeDefined();
      expect(CATEGORY_HERO_CONFIG[cat].headline).toBeTruthy();
      expect(CATEGORY_HERO_CONFIG[cat].cta).toBeTruthy();
      expect(CATEGORY_HERO_CONFIG[cat].ctaPath).toMatch(/^\//);
    }
  });
});
