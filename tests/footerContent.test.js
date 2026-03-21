/**
 * Tests for footerContent.js — Rich 4-column footer with nav, contact,
 * trust badges, store info, and payment icons.
 *
 * CF-8gzd: Footer redesign — proper footer with columns, newsletter, social proof
 */
import { describe, it, expect, vi } from 'vitest';
import {
  getFooterShopLinks,
  getFooterServiceLinks,
  getFooterAboutLinks,
  getStoreInfo,
  getTrustBadges,
  getPaymentMethods,
  getFooterSocialLinks,
} from '../src/public/footerContent.js';

// ── getFooterShopLinks ──────────────────────────────────────────────

describe('getFooterShopLinks', () => {
  it('returns array of shop navigation links', () => {
    const links = getFooterShopLinks();
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBeGreaterThan(0);
  });

  it('each link has label and path', () => {
    const links = getFooterShopLinks();
    for (const link of links) {
      expect(link).toHaveProperty('label');
      expect(link).toHaveProperty('path');
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.path.startsWith('/')).toBe(true);
    }
  });

  it('includes core product categories', () => {
    const links = getFooterShopLinks();
    const labels = links.map(l => l.label.toLowerCase());
    expect(labels.some(l => l.includes('futon'))).toBe(true);
    expect(labels.some(l => l.includes('mattress'))).toBe(true);
    expect(labels.some(l => l.includes('murphy') || l.includes('cabinet'))).toBe(true);
  });
});

// ── getFooterServiceLinks ───────────────────────────────────────────

describe('getFooterServiceLinks', () => {
  it('returns array of customer service links', () => {
    const links = getFooterServiceLinks();
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBeGreaterThan(0);
  });

  it('each link has label and path', () => {
    const links = getFooterServiceLinks();
    for (const link of links) {
      expect(link).toHaveProperty('label');
      expect(link).toHaveProperty('path');
    }
  });

  it('includes shipping, returns, and contact links', () => {
    const links = getFooterServiceLinks();
    const labels = links.map(l => l.label.toLowerCase());
    expect(labels.some(l => l.includes('shipping'))).toBe(true);
    expect(labels.some(l => l.includes('return'))).toBe(true);
    expect(labels.some(l => l.includes('contact'))).toBe(true);
  });

  it('includes FAQ link', () => {
    const links = getFooterServiceLinks();
    const labels = links.map(l => l.label.toLowerCase());
    expect(labels.some(l => l.includes('faq'))).toBe(true);
  });
});

// ── getFooterAboutLinks ─────────────────────────────────────────────

describe('getFooterAboutLinks', () => {
  it('returns array of about/company links', () => {
    const links = getFooterAboutLinks();
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBeGreaterThan(0);
  });

  it('includes about, privacy, and accessibility links', () => {
    const links = getFooterAboutLinks();
    const labels = links.map(l => l.label.toLowerCase());
    expect(labels.some(l => l.includes('about') || l.includes('story'))).toBe(true);
    expect(labels.some(l => l.includes('privacy'))).toBe(true);
    expect(labels.some(l => l.includes('accessibility'))).toBe(true);
  });
});

// ── getStoreInfo ────────────────────────────────────────────────────

describe('getStoreInfo', () => {
  it('returns store information object', () => {
    const info = getStoreInfo();
    expect(info).toHaveProperty('name');
    expect(info).toHaveProperty('address');
    expect(info).toHaveProperty('phone');
    expect(info).toHaveProperty('hours');
  });

  it('address includes Hendersonville NC', () => {
    const info = getStoreInfo();
    expect(info.address).toContain('Hendersonville');
    expect(info.address).toContain('NC');
  });

  it('hours is an array of day/time pairs', () => {
    const info = getStoreInfo();
    expect(Array.isArray(info.hours)).toBe(true);
    expect(info.hours.length).toBeGreaterThan(0);
    for (const h of info.hours) {
      expect(h).toHaveProperty('days');
      expect(h).toHaveProperty('time');
    }
  });

  it('phone is a valid format', () => {
    const info = getStoreInfo();
    expect(info.phone).toMatch(/[\d()-\s]+/);
  });
});

// ── getTrustBadges ──────────────────────────────────────────────────

describe('getTrustBadges', () => {
  it('returns array of trust badge objects', () => {
    const badges = getTrustBadges();
    expect(Array.isArray(badges)).toBe(true);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('each badge has label and icon', () => {
    const badges = getTrustBadges();
    for (const badge of badges) {
      expect(badge).toHaveProperty('label');
      expect(badge).toHaveProperty('icon');
      expect(badge.label.length).toBeGreaterThan(0);
    }
  });

  it('includes family-owned badge', () => {
    const badges = getTrustBadges();
    const labels = badges.map(b => b.label.toLowerCase());
    expect(labels.some(l => l.includes('family') || l.includes('1991'))).toBe(true);
  });
});

// ── getPaymentMethods ───────────────────────────────────────────────

describe('getPaymentMethods', () => {
  it('returns array of accepted payment methods', () => {
    const methods = getPaymentMethods();
    expect(Array.isArray(methods)).toBe(true);
    expect(methods.length).toBeGreaterThan(0);
  });

  it('each method has name and icon', () => {
    const methods = getPaymentMethods();
    for (const m of methods) {
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('icon');
    }
  });

  it('includes Visa and Mastercard', () => {
    const methods = getPaymentMethods();
    const names = methods.map(m => m.name.toLowerCase());
    expect(names).toContain('visa');
    expect(names).toContain('mastercard');
  });
});

// ── getFooterSocialLinks ────────────────────────────────────────────

describe('getFooterSocialLinks', () => {
  it('returns array of social media links', () => {
    const links = getFooterSocialLinks();
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBeGreaterThan(0);
  });

  it('each link has platform, url, and ariaLabel', () => {
    const links = getFooterSocialLinks();
    for (const link of links) {
      expect(link).toHaveProperty('platform');
      expect(link).toHaveProperty('url');
      expect(link).toHaveProperty('ariaLabel');
      expect(link.url.startsWith('https://')).toBe(true);
    }
  });

  it('includes Facebook and Instagram', () => {
    const links = getFooterSocialLinks();
    const platforms = links.map(l => l.platform.toLowerCase());
    expect(platforms).toContain('facebook');
    expect(platforms).toContain('instagram');
  });
});
