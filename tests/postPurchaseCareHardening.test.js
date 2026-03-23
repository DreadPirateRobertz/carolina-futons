import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  getProductGuides,
  deliverGuidesForOrder,
  getUpsellRecommendations,
  trackGuideEngagement,
  logUpsellConversion,
  getAssemblyFollowUpData,
  getReviewSolicitationData,
} from '../src/backend/postPurchaseCare.web.js';

// ── Shared seed data ──────────────────────────────────────────────────

const careGuides = [
  { _id: 'g-1', productCategory: 'futon-frames', guideType: 'assembly', title: 'Frame Assembly Guide', summary: 'How to assemble your frame', content: 'Step by step...', steps: '["Unbox","Attach legs","Secure bolts"]', videoUrl: 'https://example.com/video', imageUrl: 'https://example.com/img.jpg', priority: 1, active: true },
  { _id: 'g-2', productCategory: 'futon-frames', guideType: 'maintenance', title: 'Frame Maintenance', summary: 'Keep your frame looking new', content: 'Maintenance tips...', steps: '[]', videoUrl: '', imageUrl: '', priority: 2, active: true },
  { _id: 'g-3', productCategory: 'futon-frames', guideType: 'warranty', title: 'Warranty Info', summary: 'Coverage details', content: 'Warranty terms...', steps: null, videoUrl: '', imageUrl: '', priority: 3, active: false },
  { _id: 'g-4', productCategory: 'mattresses', guideType: 'fabric_care', title: 'Mattress Care', summary: 'Caring for your mattress', content: 'Fabric care tips...', steps: 'not valid json', videoUrl: '', imageUrl: '', priority: 1, active: true },
  { _id: 'g-5', productCategory: 'mattresses', guideType: 'assembly', title: 'Mattress Setup', summary: 'Setting up your mattress', content: 'Setup steps...', steps: '["Remove wrap","Unroll","Wait 24h"]', videoUrl: '', imageUrl: '', priority: 2, active: true },
  { _id: 'g-6', productCategory: 'covers', guideType: 'cleaning', title: 'Cover Cleaning', summary: 'How to clean covers', content: 'Cleaning details...', steps: '["Remove","Machine wash cold","Air dry"]', videoUrl: '', imageUrl: '', priority: 1, active: true },
];

const upsells = [
  { _id: 'u-1', sourceCategory: 'futon-frames', sourceProductId: '', recommendedProductId: 'prod-cover-1', recommendedProductName: 'Premium Cover', recommendedCategory: 'covers', reason: 'Protect your new frame', discount: 15, delayDays: 3, priority: 1, active: true },
  { _id: 'u-2', sourceCategory: 'futon-frames', sourceProductId: '', recommendedProductId: 'prod-matt-1', recommendedProductName: 'Memory Foam Mattress', recommendedCategory: 'mattresses', reason: 'Upgrade your comfort', discount: 10, delayDays: 5, priority: 2, active: true },
  { _id: 'u-3', sourceCategory: 'futon-frames', sourceProductId: 'frame-deluxe', recommendedProductId: 'prod-specific', recommendedProductName: 'Deluxe Cover', recommendedCategory: 'covers', reason: 'Perfect match', discount: 20, delayDays: 3, priority: 1, active: true },
];

function seedAll() {
  __seed('ProductCareGuides', careGuides);
  __seed('PostPurchaseUpsells', upsells);
}

// ── getProductGuides hardening ──────────────────────────────────────

describe('getProductGuides hardening', () => {
  beforeEach(seedAll);

  it('handles undefined category', async () => {
    const res = await getProductGuides(undefined);
    expect(res.success).toBe(false);
    expect(res.guides).toEqual([]);
  });

  it('handles numeric category', async () => {
    const res = await getProductGuides(12345);
    expect(res.success).toBe(false);
    expect(res.guides).toEqual([]);
  });

  it('handles boolean category', async () => {
    const res = await getProductGuides(true);
    expect(res.success).toBe(false);
  });

  it('handles whitespace-only category', async () => {
    const res = await getProductGuides('   ');
    // sanitize trims whitespace → empty → error
    expect(res.success).toBe(false);
  });

  it('handles very long category string', async () => {
    const longStr = 'a'.repeat(500);
    const res = await getProductGuides(longStr);
    // sanitize truncates to 100 chars — no match but no error
    expect(res.success).toBe(true);
    expect(res.guides).toEqual([]);
  });

  it('handles undefined guideType (returns all for category)', async () => {
    const res = await getProductGuides('futon-frames', undefined);
    expect(res.success).toBe(true);
    expect(res.guides).toHaveLength(2); // g-1 and g-2 (g-3 inactive)
  });

  it('handles guideType that matches no guides', async () => {
    const res = await getProductGuides('futon-frames', 'nonexistent');
    expect(res.success).toBe(true);
    expect(res.guides).toEqual([]);
  });

  it('parses steps that are a JSON object (not array) — returns empty', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-obj', productCategory: 'test-cat', guideType: 'assembly', title: 'T', summary: 'S', content: 'C', steps: '{"step": 1}', videoUrl: '', imageUrl: '', priority: 1, active: true },
    ]);
    const res = await getProductGuides('test-cat');
    // parseSteps checks Array.isArray — object returns []
    expect(res.guides[0].steps).toEqual([]);
  });

  it('returns guides for category with special chars in name', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-sc', productCategory: 'murphy-beds', guideType: 'assembly', title: 'Murphy Setup', summary: 'S', content: 'C', steps: null, videoUrl: '', imageUrl: '', priority: 1, active: true },
    ]);
    const res = await getProductGuides('murphy-beds');
    expect(res.success).toBe(true);
    expect(res.guides).toHaveLength(1);
  });
});

// ── deliverGuidesForOrder hardening ─────────────────────────────────

describe('deliverGuidesForOrder hardening', () => {
  beforeEach(() => {
    seedAll();
    __setMember({ _id: 'member-1' });
  });

  it('handles mixed valid and empty categories', async () => {
    const res = await deliverGuidesForOrder('order-abc123', ['', 'futon-frames', '']);
    expect(res.success).toBe(true);
    expect(res.guidesByCategory['futon-frames']).toHaveLength(2);
  });

  it('handles category with no matching guides', async () => {
    const res = await deliverGuidesForOrder('order-abc123', ['nonexistent-category']);
    expect(res.success).toBe(true);
    expect(Object.keys(res.guidesByCategory)).toHaveLength(0);
  });

  it('handles HTML in category names', async () => {
    const res = await deliverGuidesForOrder('order-abc123', ['<script>alert(1)</script>']);
    expect(res.success).toBe(true);
  });

  it('handles categories with XSS in orderId', async () => {
    const res = await deliverGuidesForOrder('<script>alert(1)</script>', ['futon-frames']);
    expect(res.success).toBe(false);
    expect(res.error).toContain('order ID');
  });

  it('returns correct guide structure from order-level delivery', async () => {
    const res = await deliverGuidesForOrder('order-abc123', ['covers']);
    expect(res.success).toBe(true);
    const guide = res.guidesByCategory['covers'][0];
    expect(guide._id).toBe('g-6');
    expect(guide.guideType).toBe('cleaning');
    expect(guide.steps).toEqual(['Remove', 'Machine wash cold', 'Air dry']);
    expect(guide.videoUrl).toBe('');
    expect(guide.imageUrl).toBe('');
  });
});

// ── getUpsellRecommendations hardening ──────────────────────────────

describe('getUpsellRecommendations hardening', () => {
  beforeEach(seedAll);

  it('handles undefined category', async () => {
    const res = await getUpsellRecommendations(undefined);
    expect(res.success).toBe(false);
  });

  it('handles numeric category', async () => {
    const res = await getUpsellRecommendations(42);
    expect(res.success).toBe(false);
  });

  it('handles boolean daysSincePurchase', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, true);
    // true → Number(true) = 1, clamped to 1 → delayDays 3 > 1 → no recs
    expect(res.success).toBe(true);
    expect(res.recommendations).toEqual([]);
  });

  it('handles Infinity daysSincePurchase', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, Infinity);
    // Number.isFinite(Infinity) === false → defaults to 3
    expect(res.success).toBe(true);
  });

  it('handles negative Infinity daysSincePurchase', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, -Infinity);
    expect(res.success).toBe(true);
  });

  it('handles float daysSincePurchase (rounds)', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, 4.7);
    expect(res.success).toBe(true);
    // Math.round(4.7) = 5; delayDays 3 and 5 qualify
    const ids = res.recommendations.map(r => r._id);
    expect(ids).toContain('u-1'); // delayDays=3
    expect(ids).toContain('u-2'); // delayDays=5
  });

  it('handles productId that is a number', async () => {
    const res = await getUpsellRecommendations('futon-frames', 12345, 5);
    // validateId on number → null → no product-specific query → category fallback
    expect(res.success).toBe(true);
    expect(res.recommendations.length).toBeGreaterThan(0);
  });

  it('returns default delayDays 3 when upsell has delayDays null', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u-x', sourceCategory: 'test-cat', sourceProductId: '', recommendedProductId: 'p1', recommendedProductName: 'Test', recommendedCategory: 'test', reason: 'test', active: true, priority: 1, delayDays: null },
    ]);
    const res = await getUpsellRecommendations('test-cat', null, 10);
    // delayDays null → the ?? operator defaults to 3 in formatRecommendation
    expect(res.recommendations[0].delayDays).toBe(3);
  });

  it('preserves zero discount in recommendation', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u-z', sourceCategory: 'test-cat', sourceProductId: '', recommendedProductId: 'p1', recommendedProductName: 'Test', recommendedCategory: 'test', reason: 'test', discount: 0, delayDays: 0, active: true, priority: 1 },
    ]);
    const res = await getUpsellRecommendations('test-cat', null, 5);
    expect(res.recommendations[0].discount).toBe(0);
  });
});

// ── trackGuideEngagement hardening ──────────────────────────────────

describe('trackGuideEngagement hardening', () => {
  beforeEach(() => {
    resetData();
    __setMember({ _id: 'member-1' });
  });

  it('handles NaN duration', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await trackGuideEngagement({ guideId: 'guide-1', action: 'view', duration: NaN });
    expect(inserted.item.duration).toBe(0);
  });

  it('handles Infinity duration', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await trackGuideEngagement({ guideId: 'guide-1', action: 'view', duration: Infinity });
    // Math.round(Infinity) = Infinity, Math.min(3600, Infinity) = 3600
    expect(inserted.item.duration).toBe(3600);
  });

  it('handles string duration', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await trackGuideEngagement({ guideId: 'guide-1', action: 'view', duration: '120' });
    expect(inserted.item.duration).toBe(120);
  });

  it('handles float duration (rounds)', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await trackGuideEngagement({ guideId: 'guide-1', action: 'view', duration: 45.7 });
    expect(inserted.item.duration).toBe(46);
  });

  it('sanitizes productCategory with HTML', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await trackGuideEngagement({
      guideId: 'guide-1',
      action: 'view',
      productCategory: '<b>futon-frames</b>',
    });
    expect(inserted.item.productCategory).not.toContain('<');
  });

  it('handles data object with extra fields (ignored)', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    const res = await trackGuideEngagement({
      guideId: 'guide-1',
      action: 'view',
      extraField: 'should be ignored',
    });
    expect(res.success).toBe(true);
    expect(inserted.item).not.toHaveProperty('extraField');
  });

  it('handles action with XSS attempt', async () => {
    const res = await trackGuideEngagement({
      guideId: 'guide-1',
      action: '<script>alert(1)</script>',
    });
    // sanitize strips tags → empty or non-matching action → error
    expect(res.success).toBe(false);
  });
});

// ── logUpsellConversion hardening ───────────────────────────────────

describe('logUpsellConversion hardening', () => {
  beforeEach(() => {
    resetData();
    __setMember({ _id: 'member-1' });
  });

  it('handles NaN discount', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
      discount: NaN,
    });
    expect(inserted.item.discount).toBe(0);
  });

  it('handles NaN revenue', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
      revenue: NaN,
    });
    expect(inserted.item.revenue).toBe(0);
  });

  it('handles string discount (coerced)', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
      discount: '25',
    });
    expect(inserted.item.discount).toBe(25);
  });

  it('handles string revenue (coerced)', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
      revenue: '199.99',
    });
    expect(inserted.item.revenue).toBe(199.99);
  });

  it('handles very large revenue (no upper clamp)', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
      revenue: 999999,
    });
    expect(inserted.item.revenue).toBe(999999);
  });

  it('stores convertedAt as Date', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
    });
    expect(inserted.item.convertedAt).toBeInstanceOf(Date);
  });

  it('handles data with undefined sourceProductId', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    const res = await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: undefined,
      recommendedProductId: 'prod-2',
    });
    expect(res.success).toBe(true);
    expect(inserted.item.sourceProductId).toBe('');
  });
});

// ── getAssemblyFollowUpData hardening ───────────────────────────────

describe('getAssemblyFollowUpData hardening', () => {
  beforeEach(seedAll);

  it('handles undefined orderId', async () => {
    const res = await getAssemblyFollowUpData(undefined, ['futon-frames']);
    expect(res.success).toBe(false);
  });

  it('handles numeric orderId', async () => {
    const res = await getAssemblyFollowUpData(12345, ['futon-frames']);
    expect(res.success).toBe(false);
  });

  it('handles categories with only whitespace entries', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', ['   ', '  ']);
    // sanitize trims whitespace → empty → filtered out → empty categories
    // But the code returns success:true with empty guides + support info
    expect(res.success).toBe(true);
    expect(res.guides).toEqual([]);
    expect(res.supportPhone).toBeTruthy();
  });

  it('limits categories to 10', async () => {
    const cats = Array.from({ length: 15 }, (_, i) => `cat-${i}`);
    const res = await getAssemblyFollowUpData('order-abc123', cats);
    expect(res.success).toBe(true);
  });

  it('returns only active assembly guides', async () => {
    // g-3 is inactive warranty guide for futon-frames — should not appear
    const res = await getAssemblyFollowUpData('order-abc123', ['futon-frames']);
    expect(res.success).toBe(true);
    const ids = res.guides.map(g => g._id);
    expect(ids).toContain('g-1');     // assembly, active
    expect(ids).not.toContain('g-2'); // maintenance (wrong type)
    expect(ids).not.toContain('g-3'); // warranty + inactive
  });

  it('returns assembly guides with parsed steps', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', ['futon-frames']);
    expect(res.guides[0].steps).toEqual(['Unbox', 'Attach legs', 'Secure bolts']);
  });
});

// ── getReviewSolicitationData hardening ─────────────────────────────

describe('getReviewSolicitationData hardening', () => {
  it('handles undefined orderId', async () => {
    const res = await getReviewSolicitationData(undefined, 'Bob', []);
    expect(res.success).toBe(false);
  });

  it('handles numeric orderId', async () => {
    const res = await getReviewSolicitationData(12345, 'Bob', []);
    expect(res.success).toBe(false);
  });

  it('handles very long customer name (truncated to 200)', async () => {
    const longName = 'A'.repeat(500);
    const res = await getReviewSolicitationData('order-abc123', longName, []);
    expect(res.success).toBe(true);
    // sanitize truncates to 200
    expect(res.customerName.length).toBeLessThanOrEqual(200);
  });

  it('handles products with missing name and productId', async () => {
    const res = await getReviewSolicitationData('order-abc123', 'Bob', [
      { name: undefined, productId: undefined },
    ]);
    expect(res.success).toBe(true);
    expect(res.products[0].name).toBe('');
  });

  it('handles product with XSS in productId', async () => {
    const res = await getReviewSolicitationData('order-abc123', 'Bob', [
      { name: 'Test', productId: '<script>alert(1)</script>' },
    ]);
    expect(res.success).toBe(true);
    expect(res.products[0].reviewUrl).not.toContain('<script>');
  });

  it('builds correct SITE_URL in review URLs', async () => {
    const res = await getReviewSolicitationData('order-abc123', 'Bob', [
      { name: 'Frame', productId: 'prod-1' },
    ]);
    expect(res.reviewUrl).toMatch(/^https:\/\/www\.carolinafutons\.com\//);
    expect(res.products[0].reviewUrl).toMatch(/^https:\/\/www\.carolinafutons\.com\//);
  });
});
