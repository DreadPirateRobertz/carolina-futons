import { describe, it, expect } from 'vitest';
import {
  getIntroText,
  getServiceTiers,
  getDeliveryRates,
} from '../src/public/deliveryHelpers.js';

// ── getIntroText ──────────────────────────────────────────────────────

describe('getIntroText', () => {
  it('returns a non-empty string', () => {
    const text = getIntroText();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(50);
  });

  it('mentions not adding delivery costs to prices', () => {
    const text = getIntroText();
    expect(text).toContain("don't add the cost of assembly and delivery");
  });

  it('mentions Grip Strips included free', () => {
    const text = getIntroText();
    expect(text).toContain('Grip Strips');
    expect(text).toContain('no additional charge');
  });
});

// ── getServiceTiers ───────────────────────────────────────────────────

describe('getServiceTiers', () => {
  it('returns exactly 4 service tiers', () => {
    const tiers = getServiceTiers();
    expect(tiers).toHaveLength(4);
  });

  it('each tier has required fields', () => {
    const tiers = getServiceTiers();
    tiers.forEach(tier => {
      expect(tier).toHaveProperty('_id');
      expect(tier).toHaveProperty('title');
      expect(tier).toHaveProperty('price');
      expect(tier).toHaveProperty('description');
      expect(tier).toHaveProperty('icon');
    });
  });

  it('all tier IDs are unique', () => {
    const tiers = getServiceTiers();
    const ids = tiers.map(t => t._id);
    expect(new Set(ids).size).toBe(4);
  });

  it('first tier is Do It Yourself (free)', () => {
    const tiers = getServiceTiers();
    expect(tiers[0].title).toBe('Do It Yourself');
    expect(tiers[0].price).toBe('Free');
  });

  it('second tier is Home Drop Off', () => {
    const tiers = getServiceTiers();
    expect(tiers[1].title).toBe('Home Drop Off');
  });

  it('third tier is In-Store Assembly at $40', () => {
    const tiers = getServiceTiers();
    expect(tiers[2].title).toBe('In-Store Assembly');
    expect(tiers[2].price).toContain('$40');
  });

  it('fourth tier is Premium White Glove Service at $60+', () => {
    const tiers = getServiceTiers();
    expect(tiers[3].title).toBe('Premium White Glove Service');
    expect(tiers[3].price).toContain('$60');
  });

  it('all descriptions are non-empty strings', () => {
    const tiers = getServiceTiers();
    tiers.forEach(tier => {
      expect(typeof tier.description).toBe('string');
      expect(tier.description.length).toBeGreaterThan(20);
    });
  });

  it('white glove tier mentions Grip Strips and clean up', () => {
    const tiers = getServiceTiers();
    const whiteGlove = tiers[3];
    expect(whiteGlove.description).toContain('Grip Strips');
    expect(whiteGlove.description).toContain('clean up');
  });
});

// ── getDeliveryRates ──────────────────────────────────────────────────

describe('getDeliveryRates', () => {
  it('returns minimum charge of $25', () => {
    const rates = getDeliveryRates();
    expect(rates.minimumCharge).toContain('$25');
  });

  it('returns 10-mile minimum radius', () => {
    const rates = getDeliveryRates();
    expect(rates.minimumRadius).toContain('10');
  });

  it('has a note about contacting for rates', () => {
    const rates = getDeliveryRates();
    expect(rates.note).toContain('Contact us');
  });
});
