import { describe, it, expect } from 'vitest';

const {
  normalizeProductName,
  findKDMatch,
} = require('../../scripts/auditProductMedia');

// ── normalizeProductName ────────────────────────────────────────────

describe('normalizeProductName', () => {
  it('lowercases name', () => {
    expect(normalizeProductName('Nomad Platform Bed')).toBe('nomad platform bed');
  });

  it('strips special characters', () => {
    expect(normalizeProductName("Night & Day's")).toBe('night day s');
  });

  it('collapses whitespace', () => {
    expect(normalizeProductName('  Nomad   Plus  Bed  ')).toBe('nomad plus bed');
  });

  it('handles empty/null', () => {
    expect(normalizeProductName('')).toBe('');
    expect(normalizeProductName(null)).toBe('');
  });
});

// ── findKDMatch ─────────────────────────────────────────────────────

describe('findKDMatch', () => {
  const kdMap = {
    'nomad-plus-platform-bed': {
      name: 'Nomad Platform Bed',
      images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
    },
    'charleston-platform-bed': {
      name: 'Charleston Platform Bed',
      images: ['img4.jpg'],
    },
    'kd-lounger-futon': {
      name: 'KD Lounger Futon',
      images: ['img5.jpg', 'img6.jpg'],
    },
    'fold-platform-bed': {
      name: 'Fold Platform Bed',
      images: ['img7.jpg'],
    },
  };

  it('matches exact name', () => {
    const match = findKDMatch('Nomad Platform Bed', kdMap);
    expect(match).not.toBeNull();
    expect(match.slug).toBe('nomad-plus-platform-bed');
    expect(match.images).toHaveLength(3);
  });

  it('matches when Wix name is longer', () => {
    const match = findKDMatch('KD Lounger Futon Frame', kdMap);
    expect(match).not.toBeNull();
    expect(match.slug).toBe('kd-lounger-futon');
  });

  it('matches Fold → Folding Platform Bed', () => {
    const match = findKDMatch('Folding Platform Bed', kdMap);
    expect(match).not.toBeNull();
    expect(match.slug).toBe('fold-platform-bed');
  });

  it('returns null for no match', () => {
    const match = findKDMatch('Murphy Express Cabinet Bed', kdMap);
    expect(match).toBeNull();
  });

  it('returns null for empty name', () => {
    const match = findKDMatch('', kdMap);
    expect(match).toBeNull();
  });

  it('returns null for empty catalog', () => {
    const match = findKDMatch('Nomad Platform Bed', {});
    expect(match).toBeNull();
  });

  it('matches partial word overlap', () => {
    const match = findKDMatch('Charleston Platform Bed Frame Queen', kdMap);
    expect(match).not.toBeNull();
    expect(match.slug).toBe('charleston-platform-bed');
  });
});
