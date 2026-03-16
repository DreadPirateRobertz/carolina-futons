import { describe, it, expect, beforeEach } from 'vitest';
import wixData, { __reset as resetData, __seed } from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

import {
  getFeaturedTestimonials,
  getTestimonialSchema,
  updateTestimonialStatus,
  isFlaggedContent,
} from '../src/backend/testimonialService.web.js';

const ADMIN_MEMBER = { _id: 'admin-001', loginEmail: 'admin@carolinafutons.com' };

function seedTestimonials(items) { __seed('Testimonials', items); }

beforeEach(() => {
  resetData();
  resetMembers();
  __setMember(ADMIN_MEMBER);
});

// ═══════════════════════════════════════════════════════════════════
// 1. FEATURED TESTIMONIAL ROTATION
// ═══════════════════════════════════════════════════════════════════

describe('getFeaturedTestimonials rotation', () => {
  it('returns all items when pool is smaller than limit', async () => {
    seedTestimonials([
      { _id: 't1', status: 'featured', approvedAt: new Date('2026-03-01'), name: 'A', story: 'Great', rating: 5 },
      { _id: 't2', status: 'featured', approvedAt: new Date('2026-03-02'), name: 'B', story: 'Awesome', rating: 5 },
    ]);
    const result = await getFeaturedTestimonials(6);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('returns exactly limit items from a larger pool', async () => {
    const testimonials = Array.from({ length: 15 }, (_, i) => ({
      _id: `t-${i}`, status: 'featured',
      approvedAt: new Date(`2026-03-${String(i + 1).padStart(2, '0')}`),
      name: `Person ${i}`, story: `Testimonial ${i}`, rating: 5,
    }));
    seedTestimonials(testimonials);
    const result = await getFeaturedTestimonials(6);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(6);
  });

  it('handles limit of 1', async () => {
    const testimonials = Array.from({ length: 5 }, (_, i) => ({
      _id: `t-${i}`, status: 'featured',
      approvedAt: new Date(`2026-03-${String(i + 1).padStart(2, '0')}`),
      name: `Person ${i}`, story: `Testimonial ${i}`, rating: 5,
    }));
    seedTestimonials(testimonials);
    const result = await getFeaturedTestimonials(1);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
  });

  it('excludes non-featured testimonials', async () => {
    seedTestimonials([
      { _id: 't1', status: 'featured', approvedAt: new Date(), name: 'A', story: 'Great', rating: 5 },
      { _id: 't2', status: 'approved', approvedAt: new Date(), name: 'B', story: 'Also great', rating: 5 },
      { _id: 't3', status: 'pending', name: 'C', story: 'Pending', rating: 4 },
    ]);
    const result = await getFeaturedTestimonials(10);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]._id).toBe('t1');
  });

  it('returns empty array when no featured testimonials exist', async () => {
    seedTestimonials([
      { _id: 't1', status: 'approved', approvedAt: new Date(), name: 'A', story: 'Great', rating: 5 },
    ]);
    const result = await getFeaturedTestimonials(6);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. FEATURED TESTIMONIAL ROTATION DETERMINISM & UNIQUENESS
// ═══════════════════════════════════════════════════════════════════

describe('getFeaturedTestimonials rotation properties', () => {
  const pool = Array.from({ length: 12 }, (_, i) => ({
    _id: `t-${i}`, status: 'featured',
    approvedAt: new Date(`2026-03-${String(i + 1).padStart(2, '0')}`),
    name: `Person ${i}`, story: `Testimonial ${i}`, rating: 5,
  }));

  it('returns unique items (no duplicates) when pool > limit', async () => {
    seedTestimonials(pool);
    const result = await getFeaturedTestimonials(6);
    const ids = result.items.map(t => t._id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is deterministic — same call returns same results', async () => {
    seedTestimonials(pool);
    const result1 = await getFeaturedTestimonials(6);
    seedTestimonials(pool);
    const result2 = await getFeaturedTestimonials(6);
    const ids1 = result1.items.map(t => t._id);
    const ids2 = result2.items.map(t => t._id);
    expect(ids1).toEqual(ids2);
  });

  it('clamps limit to minimum of 1', async () => {
    seedTestimonials(pool);
    const result = await getFeaturedTestimonials(0);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
  });

  it('clamps limit to maximum of 20', async () => {
    const largePool = Array.from({ length: 50 }, (_, i) => ({
      _id: `t-${i}`, status: 'featured', name: `P${i}`, story: `S${i}`, rating: 5,
      approvedAt: new Date(Date.now() - i * 86400000),
    }));
    seedTestimonials(largePool);
    const result = await getFeaturedTestimonials(100);
    expect(result.items.length).toBeLessThanOrEqual(20);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. TESTIMONIAL STATUS UPDATE HARDENING
// ═══════════════════════════════════════════════════════════════════

describe('updateTestimonialStatus hardening', () => {
  const baseTestimonial = {
    _id: 'test-001', memberId: 'member-1', name: 'Jane',
    story: 'Wonderful product experience!', rating: 5,
    status: 'pending', featured: false,
    submittedAt: new Date('2026-03-01'),
  };

  it('approves a pending testimonial', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    const result = await updateTestimonialStatus('test-001', 'approved');
    expect(result.success).toBe(true);
  });

  it('features a testimonial and sets featured flag', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    const result = await updateTestimonialStatus('test-001', 'featured');
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    const result = await updateTestimonialStatus('test-001', 'deleted');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('rejects empty testimonial ID', async () => {
    const result = await updateTestimonialStatus('', 'approved');
    expect(result.success).toBe(false);
  });

  it('rejects null testimonial ID', async () => {
    const result = await updateTestimonialStatus(null, 'approved');
    expect(result.success).toBe(false);
  });

  it('rejects XSS in ID', async () => {
    const result = await updateTestimonialStatus('<script>alert(1)</script>', 'approved');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent testimonial', async () => {
    const result = await updateTestimonialStatus('nonexistent', 'approved');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('sets approvedAt when approving', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    await updateTestimonialStatus('test-001', 'approved');
    const updated = await wixData.get('Testimonials', 'test-001');
    expect(updated.approvedAt).toBeInstanceOf(Date);
    expect(updated.status).toBe('approved');
  });

  it('sets approvedAt when featuring', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    await updateTestimonialStatus('test-001', 'featured');
    const updated = await wixData.get('Testimonials', 'test-001');
    expect(updated.approvedAt).toBeInstanceOf(Date);
    expect(updated.featured).toBe(true);
  });

  it('flags a testimonial', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    const result = await updateTestimonialStatus('test-001', 'flagged');
    expect(result.success).toBe(true);
    const updated = await wixData.get('Testimonials', 'test-001');
    expect(updated.status).toBe('flagged');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. TESTIMONIAL SCHEMA (JSON-LD)
// ═══════════════════════════════════════════════════════════════════

describe('getTestimonialSchema', () => {
  it('returns valid JSON-LD for approved testimonials', async () => {
    seedTestimonials([
      { _id: 't1', status: 'approved', name: 'Alice', story: 'Love it!',
        rating: 5, approvedAt: new Date('2026-03-01') },
      { _id: 't2', status: 'featured', name: 'Bob', story: 'Best purchase!',
        rating: 4, approvedAt: new Date('2026-03-02') },
    ]);
    const schema = await getTestimonialSchema();
    expect(schema).toBeTruthy();
    const parsed = JSON.parse(schema);
    expect(parsed['@type']).toBe('LocalBusiness');
    expect(parsed.aggregateRating.ratingValue).toBe('4.5');
    expect(parsed.review).toHaveLength(2);
  });

  it('returns empty string when no testimonials', async () => {
    const schema = await getTestimonialSchema();
    expect(schema).toBe('');
  });

  it('limits reviews in schema to 10', async () => {
    const testimonials = Array.from({ length: 20 }, (_, i) => ({
      _id: `t-${i}`, status: 'approved', name: `Person ${i}`,
      story: `Story ${i}`, rating: 5, approvedAt: new Date(),
    }));
    seedTestimonials(testimonials);
    const schema = await getTestimonialSchema();
    const parsed = JSON.parse(schema);
    expect(parsed.review).toHaveLength(10);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. FLAGGED CONTENT DETECTION
// ═══════════════════════════════════════════════════════════════════

describe('isFlaggedContent', () => {
  it('flags spam keywords', () => {
    expect(isFlaggedContent('This is a spam review')).toBe(true);
    expect(isFlaggedContent('Visit my casino site')).toBe(true);
    expect(isFlaggedContent('Buy cheap viagra here')).toBe(true);
  });

  it('flags URLs', () => {
    expect(isFlaggedContent('Check out https://evil.com')).toBe(true);
    expect(isFlaggedContent('Visit http://spam.net')).toBe(true);
  });

  it('flags long digit sequences (phone spam)', () => {
    expect(isFlaggedContent('Call me at 1234567890')).toBe(true);
  });

  it('allows legitimate content', () => {
    expect(isFlaggedContent('Amazing futon, love the quality!')).toBe(false);
    expect(isFlaggedContent('Best furniture purchase ever')).toBe(false);
  });

  it('handles null/empty input', () => {
    expect(isFlaggedContent(null)).toBe(false);
    expect(isFlaggedContent('')).toBe(false);
    expect(isFlaggedContent(undefined)).toBe(false);
  });
});
