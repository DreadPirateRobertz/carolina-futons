import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert } from './__mocks__/wix-data.js';
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
  { _id: 'u-4', sourceCategory: 'futon-frames', sourceProductId: '', recommendedProductId: 'prod-pillow-1', recommendedProductName: 'Accent Pillows', recommendedCategory: 'accessories', reason: 'Add comfort', discount: 0, delayDays: 7, priority: 3, active: true },
  { _id: 'u-5', sourceCategory: 'mattresses', sourceProductId: '', recommendedProductId: 'prod-frame-2', recommendedProductName: 'Wooden Frame', recommendedCategory: 'futon-frames', reason: 'You need a frame', discount: 5, delayDays: 3, priority: 1, active: false },
];

function seedAll() {
  __seed('ProductCareGuides', careGuides);
  __seed('PostPurchaseUpsells', upsells);
}

// ── getProductGuides ──────────────────────────────────────────────────

describe('getProductGuides', () => {
  beforeEach(seedAll);

  it('returns active guides for a category sorted by priority', async () => {
    const res = await getProductGuides('futon-frames');
    expect(res.success).toBe(true);
    expect(res.guides).toHaveLength(2);
    expect(res.guides[0]._id).toBe('g-1');
    expect(res.guides[1]._id).toBe('g-2');
  });

  it('filters by guideType when provided', async () => {
    const res = await getProductGuides('futon-frames', 'assembly');
    expect(res.success).toBe(true);
    expect(res.guides).toHaveLength(1);
    expect(res.guides[0].guideType).toBe('assembly');
  });

  it('excludes inactive guides', async () => {
    const res = await getProductGuides('futon-frames');
    const ids = res.guides.map(g => g._id);
    expect(ids).not.toContain('g-3');
  });

  it('returns empty guides for unknown category', async () => {
    const res = await getProductGuides('nonexistent');
    expect(res.success).toBe(true);
    expect(res.guides).toEqual([]);
  });

  it('returns error when category is empty string', async () => {
    const res = await getProductGuides('');
    expect(res.success).toBe(false);
    expect(res.error).toContain('category');
    expect(res.guides).toEqual([]);
  });

  it('returns error when category is null', async () => {
    const res = await getProductGuides(null);
    expect(res.success).toBe(false);
    expect(res.guides).toEqual([]);
  });

  it('parses valid JSON steps array', async () => {
    const res = await getProductGuides('futon-frames', 'assembly');
    expect(res.guides[0].steps).toEqual(['Unbox', 'Attach legs', 'Secure bolts']);
  });

  it('returns empty array for null steps', async () => {
    // g-3 is inactive, so seed one with null steps that is active
    __seed('ProductCareGuides', [
      { _id: 'g-null', productCategory: 'test-cat', guideType: 'warranty', title: 'Test', summary: 'S', content: 'C', steps: null, videoUrl: '', imageUrl: '', priority: 1, active: true },
    ]);
    const res = await getProductGuides('test-cat');
    expect(res.guides[0].steps).toEqual([]);
  });

  it('returns empty array for invalid JSON steps', async () => {
    const res = await getProductGuides('mattresses', 'fabric_care');
    expect(res.guides[0].steps).toEqual([]);
  });

  it('returns empty array for empty steps string', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-e', productCategory: 'test-cat', guideType: 'assembly', title: 'T', summary: 'S', content: 'C', steps: '', videoUrl: '', imageUrl: '', priority: 1, active: true },
    ]);
    const res = await getProductGuides('test-cat');
    expect(res.guides[0].steps).toEqual([]);
  });

  it('defaults videoUrl and imageUrl to empty string when missing', async () => {
    const res = await getProductGuides('futon-frames', 'maintenance');
    expect(res.guides[0].videoUrl).toBe('');
    expect(res.guides[0].imageUrl).toBe('');
  });

  it('preserves videoUrl and imageUrl when present', async () => {
    const res = await getProductGuides('futon-frames', 'assembly');
    expect(res.guides[0].videoUrl).toBe('https://example.com/video');
    expect(res.guides[0].imageUrl).toBe('https://example.com/img.jpg');
  });

  it('returns guide objects with all expected fields', async () => {
    const res = await getProductGuides('futon-frames');
    const g = res.guides[0];
    expect(g).toHaveProperty('_id');
    expect(g).toHaveProperty('productCategory');
    expect(g).toHaveProperty('guideType');
    expect(g).toHaveProperty('title');
    expect(g).toHaveProperty('summary');
    expect(g).toHaveProperty('content');
    expect(g).toHaveProperty('steps');
    expect(g).toHaveProperty('videoUrl');
    expect(g).toHaveProperty('imageUrl');
    expect(g).toHaveProperty('priority');
  });

  it('sanitizes HTML in category input', async () => {
    const res = await getProductGuides('<script>alert(1)</script>');
    expect(res.success).toBe(true);
    expect(res.guides).toHaveLength(0);
  });
});

// ── deliverGuidesForOrder ─────────────────────────────────────────────

describe('deliverGuidesForOrder', () => {
  beforeEach(() => {
    seedAll();
    __setMember({ _id: 'member-1' });
  });

  it('returns guides grouped by category', async () => {
    const res = await deliverGuidesForOrder('order-abc123', ['futon-frames', 'mattresses']);
    expect(res.success).toBe(true);
    expect(res.guidesByCategory['futon-frames']).toHaveLength(2);
    expect(res.guidesByCategory['mattresses']).toHaveLength(2);
  });

  it('returns error for invalid order ID', async () => {
    const res = await deliverGuidesForOrder('!!!invalid!!!', ['futon-frames']);
    expect(res.success).toBe(false);
    expect(res.error).toContain('order ID');
    expect(res.guidesByCategory).toEqual({});
  });

  it('returns error for empty order ID', async () => {
    const res = await deliverGuidesForOrder('', ['futon-frames']);
    expect(res.success).toBe(false);
    expect(res.error).toContain('order ID');
  });

  it('returns error for empty categories array', async () => {
    const res = await deliverGuidesForOrder('order-123', []);
    expect(res.success).toBe(false);
    expect(res.error).toContain('categories');
  });

  it('returns error for non-array categories', async () => {
    const res = await deliverGuidesForOrder('order-123', 'futon-frames');
    expect(res.success).toBe(false);
    expect(res.error).toContain('categories');
  });

  it('returns error for null categories', async () => {
    const res = await deliverGuidesForOrder('order-123', null);
    expect(res.success).toBe(false);
  });

  it('returns error when not authenticated', async () => {
    __setMember(null);
    const res = await deliverGuidesForOrder('order-abc123', ['futon-frames']);
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('limits categories to 10', async () => {
    const cats = Array.from({ length: 15 }, (_, i) => `cat-${i}`);
    const res = await deliverGuidesForOrder('order-abc123', cats);
    expect(res.success).toBe(true);
  });

  it('returns error when all categories sanitize to empty', async () => {
    const res = await deliverGuidesForOrder('order-abc123', ['', '', '']);
    expect(res.success).toBe(false);
    expect(res.error).toContain('valid categories');
  });

  it('excludes inactive guides', async () => {
    const res = await deliverGuidesForOrder('order-abc123', ['futon-frames']);
    expect(res.success).toBe(true);
    const allIds = res.guidesByCategory['futon-frames'].map(g => g._id);
    expect(allIds).not.toContain('g-3');
  });

  it('returns guide objects with expected fields', async () => {
    const res = await deliverGuidesForOrder('order-abc123', ['futon-frames']);
    const g = res.guidesByCategory['futon-frames'][0];
    expect(g).toHaveProperty('_id');
    expect(g).toHaveProperty('guideType');
    expect(g).toHaveProperty('title');
    expect(g).toHaveProperty('summary');
    expect(g).toHaveProperty('content');
    expect(g).toHaveProperty('steps');
    expect(g).toHaveProperty('videoUrl');
    expect(g).toHaveProperty('imageUrl');
  });
});

// ── getUpsellRecommendations ──────────────────────────────────────────

describe('getUpsellRecommendations', () => {
  beforeEach(seedAll);

  it('returns category-level recommendations', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, 5);
    expect(res.success).toBe(true);
    expect(res.recommendations.length).toBeGreaterThan(0);
    expect(res.recommendations[0].recommendedProductName).toBe('Premium Cover');
  });

  it('filters by delayDays — day 3 excludes day-5 and day-7 recs', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, 3);
    expect(res.success).toBe(true);
    const ids = res.recommendations.map(r => r._id);
    expect(ids).toContain('u-1');       // delayDays=3
    expect(ids).not.toContain('u-2');   // delayDays=5
    expect(ids).not.toContain('u-4');   // delayDays=7
  });

  it('shows more recs at higher daysSincePurchase', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, 7);
    expect(res.success).toBe(true);
    // At day 7: u-1 (3), u-2 (5), u-3 (3), u-4 (7) all have delayDays <= 7
    expect(res.recommendations.length).toBeGreaterThanOrEqual(3);
  });

  it('prefers product-specific recs when productId has matches', async () => {
    const res = await getUpsellRecommendations('futon-frames', 'frame-deluxe', 5);
    expect(res.success).toBe(true);
    expect(res.recommendations).toHaveLength(1);
    expect(res.recommendations[0].recommendedProductName).toBe('Deluxe Cover');
  });

  it('falls back to category recs when productId has no specific matches', async () => {
    const res = await getUpsellRecommendations('futon-frames', 'no-match-id', 5);
    expect(res.success).toBe(true);
    expect(res.recommendations.length).toBeGreaterThan(0);
    // Should be category-level recs
    expect(res.recommendations[0]._id).toBe('u-1');
  });

  it('excludes inactive upsells', async () => {
    const res = await getUpsellRecommendations('mattresses', null, 10);
    expect(res.success).toBe(true);
    expect(res.recommendations).toEqual([]);
  });

  it('returns error when category is empty', async () => {
    const res = await getUpsellRecommendations('');
    expect(res.success).toBe(false);
    expect(res.error).toContain('category');
    expect(res.recommendations).toEqual([]);
  });

  it('returns error when category is null', async () => {
    const res = await getUpsellRecommendations(null);
    expect(res.success).toBe(false);
    expect(res.recommendations).toEqual([]);
  });

  it('clamps daysSincePurchase to 0-30 range (negative)', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, -5);
    expect(res.success).toBe(true);
    // Clamped to 0; delayDays 3 > 0, so no recs
    expect(res.recommendations).toEqual([]);
  });

  it('clamps daysSincePurchase to 0-30 range (over 30)', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, 999);
    expect(res.success).toBe(true);
    // Clamped to 30 — all recs with delayDays <= 30 show up
  });

  it('defaults daysSincePurchase to 3 for NaN input', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, 'abc');
    expect(res.success).toBe(true);
    const ids = res.recommendations.map(r => r._id);
    expect(ids).toContain('u-1');       // delayDays=3
    expect(ids).not.toContain('u-2');   // delayDays=5
  });

  it('returns formatted recommendation objects', async () => {
    const res = await getUpsellRecommendations('futon-frames', null, 5);
    const rec = res.recommendations[0];
    expect(rec).toHaveProperty('_id');
    expect(rec).toHaveProperty('recommendedProductId');
    expect(rec).toHaveProperty('recommendedProductName');
    expect(rec).toHaveProperty('recommendedCategory');
    expect(rec).toHaveProperty('reason');
    expect(rec).toHaveProperty('discount');
    expect(rec).toHaveProperty('delayDays');
    expect(rec).toHaveProperty('priority');
  });

  it('handles invalid productId gracefully (falls back to category)', async () => {
    const res = await getUpsellRecommendations('futon-frames', '!!!invalid!!!', 5);
    expect(res.success).toBe(true);
    // Invalid ID means validateId returns '', so no product-specific query — falls through to category
    expect(res.recommendations.length).toBeGreaterThan(0);
  });
});

// ── trackGuideEngagement ──────────────────────────────────────────────

describe('trackGuideEngagement', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-1' });
  });

  it('inserts engagement record for valid view action', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    const res = await trackGuideEngagement({
      guideId: 'guide-1',
      orderId: 'order-abc123',
      productCategory: 'futon-frames',
      action: 'view',
      duration: 120,
    });

    expect(res.success).toBe(true);
    expect(inserted.col).toBe('GuideEngagement');
    expect(inserted.item.memberId).toBe('member-1');
    expect(inserted.item.guideId).toBe('guide-1');
    expect(inserted.item.action).toBe('view');
    expect(inserted.item.duration).toBe(120);
    expect(inserted.item.orderId).toBe('order-abc123');
    expect(inserted.item.productCategory).toBe('futon-frames');
    expect(inserted.item.viewedAt).toBeInstanceOf(Date);
  });

  it('accepts all four valid actions', async () => {
    for (const action of ['view', 'complete', 'video_play', 'share']) {
      const res = await trackGuideEngagement({ guideId: 'guide-1', action });
      expect(res.success).toBe(true);
    }
  });

  it('rejects invalid action', async () => {
    const res = await trackGuideEngagement({ guideId: 'guide-1', action: 'delete' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid action');
  });

  it('rejects empty action', async () => {
    const res = await trackGuideEngagement({ guideId: 'guide-1', action: '' });
    expect(res.success).toBe(false);
  });

  it('rejects invalid guide ID', async () => {
    const res = await trackGuideEngagement({ guideId: '!!!', action: 'view' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('guide ID');
  });

  it('rejects empty guide ID', async () => {
    const res = await trackGuideEngagement({ guideId: '', action: 'view' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('guide ID');
  });

  it('rejects undefined guide ID', async () => {
    const res = await trackGuideEngagement({ action: 'view' });
    expect(res.success).toBe(false);
  });

  it('returns error when not authenticated', async () => {
    __setMember(null);
    const res = await trackGuideEngagement({ guideId: 'guide-1', action: 'view' });
    expect(res.success).toBe(false);
  });

  it('clamps duration to max 3600', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await trackGuideEngagement({ guideId: 'guide-1', action: 'view', duration: 9999 });
    expect(inserted.item.duration).toBe(3600);
  });

  it('clamps negative duration to 0', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await trackGuideEngagement({ guideId: 'guide-1', action: 'view', duration: -50 });
    expect(inserted.item.duration).toBe(0);
  });

  it('defaults duration to 0 when not provided', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await trackGuideEngagement({ guideId: 'guide-1', action: 'view' });
    expect(inserted.item.duration).toBe(0);
  });

  it('handles missing optional orderId and productCategory', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await trackGuideEngagement({ guideId: 'guide-1', action: 'view' });
    expect(inserted.item.orderId).toBe('');
    expect(inserted.item.productCategory).toBe('');
  });

  it('validates optional orderId when provided', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await trackGuideEngagement({ guideId: 'guide-1', orderId: '!!!', action: 'view' });
    // validateId('!!!') returns '', so orderId should be empty
    expect(inserted.item.orderId).toBe('');
  });
});

// ── logUpsellConversion ───────────────────────────────────────────────

describe('logUpsellConversion', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-1' });
  });

  it('inserts conversion record with valid data', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    const res = await logUpsellConversion({
      sourceOrderId: 'order-abc123',
      sourceProductId: 'prod-frame-1',
      recommendedProductId: 'prod-cover-1',
      discount: 15,
      revenue: 89.99,
    });

    expect(res.success).toBe(true);
    expect(inserted.col).toBe('UpsellConversions');
    expect(inserted.item.memberId).toBe('member-1');
    expect(inserted.item.sourceOrderId).toBe('order-abc123');
    expect(inserted.item.sourceProductId).toBe('prod-frame-1');
    expect(inserted.item.recommendedProductId).toBe('prod-cover-1');
    expect(inserted.item.discount).toBe(15);
    expect(inserted.item.revenue).toBe(89.99);
    expect(inserted.item.convertedAt).toBeInstanceOf(Date);
  });

  it('rejects invalid source order ID', async () => {
    const res = await logUpsellConversion({
      sourceOrderId: '!!!',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('source order ID');
  });

  it('rejects empty source order ID', async () => {
    const res = await logUpsellConversion({
      sourceOrderId: '',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('source order ID');
  });

  it('rejects empty recommended product ID', async () => {
    const res = await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: '',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('recommended product ID');
  });

  it('rejects invalid recommended product ID', async () => {
    const res = await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: '!!!',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('recommended product ID');
  });

  it('returns error when not authenticated', async () => {
    __setMember(null);
    const res = await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
    });
    expect(res.success).toBe(false);
  });

  it('clamps discount to max 100', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
      discount: 150,
    });
    expect(inserted.item.discount).toBe(100);
  });

  it('clamps negative discount to 0', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
      discount: -10,
    });
    expect(inserted.item.discount).toBe(0);
  });

  it('defaults discount to 0 when missing', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
    });
    expect(inserted.item.discount).toBe(0);
  });

  it('defaults revenue to 0 when missing', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
    });
    expect(inserted.item.revenue).toBe(0);
  });

  it('clamps negative revenue to 0', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
      revenue: -50,
    });
    expect(inserted.item.revenue).toBe(0);
  });

  it('handles invalid sourceProductId gracefully', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: '!!!',
      recommendedProductId: 'prod-2',
    });
    expect(inserted.item.sourceProductId).toBe('');
  });

  it('handles missing sourceProductId', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    const res = await logUpsellConversion({
      sourceOrderId: 'order-123',
      recommendedProductId: 'prod-2',
    });
    expect(res.success).toBe(true);
    expect(inserted.item.sourceProductId).toBe('');
  });
});

// ── getAssemblyFollowUpData ───────────────────────────────────────────

describe('getAssemblyFollowUpData', () => {
  beforeEach(seedAll);

  it('returns assembly guides and support info', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', ['futon-frames']);
    expect(res.success).toBe(true);
    expect(res.guides).toHaveLength(1);
    expect(res.guides[0].title).toBe('Frame Assembly Guide');
    expect(res.supportPhone).toBe('(828) 252-9449');
    expect(res.supportEmail).toBe('support@carolinafutons.com');
  });

  it('only returns assembly-type guides', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', ['futon-frames']);
    expect(res.success).toBe(true);
    // g-2 is maintenance, should not appear
    const ids = res.guides.map(g => g._id);
    expect(ids).toContain('g-1');
    expect(ids).not.toContain('g-2');
  });

  it('returns assembly guides across multiple categories', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', ['futon-frames', 'mattresses']);
    expect(res.success).toBe(true);
    expect(res.guides).toHaveLength(2);
  });

  it('returns empty guides when category has no assembly guides', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', ['covers']);
    expect(res.success).toBe(true);
    expect(res.guides).toEqual([]);
    expect(res.supportPhone).toBe('(828) 252-9449');
    expect(res.supportEmail).toBe('support@carolinafutons.com');
  });

  it('returns error for invalid order ID', async () => {
    const res = await getAssemblyFollowUpData('!!!', ['futon-frames']);
    expect(res.success).toBe(false);
    expect(res.error).toContain('order ID');
    expect(res.guides).toEqual([]);
    expect(res.supportPhone).toBe('');
    expect(res.supportEmail).toBe('');
  });

  it('returns error for empty order ID', async () => {
    const res = await getAssemblyFollowUpData('', ['futon-frames']);
    expect(res.success).toBe(false);
    expect(res.error).toContain('order ID');
  });

  it('returns error for empty categories array', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', []);
    expect(res.success).toBe(false);
    expect(res.error).toContain('categories');
  });

  it('returns error for non-array categories', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', 'futon-frames');
    expect(res.success).toBe(false);
  });

  it('returns error for null categories', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', null);
    expect(res.success).toBe(false);
  });

  it('returns support info with empty guides when all categories sanitize to empty', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', ['', '']);
    expect(res.success).toBe(true);
    expect(res.guides).toEqual([]);
    expect(res.supportPhone).toBeTruthy();
    expect(res.supportEmail).toBeTruthy();
  });

  it('returns guide objects with expected fields', async () => {
    const res = await getAssemblyFollowUpData('order-abc123', ['futon-frames']);
    const g = res.guides[0];
    expect(g).toHaveProperty('_id');
    expect(g).toHaveProperty('productCategory');
    expect(g).toHaveProperty('title');
    expect(g).toHaveProperty('summary');
    expect(g).toHaveProperty('content');
    expect(g).toHaveProperty('steps');
    expect(g).toHaveProperty('videoUrl');
    expect(g).toHaveProperty('imageUrl');
  });
});

// ── getReviewSolicitationData ─────────────────────────────────────────

describe('getReviewSolicitationData', () => {
  it('returns review data with customer name and product URLs', async () => {
    const res = await getReviewSolicitationData('order-abc123', 'Bob', [
      { name: 'Eureka Frame', productId: 'prod-1' },
      { name: 'Moonshadow Mattress', productId: 'prod-2' },
    ]);

    expect(res.success).toBe(true);
    expect(res.customerName).toBe('Bob');
    expect(res.reviewUrl).toContain('order-abc123');
    expect(res.reviewUrl).toContain('#reviews');
    expect(res.products).toHaveLength(2);
    expect(res.products[0].name).toBe('Eureka Frame');
    expect(res.products[0].reviewUrl).toContain('prod-1');
  });

  it('generates per-product review URLs with correct format', async () => {
    const res = await getReviewSolicitationData('order-456', 'Alice', [
      { name: 'Frame', productId: 'prod-frame-001' },
    ]);
    expect(res.products[0].reviewUrl).toBe(
      'https://www.carolinafutons.com/product-page/prod-frame-001#reviews'
    );
  });

  it('falls back to order-level reviewUrl when product has no productId', async () => {
    const res = await getReviewSolicitationData('order-abc123', 'Bob', [
      { name: 'Mystery Product', productId: '' },
    ]);
    expect(res.success).toBe(true);
    expect(res.products[0].reviewUrl).toContain('order-abc123');
  });

  it('returns error for invalid order ID', async () => {
    const res = await getReviewSolicitationData('!!!', 'Bob', []);
    expect(res.success).toBe(false);
    expect(res.error).toContain('order ID');
    expect(res.reviewUrl).toBe('');
    expect(res.customerName).toBe('');
    expect(res.products).toEqual([]);
  });

  it('returns error for empty order ID', async () => {
    const res = await getReviewSolicitationData('', 'Bob', []);
    expect(res.success).toBe(false);
    expect(res.error).toContain('order ID');
  });

  it('handles null customer name', async () => {
    const res = await getReviewSolicitationData('order-abc123', null, []);
    expect(res.success).toBe(true);
    expect(res.customerName).toBe('');
  });

  it('handles empty customer name', async () => {
    const res = await getReviewSolicitationData('order-abc123', '', []);
    expect(res.success).toBe(true);
    expect(res.customerName).toBe('');
  });

  it('handles null products array', async () => {
    const res = await getReviewSolicitationData('order-abc123', 'Bob', null);
    expect(res.success).toBe(true);
    expect(res.products).toEqual([]);
  });

  it('handles empty products array', async () => {
    const res = await getReviewSolicitationData('order-abc123', 'Bob', []);
    expect(res.success).toBe(true);
    expect(res.products).toEqual([]);
  });

  it('caps products to 20 entries', async () => {
    const products = Array.from({ length: 25 }, (_, i) => ({
      name: `Product ${i}`,
      productId: `prod-${i}`,
    }));
    const res = await getReviewSolicitationData('order-abc123', 'Bob', products);
    expect(res.success).toBe(true);
    expect(res.products).toHaveLength(20);
  });

  it('sanitizes customer name', async () => {
    const res = await getReviewSolicitationData('order-abc123', '<script>alert(1)</script>', []);
    expect(res.success).toBe(true);
    expect(res.customerName).not.toContain('<');
  });

  it('sanitizes product names', async () => {
    const res = await getReviewSolicitationData('order-abc123', 'Bob', [
      { name: '<b>Bold</b>', productId: 'prod-1' },
    ]);
    expect(res.success).toBe(true);
    expect(res.products[0].name).not.toContain('<');
  });

  it('builds order-level reviewUrl from order ID', async () => {
    const res = await getReviewSolicitationData('order-abc123', 'Bob', []);
    expect(res.reviewUrl).toBe('https://www.carolinafutons.com/product-page/order-abc123#reviews');
  });
});
