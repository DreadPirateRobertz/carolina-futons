/**
 * PersonalizedHero.js — Member-personalized homepage hero section.
 *
 * Swaps the default hero (image, headline, CTA) based on:
 * 1. Futon Sommelier quiz result → top recommended category
 * 2. Last-browsed category (highest view count) → from browse history
 * 3. Last purchase category → cross-sell complementary
 * 4. No data → returns null (caller uses default hero)
 *
 * CF-tj6f: Member-personalized homepage hero
 *
 * No flicker: runs in $w.onReady before hero elements are shown.
 * Anonymous visitors get null (default hero always).
 */

const CATEGORY_HERO_CONFIG = {
  'futon-frames': {
    headline: 'Futons Built for Your Life',
    subtitle: 'Your top match — handcrafted hardwood frames for every room.',
    cta: 'Shop Futon Frames',
    ctaPath: '/futon-frames',
    imageKey: 'futon-frames',
  },
  'murphy-cabinet-beds': {
    headline: 'Murphy Beds — Space Reimagined',
    subtitle: 'Your personal pick — beautiful cabinet beds, no wall mount needed.',
    cta: 'Shop Murphy Beds',
    ctaPath: '/murphy-cabinet-beds',
    imageKey: 'murphy-cabinet-beds',
  },
  'platform-beds': {
    headline: 'Platform Beds for Modern Living',
    subtitle: 'Your style match — clean lines, solid wood.',
    cta: 'Shop Platform Beds',
    ctaPath: '/platform-beds',
    imageKey: 'platform-beds',
  },
  'mattresses': {
    headline: 'Rest Better Tonight',
    subtitle: 'Picked for you — CertiPUR-US certified comfort.',
    cta: 'Shop Mattresses',
    ctaPath: '/mattresses',
    imageKey: 'mattresses',
  },
  'casegoods-accessories': {
    headline: 'Complete Your Space',
    subtitle: 'Curated for you — nightstands, dressers & storage.',
    cta: 'Shop Casegoods',
    ctaPath: '/casegoods-accessories',
    imageKey: 'casegoods-accessories',
  },
  'wall-huggers': {
    headline: 'Wall Hugger Frames — Space Smart',
    subtitle: 'Your perfect fit — patented space-saving design.',
    cta: 'Shop Wall Huggers',
    ctaPath: '/wall-huggers',
    imageKey: 'wall-huggers',
  },
};

// Cross-sell map: if they bought X, show Y
const CROSS_SELL_MAP = {
  'futon-frames': 'mattresses',
  'mattresses': 'futon-frames',
  'murphy-cabinet-beds': 'casegoods-accessories',
  'platform-beds': 'mattresses',
  'casegoods-accessories': 'futon-frames',
  'wall-huggers': 'mattresses',
};

/**
 * Get personalized hero config for the current member.
 * Returns null for anonymous visitors or members with no data.
 *
 * @returns {Promise<{headline: string, subtitle: string, cta: string, ctaPath: string, imageKey: string, source: string}|null>}
 */
export async function getPersonalizedHero() {
  try {
    // Check if user is logged in
    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();
    if (!member?._id) return null;

    const memberId = member._id;

    // Priority 1: Sommelier quiz result
    try {
      const { getSommelierResults } = await import('backend/futonSommelier.web');
      const sommelier = await getSommelierResults(memberId);
      if (sommelier.success && sommelier.result?.topCategory) {
        const config = CATEGORY_HERO_CONFIG[sommelier.result.topCategory];
        if (config) {
          return { ...config, source: 'sommelier' };
        }
      }
    } catch { /* sommelier unavailable */ }

    // Priority 2: Browse history — most-viewed category
    try {
      const { getRecentlyViewed } = await import('public/productCache');
      const recent = getRecentlyViewed(20);
      if (recent && recent.length > 0) {
        const categoryCounts = {};
        for (const product of recent) {
          const collections = product.collections || [];
          for (const col of (Array.isArray(collections) ? collections : [collections])) {
            if (col && CATEGORY_HERO_CONFIG[col]) {
              categoryCounts[col] = (categoryCounts[col] || 0) + 1;
            }
          }
        }
        const topCategory = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])[0];

        if (topCategory) {
          const config = CATEGORY_HERO_CONFIG[topCategory[0]];
          if (config) {
            return { ...config, source: 'browse-history' };
          }
        }
      }
    } catch { /* browse history unavailable */ }

    // Priority 3: Last purchase → cross-sell
    // (Would need order history API — deferred to future iteration)

    return null;
  } catch {
    return null;
  }
}

/**
 * Apply personalized hero to the homepage elements.
 *
 * @param {Function} $w - Wix selector
 * @param {Object} heroConfig - From getPersonalizedHero()
 * @param {Function} [getHeroImage] - Optional image lookup function
 */
export function applyPersonalizedHero($w, heroConfig, getHeroImage) {
  if (!heroConfig) return;

  try {
    const heroTitle = $w('#heroTitle');
    if (heroTitle) heroTitle.text = heroConfig.headline;
  } catch (e) {}

  try {
    const heroSubtitle = $w('#heroSubtitle');
    if (heroSubtitle) heroSubtitle.text = heroConfig.subtitle;
  } catch (e) {}

  try {
    const heroCta = $w('#heroCTA');
    if (heroCta) {
      heroCta.label = heroConfig.cta;
      // Re-wire click to personalized category
      heroCta.onClick(() => {
        import('wix-location-frontend').then(({ to }) => to(heroConfig.ctaPath));
      });
    }
  } catch (e) {}

  // Swap hero image if getHeroImage function provided
  if (typeof getHeroImage === 'function') {
    try {
      const heroBg = $w('#heroBg');
      if (heroBg) {
        const newImage = getHeroImage(heroConfig.imageKey);
        if (newImage) heroBg.src = newImage;
      }
    } catch (e) {}
  }
}

// Export for testing
export { CATEGORY_HERO_CONFIG, CROSS_SELL_MAP };
