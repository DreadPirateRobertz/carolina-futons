import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shippingConfig, business } from '../src/public/sharedTokens.js';
import shippingInfo from '../content/shipping-info.json';
import faqContent from '../content/faq.json';
import categoryDescriptions from '../content/category-descriptions.json';

// ══════════════════════════════════════════════════════════════════════
// SHIPPING THRESHOLD ALIGNMENT & SANDBOX TESTING
// Bead: cf-k3o
//
// Verifies:
// 1. Content files match sharedTokens thresholds (999999 = disabled)
// 2. Free shipping disabled (threshold unreachable at $999,999)
// 3. Local pickup restricted to WNC zips (287-289)
// 4. White glove pricing: local $149, regional $249, free disabled
// 5. Fallback rates when UPS API is down
// 6. Edge cases: boundary zips, exact thresholds, international
// ══════════════════════════════════════════════════════════════════════

// ── 1. THRESHOLD ALIGNMENT (content vs sharedTokens) ─────────────────

describe('Threshold alignment — content files match sharedTokens', () => {
  const STANDARD_FREE = shippingConfig.freeThreshold;       // 999999 (disabled)
  const WHITE_GLOVE_FREE = shippingConfig.whiteGlove.freeThreshold; // 999999 (disabled)
  const WHITE_GLOVE_LOCAL = shippingConfig.whiteGlove.localPrice;   // 149
  const WHITE_GLOVE_REGIONAL = shippingConfig.whiteGlove.regionalPrice; // 249

  it('sharedTokens standard free shipping threshold is $999,999 (disabled)', () => {
    expect(STANDARD_FREE).toBe(999999);
  });

  it('sharedTokens white glove free threshold is $999,999 (disabled)', () => {
    expect(WHITE_GLOVE_FREE).toBe(999999);
  });

  it('sharedTokens white glove local price is $149', () => {
    expect(WHITE_GLOVE_LOCAL).toBe(149);
  });

  it('sharedTokens white glove regional price is $249', () => {
    expect(WHITE_GLOVE_REGIONAL).toBe(249);
  });

  it('shipping-info.json standard shipping freeThreshold matches sharedTokens ($999,999)', () => {
    const standardMethod = shippingInfo.shippingPolicy.methods.find(
      m => m.name === 'Standard Shipping'
    );
    expect(standardMethod, 'Standard Shipping method not found in shipping-info.json').toBeDefined();
    expect(standardMethod.freeThreshold).toBe(STANDARD_FREE);
  });

  it('shipping-info.json standard shipping note reflects disabled free shipping', () => {
    const standardMethod = shippingInfo.shippingPolicy.methods.find(
      m => m.name === 'Standard Shipping'
    );
    expect(standardMethod.note).toContain('calculated at checkout');
  });

  it('shipping-info.json white glove local price matches sharedTokens ($149)', () => {
    const localWhiteGlove = shippingInfo.shippingPolicy.methods.find(
      m => m.name === 'Local White-Glove Delivery'
    );
    expect(localWhiteGlove, 'Local White-Glove method not found').toBeDefined();
    expect(localWhiteGlove.price).toBe(WHITE_GLOVE_LOCAL);
  });

  it('shipping-info.json regional white glove price matches sharedTokens ($249)', () => {
    const regionalWhiteGlove = shippingInfo.shippingPolicy.methods.find(
      m => m.name === 'Regional White-Glove Delivery'
    );
    expect(regionalWhiteGlove, 'Regional White-Glove method not found').toBeDefined();
    expect(regionalWhiteGlove.price).toBe(WHITE_GLOVE_REGIONAL);
  });

  it('faq.json shipping answer says free standard at $999', () => {
    const shippingFaq = findFaqByKeyword(faqContent, 'free shipping');
    expect(shippingFaq, 'No FAQ about free shipping found').toBeDefined();
    // Should mention $999 for standard, $1,999 only for white-glove context
    expect(shippingFaq.answer).toContain('$999');
  });

  it('faq.json shipping answer does not claim standard shipping free at $1,999', () => {
    const shippingFaq = findFaqByKeyword(faqContent, 'free shipping');
    if (!shippingFaq) return; // covered by prior test
    // The answer should NOT say "free standard shipping on orders over $1,999"
    const lower = shippingFaq.answer.toLowerCase();
    const claimsStandardAt1999 = lower.includes('free standard shipping on orders over $1,999') ||
      lower.includes('free shipping on orders over $1,999');
    expect(claimsStandardAt1999, 'FAQ incorrectly says standard shipping free at $1,999').toBe(false);
  });

  it('category-descriptions.json shipping references say $999 not $1,999', () => {
    const allDescriptions = getAllCategoryText(categoryDescriptions);
    const shippingMentions = allDescriptions.filter(
      t => /free shipping/i.test(t)
    );
    for (const text of shippingMentions) {
      // Any "free shipping over $X" should use $999
      if (/free shipping over \$[\d,]+/i.test(text)) {
        expect(text, `Category text has wrong threshold: "${text}"`).toMatch(/free shipping over \$999/i);
      }
    }
  });
});

// ── 2. FREE SHIPPING DISABLED (threshold $999,999 = unreachable) ─────

describe('Free shipping disabled — threshold unreachable', () => {
  // With freeThreshold at 999999, no realistic order qualifies

  it('$998.99 does NOT qualify for free shipping', () => {
    expect(998.99 >= shippingConfig.freeThreshold).toBe(false);
  });

  it('$999.00 does NOT qualify for free shipping (threshold now $999,999)', () => {
    expect(999 >= shippingConfig.freeThreshold).toBe(false);
  });

  it('$999.01 does NOT qualify for free shipping (threshold now $999,999)', () => {
    expect(999.01 >= shippingConfig.freeThreshold).toBe(false);
  });

  it('$0 does NOT qualify for free shipping', () => {
    expect(0 >= shippingConfig.freeThreshold).toBe(false);
  });

  it('negative amount does NOT qualify for free shipping', () => {
    expect(-100 >= shippingConfig.freeThreshold).toBe(false);
  });
});

// ── 3. LOCAL PICKUP ZIP RESTRICTION (287-289) ────────────────────────

describe('Local pickup — WNC zip codes only (287-289)', () => {
  const { local } = shippingConfig.zones;

  it('zone config defines WNC as zip prefix 287-289', () => {
    expect(local.prefixMin).toBe(287);
    expect(local.prefixMax).toBe(289);
  });

  it('28792 (Hendersonville) qualifies for local pickup', () => {
    expect(isLocalZip('28792', local)).toBe(true);
  });

  it('28701 (Asheville) qualifies for local pickup', () => {
    expect(isLocalZip('28701', local)).toBe(true);
  });

  it('28901 (Murphy, far WNC) qualifies for local pickup', () => {
    expect(isLocalZip('28901', local)).toBe(true);
  });

  it('27601 (Raleigh, 276) does NOT qualify for local pickup', () => {
    expect(isLocalZip('27601', local)).toBe(false);
  });

  it('29201 (Columbia SC, 292) does NOT qualify for local pickup', () => {
    expect(isLocalZip('29201', local)).toBe(false);
  });

  it('30301 (Atlanta, 303) does NOT qualify for local pickup', () => {
    expect(isLocalZip('30301', local)).toBe(false);
  });

  it('10001 (NYC) does NOT qualify for local pickup', () => {
    expect(isLocalZip('10001', local)).toBe(false);
  });

  it('empty zip does NOT qualify', () => {
    expect(isLocalZip('', local)).toBe(false);
  });

  it('null zip does NOT qualify', () => {
    expect(isLocalZip(null, local)).toBe(false);
  });

  it('zip 28699 (border: 286) does NOT qualify', () => {
    expect(isLocalZip('28699', local)).toBe(false);
  });

  it('zip 29000 (border: 290) does NOT qualify', () => {
    expect(isLocalZip('29000', local)).toBe(false);
  });
});

// ── 4. WHITE GLOVE PRICING ──────────────────────────────────────────

describe('White glove delivery pricing', () => {
  const { whiteGlove, zones } = shippingConfig;

  it('local white glove costs $149 (free threshold disabled)', () => {
    const price = getWhiteGlovePrice(1500, '28792', zones, whiteGlove);
    expect(price).toBe(149);
  });

  it('regional white glove costs $249 (free threshold disabled)', () => {
    const price = getWhiteGlovePrice(1500, '27601', zones, whiteGlove);
    expect(price).toBe(249);
  });

  it('white glove at $1,999 is NOT free — threshold disabled (local)', () => {
    const price = getWhiteGlovePrice(1999, '28792', zones, whiteGlove);
    expect(price).toBe(149);
  });

  it('white glove at $2,000 is NOT free — threshold disabled (regional)', () => {
    const price = getWhiteGlovePrice(2000, '27601', zones, whiteGlove);
    expect(price).toBe(249);
  });

  it('white glove at $1,998.99 is NOT free (local)', () => {
    const price = getWhiteGlovePrice(1998.99, '28792', zones, whiteGlove);
    expect(price).toBe(149);
  });

  it('white glove at $1,998.99 is NOT free (regional)', () => {
    const price = getWhiteGlovePrice(1998.99, '27601', zones, whiteGlove);
    expect(price).toBe(249);
  });

  it('white glove for $5,000 order is NOT free — threshold disabled', () => {
    const price = getWhiteGlovePrice(5000, '28792', zones, whiteGlove);
    expect(price).toBe(149);
  });
});

// ── 5. FALLBACK RATES (UPS API down) ────────────────────────────────

describe('Fallback flat rates by region', () => {
  // Mirrors getFallbackRates from ups-shipping.web.js

  it('NC/SC (270-299) → $29.99 ground', () => {
    expect(getFallbackGround('28792')).toBe(29.99);
    expect(getFallbackGround('27601')).toBe(29.99);
    expect(getFallbackGround('29201')).toBe(29.99);
  });

  it('Southeast (300-399) → $39.99 ground', () => {
    expect(getFallbackGround('30301')).toBe(39.99);
    expect(getFallbackGround('37201')).toBe(39.99);
    expect(getFallbackGround('39901')).toBe(39.99);
  });

  it('Northeast (100-199) → $59.99 ground', () => {
    expect(getFallbackGround('10001')).toBe(59.99);
    expect(getFallbackGround('19901')).toBe(59.99);
  });

  it('West Coast (900-999) → $79.99 ground', () => {
    expect(getFallbackGround('90210')).toBe(79.99);
    expect(getFallbackGround('98101')).toBe(79.99);
  });

  it('Other regions → $49.99 ground (default)', () => {
    expect(getFallbackGround('50001')).toBe(49.99); // Midwest
    expect(getFallbackGround('60601')).toBe(49.99); // Chicago
    expect(getFallbackGround('80201')).toBe(49.99); // Denver
  });

  it('empty/null postal code → $49.99 default', () => {
    expect(getFallbackGround('')).toBe(49.99);
    expect(getFallbackGround(null)).toBe(49.99);
    expect(getFallbackGround(undefined)).toBe(49.99);
  });

  it('fallback includes 2nd Day Air at ground + $40', () => {
    const rates = getFallbackRates('28792');
    expect(rates).toHaveLength(2);
    const ground = rates.find(r => r.code === 'ups-ground-est');
    const twoDay = rates.find(r => r.code === 'ups-2day-est');
    expect(ground).toBeDefined();
    expect(twoDay).toBeDefined();
    expect(twoDay.cost).toBe(ground.cost + 40);
  });

  it('fallback rates have isEstimate flag', () => {
    const rates = getFallbackRates('28792');
    for (const rate of rates) {
      expect(rate.isEstimate).toBe(true);
    }
  });

  it('boundary: zip prefix 269 is NOT NC/SC tier', () => {
    expect(getFallbackGround('26901')).toBe(49.99);
  });

  it('boundary: zip prefix 270 IS NC/SC tier', () => {
    expect(getFallbackGround('27001')).toBe(29.99);
  });

  it('boundary: zip prefix 299 IS NC/SC tier', () => {
    expect(getFallbackGround('29901')).toBe(29.99);
  });

  it('boundary: zip prefix 300 IS Southeast tier', () => {
    expect(getFallbackGround('30001')).toBe(39.99);
  });

  it('boundary: zip prefix 399 IS Southeast tier', () => {
    expect(getFallbackGround('39901')).toBe(39.99);
  });

  it('boundary: zip prefix 400 is default tier', () => {
    expect(getFallbackGround('40001')).toBe(49.99);
  });
});

// ── 6. REGIONAL ZONE CONFIG ──────────────────────────────────────────

describe('Regional zone configuration', () => {
  const { zones } = shippingConfig;

  it('local zone is WNC (287-289)', () => {
    expect(zones.local.prefixMin).toBe(287);
    expect(zones.local.prefixMax).toBe(289);
    expect(zones.local.name).toBe('WNC');
  });

  it('regional zone is Southeast (270-399)', () => {
    expect(zones.regional.prefixMin).toBe(270);
    expect(zones.regional.prefixMax).toBe(399);
    expect(zones.regional.name).toBe('Southeast');
  });

  it('local zone is a subset of regional zone', () => {
    expect(zones.local.prefixMin).toBeGreaterThanOrEqual(zones.regional.prefixMin);
    expect(zones.local.prefixMax).toBeLessThanOrEqual(zones.regional.prefixMax);
  });
});

// ── 7. BUSINESS ADDRESS (origin for shipping) ────────────────────────

describe('Business address for shipping origin', () => {
  it('business address is Hendersonville, NC', () => {
    expect(business.address.city).toBe('Hendersonville');
    expect(business.address.state).toBe('NC');
  });

  it('business zip is 28792 (in local zone)', () => {
    expect(business.address.zip).toBe('28792');
    const prefix = parseInt(business.address.zip.substring(0, 3));
    expect(prefix).toBeGreaterThanOrEqual(shippingConfig.zones.local.prefixMin);
    expect(prefix).toBeLessThanOrEqual(shippingConfig.zones.local.prefixMax);
  });

  it('delivery days are Wed-Sat (3,4,5,6)', () => {
    expect(business.deliveryDays).toEqual([3, 4, 5, 6]);
  });
});

// ══════════════════════════════════════════════════════════════════════
// TEST HELPERS — mirror logic from shipping-rates-plugin.js / ups-shipping.web.js
// ══════════════════════════════════════════════════════════════════════

function isLocalZip(postalCode, localZone) {
  if (!postalCode) return false;
  const prefix = parseInt(String(postalCode).substring(0, 3));
  if (isNaN(prefix)) return false;
  return prefix >= localZone.prefixMin && prefix <= localZone.prefixMax;
}

function getWhiteGlovePrice(orderSubtotal, postalCode, zones, whiteGloveConfig) {
  if (orderSubtotal >= whiteGloveConfig.freeThreshold) return 0;
  const prefix = parseInt(String(postalCode).substring(0, 3));
  const isLocal = prefix >= zones.local.prefixMin && prefix <= zones.local.prefixMax;
  return isLocal ? whiteGloveConfig.localPrice : whiteGloveConfig.regionalPrice;
}

function getFallbackRates(postalCode) {
  const prefix = postalCode ? parseInt(String(postalCode).substring(0, 3)) : 0;
  let groundRate = 49.99;
  if (prefix >= 270 && prefix <= 299) groundRate = 29.99;
  else if (prefix >= 300 && prefix <= 399) groundRate = 39.99;
  else if (prefix >= 100 && prefix <= 199) groundRate = 59.99;
  else if (prefix >= 900 && prefix <= 999) groundRate = 79.99;
  return [
    { code: 'ups-ground-est', title: 'UPS Ground (Estimated)', cost: groundRate, estimatedDelivery: '5-7 business days', isEstimate: true },
    { code: 'ups-2day-est', title: 'UPS 2nd Day Air (Estimated)', cost: groundRate + 40, estimatedDelivery: '2 business days', isEstimate: true },
  ];
}

function getFallbackGround(postalCode) {
  return getFallbackRates(postalCode)[0].cost;
}

function findFaqByKeyword(faqData, keyword) {
  const lowerKeyword = keyword.toLowerCase();
  // Structure: { categories: [{ title, faqs: [{ question, answer }] }] }
  const categories = faqData?.categories || [];
  for (const cat of categories) {
    const faqs = cat.faqs || [];
    for (const faq of faqs) {
      if (faq.question && faq.question.toLowerCase().includes(lowerKeyword)) return faq;
      if (faq.answer && faq.answer.toLowerCase().includes(lowerKeyword)) return faq;
    }
  }
  return null;
}

function getAllCategoryText(catData) {
  const texts = [];
  if (Array.isArray(catData)) {
    for (const item of catData) {
      if (typeof item === 'string') texts.push(item);
      if (item && typeof item === 'object') {
        for (const val of Object.values(item)) {
          if (typeof val === 'string') texts.push(val);
        }
      }
    }
  } else if (catData && typeof catData === 'object') {
    for (const val of Object.values(catData)) {
      if (typeof val === 'string') texts.push(val);
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string') texts.push(item);
          if (item && typeof item === 'object') {
            for (const v of Object.values(item)) {
              if (typeof v === 'string') texts.push(v);
            }
          }
        }
      }
    }
  }
  return texts;
}
