import { describe, it, expect } from 'vitest';

import {
  getSustainabilityPageContent,
  getMaterialHighlights,
  getCertificationsList,
  getBadgeDefinitions,
  getConditionOptions,
  formatCarbonData,
  formatTradeInStatus,
  getTradeInSteps,
  estimateCreditRange,
} from '../../src/public/sustainabilityHelpers.js';

// ── getSustainabilityPageContent ──────────────────────────────────────

describe('getSustainabilityPageContent', () => {
  it('returns object with hero section content', () => {
    const content = getSustainabilityPageContent();
    expect(content).toHaveProperty('hero');
    expect(content.hero).toHaveProperty('heading');
    expect(content.hero).toHaveProperty('subheading');
    expect(content.hero).toHaveProperty('intro');
    expect(typeof content.hero.heading).toBe('string');
    expect(content.hero.heading.length).toBeGreaterThan(0);
  });

  it('hero content references sustainability or eco-friendly messaging', () => {
    const content = getSustainabilityPageContent();
    const combined = `${content.hero.heading} ${content.hero.subheading} ${content.hero.intro}`.toLowerCase();
    expect(combined).toMatch(/sustain|eco|green|planet|environment/);
  });

  it('returns sections for materials, certifications, tradeIn', () => {
    const content = getSustainabilityPageContent();
    expect(content).toHaveProperty('materials');
    expect(content).toHaveProperty('certifications');
    expect(content).toHaveProperty('tradeIn');
    expect(content.materials).toHaveProperty('heading');
    expect(content.certifications).toHaveProperty('heading');
    expect(content.tradeIn).toHaveProperty('heading');
  });

  it('trade-in section includes a call-to-action description', () => {
    const content = getSustainabilityPageContent();
    expect(content.tradeIn).toHaveProperty('description');
    expect(content.tradeIn.description.length).toBeGreaterThan(10);
  });
});

// ── getMaterialHighlights ─────────────────────────────────────────────

describe('getMaterialHighlights', () => {
  it('returns array of material highlights', () => {
    const highlights = getMaterialHighlights();
    expect(Array.isArray(highlights)).toBe(true);
    expect(highlights.length).toBeGreaterThanOrEqual(3);
  });

  it('each highlight has title, description, and icon', () => {
    const highlights = getMaterialHighlights();
    for (const h of highlights) {
      expect(h).toHaveProperty('title');
      expect(h).toHaveProperty('description');
      expect(h).toHaveProperty('icon');
      expect(typeof h.title).toBe('string');
      expect(typeof h.description).toBe('string');
      expect(typeof h.icon).toBe('string');
      expect(h.title.length).toBeGreaterThan(0);
      expect(h.description.length).toBeGreaterThan(0);
    }
  });

  it('includes wood sourcing highlight', () => {
    const highlights = getMaterialHighlights();
    const wood = highlights.find(h =>
      h.title.toLowerCase().includes('wood') || h.description.toLowerCase().includes('wood')
    );
    expect(wood).toBeTruthy();
  });
});

// ── getCertificationsList ─────────────────────────────────────────────

describe('getCertificationsList', () => {
  it('returns array of certifications', () => {
    const certs = getCertificationsList();
    expect(Array.isArray(certs)).toBe(true);
    expect(certs.length).toBeGreaterThanOrEqual(2);
  });

  it('each certification has name, description, and icon', () => {
    const certs = getCertificationsList();
    for (const cert of certs) {
      expect(cert).toHaveProperty('name');
      expect(cert).toHaveProperty('description');
      expect(cert).toHaveProperty('icon');
      expect(typeof cert.name).toBe('string');
      expect(cert.name.length).toBeGreaterThan(0);
    }
  });

  it('includes FSC or GREENGUARD certification', () => {
    const certs = getCertificationsList();
    const known = certs.find(c =>
      c.name.match(/FSC|GREENGUARD|CertiPUR/i)
    );
    expect(known).toBeTruthy();
  });
});

// ── getBadgeDefinitions ───────────────────────────────────────────────

describe('getBadgeDefinitions', () => {
  it('returns array of badge definitions', () => {
    const badges = getBadgeDefinitions();
    expect(Array.isArray(badges)).toBe(true);
    expect(badges.length).toBeGreaterThanOrEqual(4);
  });

  it('each badge has slug, label, icon, and description', () => {
    const badges = getBadgeDefinitions();
    for (const badge of badges) {
      expect(badge).toHaveProperty('slug');
      expect(badge).toHaveProperty('label');
      expect(badge).toHaveProperty('icon');
      expect(badge).toHaveProperty('description');
      expect(typeof badge.slug).toBe('string');
      expect(typeof badge.label).toBe('string');
      expect(badge.slug.length).toBeGreaterThan(0);
    }
  });

  it('includes eco-material and long-lasting badges', () => {
    const badges = getBadgeDefinitions();
    const slugs = badges.map(b => b.slug);
    expect(slugs).toContain('eco-material');
    expect(slugs).toContain('long-lasting');
  });

  it('includes trade-in-eligible badge', () => {
    const badges = getBadgeDefinitions();
    const slugs = badges.map(b => b.slug);
    expect(slugs).toContain('trade-in-eligible');
  });
});

// ── getConditionOptions ───────────────────────────────────────────────

describe('getConditionOptions', () => {
  it('returns array of condition options', () => {
    const options = getConditionOptions();
    expect(Array.isArray(options)).toBe(true);
    expect(options).toHaveLength(4);
  });

  it('each option has value, label, and creditRange', () => {
    const options = getConditionOptions();
    for (const opt of options) {
      expect(opt).toHaveProperty('value');
      expect(opt).toHaveProperty('label');
      expect(opt).toHaveProperty('creditRange');
      expect(opt.creditRange).toHaveProperty('min');
      expect(opt.creditRange).toHaveProperty('max');
      expect(typeof opt.creditRange.min).toBe('number');
      expect(typeof opt.creditRange.max).toBe('number');
      expect(opt.creditRange.max).toBeGreaterThanOrEqual(opt.creditRange.min);
    }
  });

  it('condition values are excellent, good, fair, poor', () => {
    const options = getConditionOptions();
    const values = options.map(o => o.value);
    expect(values).toContain('excellent');
    expect(values).toContain('good');
    expect(values).toContain('fair');
    expect(values).toContain('poor');
  });

  it('excellent has highest credit range', () => {
    const options = getConditionOptions();
    const excellent = options.find(o => o.value === 'excellent');
    const poor = options.find(o => o.value === 'poor');
    expect(excellent.creditRange.max).toBeGreaterThan(poor.creditRange.max);
  });
});

// ── formatCarbonData ──────────────────────────────────────────────────

describe('formatCarbonData', () => {
  it('formats carbon offset data for display', () => {
    const result = formatCarbonData({
      totalCarbonKg: 45.3,
      offsetCost: 1.00,
      treesEquivalent: 2.1,
      productsMatched: 2,
      productsRequested: 2,
    });

    expect(result).toHaveProperty('carbonText');
    expect(result).toHaveProperty('costText');
    expect(result).toHaveProperty('treesText');
    expect(typeof result.carbonText).toBe('string');
    expect(typeof result.costText).toBe('string');
    expect(typeof result.treesText).toBe('string');
  });

  it('includes kg in carbon text', () => {
    const result = formatCarbonData({ totalCarbonKg: 45.3, offsetCost: 1, treesEquivalent: 2.1 });
    expect(result.carbonText).toMatch(/45\.3/);
    expect(result.carbonText).toMatch(/kg/i);
  });

  it('formats cost as dollar amount', () => {
    const result = formatCarbonData({ totalCarbonKg: 100, offsetCost: 2.50, treesEquivalent: 4.6 });
    expect(result.costText).toMatch(/\$2\.50/);
  });

  it('handles zero carbon gracefully', () => {
    const result = formatCarbonData({ totalCarbonKg: 0, offsetCost: 0, treesEquivalent: 0 });
    expect(result.carbonText).toBeDefined();
    expect(result.costText).toBeDefined();
    expect(result.treesText).toBeDefined();
  });

  it('returns null for null/undefined input', () => {
    expect(formatCarbonData(null)).toBeNull();
    expect(formatCarbonData(undefined)).toBeNull();
  });
});

// ── formatTradeInStatus ───────────────────────────────────────────────

describe('formatTradeInStatus', () => {
  it('returns human-readable label for each status', () => {
    const statuses = ['submitted', 'reviewing', 'approved', 'shipped', 'received', 'credited', 'rejected'];
    for (const status of statuses) {
      const result = formatTradeInStatus(status);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('submitted status indicates pending review', () => {
    const result = formatTradeInStatus('submitted');
    expect(result.toLowerCase()).toMatch(/submitted|pending|received/);
  });

  it('credited status indicates credit issued', () => {
    const result = formatTradeInStatus('credited');
    expect(result.toLowerCase()).toMatch(/credit|issued|applied/);
  });

  it('returns the raw status for unknown values', () => {
    const result = formatTradeInStatus('unknown_status');
    expect(result).toBe('unknown_status');
  });

  it('handles empty/null input', () => {
    expect(formatTradeInStatus('')).toBe('');
    expect(formatTradeInStatus(null)).toBe('');
    expect(formatTradeInStatus(undefined)).toBe('');
  });
});

// ── getTradeInSteps ───────────────────────────────────────────────────

describe('getTradeInSteps', () => {
  it('returns array of trade-in process steps', () => {
    const steps = getTradeInSteps();
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  it('each step has number, title, and description', () => {
    const steps = getTradeInSteps();
    for (const step of steps) {
      expect(step).toHaveProperty('number');
      expect(step).toHaveProperty('title');
      expect(step).toHaveProperty('description');
      expect(typeof step.number).toBe('number');
      expect(typeof step.title).toBe('string');
      expect(step.title.length).toBeGreaterThan(0);
    }
  });

  it('steps are numbered sequentially starting from 1', () => {
    const steps = getTradeInSteps();
    steps.forEach((step, i) => {
      expect(step.number).toBe(i + 1);
    });
  });
});

// ── estimateCreditRange ───────────────────────────────────────────────

describe('estimateCreditRange', () => {
  it('returns credit range for valid condition', () => {
    const result = estimateCreditRange('excellent');
    expect(result).toHaveProperty('min');
    expect(result).toHaveProperty('max');
    expect(result).toHaveProperty('estimated');
    expect(result.min).toBeGreaterThan(0);
    expect(result.max).toBeGreaterThan(result.min);
    expect(result.estimated).toBe(Math.round((result.min + result.max) / 2));
  });

  it('returns progressively lower ranges for worse conditions', () => {
    const excellent = estimateCreditRange('excellent');
    const good = estimateCreditRange('good');
    const fair = estimateCreditRange('fair');
    const poor = estimateCreditRange('poor');

    expect(excellent.max).toBeGreaterThan(good.max);
    expect(good.max).toBeGreaterThan(fair.max);
    expect(fair.max).toBeGreaterThan(poor.max);
  });

  it('returns null for invalid condition', () => {
    expect(estimateCreditRange('broken')).toBeNull();
    expect(estimateCreditRange('')).toBeNull();
    expect(estimateCreditRange(null)).toBeNull();
  });
});
