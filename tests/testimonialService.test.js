import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  submitTestimonial,
  getFeaturedTestimonials,
  getTestimonialsByCategory,
  getMyTestimonials,
  getTestimonialSchema,
} from '../src/backend/testimonialService.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
});

// ── submitTestimonial ─────────────────────────────────────────────────

describe('submitTestimonial', () => {
  it('creates a pending testimonial', async () => {
    const result = await submitTestimonial({
      name: 'Jane Doe',
      story: 'Absolutely love our new futon frame. Best furniture purchase we have made!',
      rating: 5,
      source: 'thank_you',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it('rejects story shorter than 10 characters', async () => {
    const result = await submitTestimonial({
      name: 'Jane',
      story: 'Great!',
      rating: 5,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('at least 10');
  });

  it('sanitizes HTML from story input', async () => {
    const result = await submitTestimonial({
      name: '<script>alert(1)</script>Jane',
      story: 'Wonderful product! <img onerror=alert(1)> Really high quality craftsmanship.',
      rating: 5,
    });

    expect(result.success).toBe(true);
  });

  it('clamps rating to 1-5 range', async () => {
    const result = await submitTestimonial({
      name: 'Test',
      story: 'This is a perfectly valid testimonial text.',
      rating: 99,
    });

    expect(result.success).toBe(true);
  });

  it('defaults name when empty', async () => {
    const result = await submitTestimonial({
      name: '',
      story: 'Great furniture, highly recommend Carolina Futons!',
    });

    expect(result.success).toBe(true);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await submitTestimonial({
      name: 'Test',
      story: 'This should fail because not logged in.',
    });

    expect(result.success).toBe(false);
  });
});

// ── getFeaturedTestimonials ───────────────────────────────────────────

describe('getFeaturedTestimonials', () => {
  it('returns featured testimonials', async () => {
    __seed('Testimonials', [
      { _id: 't-1', status: 'featured', name: 'Sarah', story: 'Amazing quality!', rating: 5, approvedAt: new Date('2026-02-20') },
      { _id: 't-2', status: 'featured', name: 'James', story: 'Best furniture store.', rating: 5, approvedAt: new Date('2026-02-19') },
      { _id: 't-3', status: 'pending', name: 'Bob', story: 'Not yet approved.', rating: 4, approvedAt: null },
    ]);

    const result = await getFeaturedTestimonials(6);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe('Sarah');
  });

  it('returns empty when no featured testimonials', async () => {
    __seed('Testimonials', [
      { _id: 't-1', status: 'pending', name: 'Bob', story: 'Pending review.', rating: 4 },
    ]);

    const result = await getFeaturedTestimonials();
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});

// ── getTestimonialsByCategory ─────────────────────────────────────────

describe('getTestimonialsByCategory', () => {
  it('filters by product category', async () => {
    __seed('Testimonials', [
      { _id: 't-1', status: 'approved', name: 'Sarah', story: 'Love the frame!', productCategory: 'futon-frames', approvedAt: new Date() },
      { _id: 't-2', status: 'approved', name: 'James', story: 'Great mattress!', productCategory: 'mattresses', approvedAt: new Date() },
      { _id: 't-3', status: 'featured', name: 'Linda', story: 'Beautiful bed!', productCategory: 'futon-frames', approvedAt: new Date() },
    ]);

    const result = await getTestimonialsByCategory('futon-frames');
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('returns all approved/featured when no category specified', async () => {
    __seed('Testimonials', [
      { _id: 't-1', status: 'approved', name: 'A', story: 'Great!', approvedAt: new Date() },
      { _id: 't-2', status: 'featured', name: 'B', story: 'Wonderful!', approvedAt: new Date() },
      { _id: 't-3', status: 'rejected', name: 'C', story: 'Hidden.', approvedAt: null },
    ]);

    const result = await getTestimonialsByCategory();
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
  });
});

// ── getMyTestimonials ─────────────────────────────────────────────────

describe('getMyTestimonials', () => {
  it('returns current member testimonials', async () => {
    __seed('Testimonials', [
      { _id: 't-1', memberId: 'member-1', name: 'Me', story: 'My review', submittedAt: new Date() },
      { _id: 't-2', memberId: 'member-2', name: 'Other', story: 'Their review', submittedAt: new Date() },
    ]);

    const result = await getMyTestimonials();
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].memberId).toBe('member-1');
  });
});

// ── getTestimonialSchema ──────────────────────────────────────────────

describe('getTestimonialSchema', () => {
  it('generates valid JSON-LD with aggregate rating', async () => {
    __seed('Testimonials', [
      { _id: 't-1', status: 'approved', name: 'Sarah', story: 'Outstanding!', rating: 5, approvedAt: new Date('2026-02-20') },
      { _id: 't-2', status: 'featured', name: 'James', story: 'Excellent!', rating: 4, approvedAt: new Date('2026-02-19') },
    ]);

    const schemaJson = await getTestimonialSchema();
    expect(schemaJson).toBeTruthy();

    const schema = JSON.parse(schemaJson);
    expect(schema['@type']).toBe('LocalBusiness');
    expect(schema.name).toBe('Carolina Futons');
    expect(schema.aggregateRating.ratingValue).toBe('4.5');
    expect(schema.aggregateRating.reviewCount).toBe('2');
    expect(schema.review).toHaveLength(2);
  });

  it('returns empty string when no testimonials', async () => {
    __seed('Testimonials', []);
    const result = await getTestimonialSchema();
    expect(result).toBe('');
  });
});
