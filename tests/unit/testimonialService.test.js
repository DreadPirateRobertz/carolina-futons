import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from '../__mocks__/wix-data.js';
import { __setMember } from '../__mocks__/wix-members-backend.js';
import { __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import {
  submitTestimonial,
  getFeaturedTestimonials,
  getTestimonialsByCategory,
  getMyTestimonials,
  getTestimonialSchema,
  updateTestimonialStatus,
  getPendingTestimonials,
  isFlaggedContent,
} from '../../src/backend/testimonialService.web.js';

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

  it('caps reviews at 10 in schema', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      _id: `t-${i}`,
      status: 'approved',
      name: `Customer ${i}`,
      story: `Great product ${i}!`,
      rating: 5,
      approvedAt: new Date(),
    }));
    __seed('Testimonials', items);

    const schema = JSON.parse(await getTestimonialSchema());
    expect(schema.review).toHaveLength(10);
  });
});

// ── updateTestimonialStatus ───────────────────────────────────────────

describe('updateTestimonialStatus', () => {
  it('approves a pending testimonial', async () => {
    __seed('Testimonials', [
      { _id: 't-1', status: 'pending', name: 'Sarah', story: 'Great!', featured: false },
    ]);
    let updated = null;
    __onUpdate((collection, item) => {
      if (collection === 'Testimonials') updated = item;
    });

    const result = await updateTestimonialStatus('t-1', 'approved');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('approved');
    expect(updated.approvedAt).toBeInstanceOf(Date);
    expect(updated.featured).toBe(false);
  });

  it('features a testimonial and sets featured flag', async () => {
    __seed('Testimonials', [
      { _id: 't-1', status: 'pending', name: 'Sarah', story: 'Great!', featured: false },
    ]);
    let updated = null;
    __onUpdate((collection, item) => {
      if (collection === 'Testimonials') updated = item;
    });

    const result = await updateTestimonialStatus('t-1', 'featured');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('featured');
    expect(updated.featured).toBe(true);
  });

  it('rejects a testimonial', async () => {
    __seed('Testimonials', [
      { _id: 't-1', status: 'pending', name: 'Bob', story: 'Meh.', featured: false },
    ]);
    let updated = null;
    __onUpdate((collection, item) => {
      if (collection === 'Testimonials') updated = item;
    });

    const result = await updateTestimonialStatus('t-1', 'rejected');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('rejected');
  });

  it('returns error for invalid status', async () => {
    const result = await updateTestimonialStatus('t-1', 'invalid');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('returns error for missing inputs', async () => {
    const result = await updateTestimonialStatus('', '');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent testimonial', async () => {
    const result = await updateTestimonialStatus('no-such-id', 'approved');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ── getPendingTestimonials ────────────────────────────────────────────

describe('getPendingTestimonials', () => {
  it('returns only pending testimonials', async () => {
    __seed('Testimonials', [
      { _id: 't-1', status: 'pending', name: 'A', story: 'Waiting', submittedAt: new Date() },
      { _id: 't-2', status: 'approved', name: 'B', story: 'Done', submittedAt: new Date() },
      { _id: 't-3', status: 'pending', name: 'C', story: 'Also waiting', submittedAt: new Date() },
    ]);

    const result = await getPendingTestimonials();
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('returns empty when no pending testimonials', async () => {
    __seed('Testimonials', [
      { _id: 't-1', status: 'approved', name: 'A', story: 'Done', submittedAt: new Date() },
    ]);

    const result = await getPendingTestimonials();
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});

// ── isFlaggedContent ──────────────────────────────────────────────────

describe('isFlaggedContent', () => {
  it('flags text containing spam keywords', () => {
    expect(isFlaggedContent('This is spam content')).toBe(true);
    expect(isFlaggedContent('Visit my casino site')).toBe(true);
  });

  it('flags text containing URLs', () => {
    expect(isFlaggedContent('Check out https://spam.com')).toBe(true);
    expect(isFlaggedContent('Visit http://example.com')).toBe(true);
  });

  it('flags text containing long number sequences', () => {
    expect(isFlaggedContent('Call me at 1234567890')).toBe(true);
  });

  it('does not flag legitimate testimonials', () => {
    expect(isFlaggedContent('We love our new futon! Best purchase ever.')).toBe(false);
    expect(isFlaggedContent('Carolina Futons has great customer service.')).toBe(false);
  });

  it('returns false for empty or null input', () => {
    expect(isFlaggedContent('')).toBe(false);
    expect(isFlaggedContent(null)).toBe(false);
  });
});

// ── Auto-flagging on submit ───────────────────────────────────────────

describe('submitTestimonial auto-flagging', () => {
  it('auto-flags testimonial with spam content', async () => {
    let inserted = null;
    __onInsert((collection, item) => {
      if (collection === 'Testimonials') inserted = item;
    });

    await submitTestimonial({
      name: 'Spammer',
      story: 'Buy cheap viagra from our store now!',
      rating: 5,
    });

    expect(inserted.status).toBe('flagged');
  });

  it('auto-flags testimonial with URL in story', async () => {
    let inserted = null;
    __onInsert((collection, item) => {
      if (collection === 'Testimonials') inserted = item;
    });

    await submitTestimonial({
      name: 'Bob',
      story: 'Great product! Visit https://spam-link.com for deals!',
      rating: 5,
    });

    expect(inserted.status).toBe('flagged');
  });

  it('does not flag legitimate testimonial', async () => {
    let inserted = null;
    __onInsert((collection, item) => {
      if (collection === 'Testimonials') inserted = item;
    });

    await submitTestimonial({
      name: 'Jane Doe',
      story: 'Our family loves the Night and Day futon frame. Excellent quality!',
      rating: 5,
    });

    expect(inserted.status).toBe('pending');
  });
});
