import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from '../__mocks__/wix-data.js';
import { __setMember } from '../__mocks__/wix-members-backend.js';
import {
  getProductGuides,
  deliverGuidesForOrder,
  getUpsellRecommendations,
  trackGuideEngagement,
  logUpsellConversion,
  getAssemblyFollowUpData,
  getReviewSolicitationData,
} from '../../src/backend/postPurchaseCare.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
});

// ── getProductGuides ──────────────────────────────────────────────────

describe('getProductGuides', () => {
  it('returns active guides for a category', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-1', productCategory: 'futon-frames', guideType: 'assembly', title: 'Frame Assembly Guide', summary: 'How to assemble your frame', content: 'Step by step...', steps: '["Step 1","Step 2"]', priority: 1, active: true },
      { _id: 'g-2', productCategory: 'futon-frames', guideType: 'maintenance', title: 'Frame Maintenance', summary: 'Keep your frame looking new', content: 'Maintenance tips...', steps: '[]', priority: 2, active: true },
      { _id: 'g-3', productCategory: 'futon-frames', guideType: 'warranty', title: 'Warranty Info', summary: 'Coverage details', content: 'Warranty terms...', steps: null, priority: 3, active: false },
    ]);

    const result = await getProductGuides('futon-frames');
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(2);
    expect(result.guides[0].title).toBe('Frame Assembly Guide');
    expect(result.guides[0].steps).toEqual(['Step 1', 'Step 2']);
  });

  it('filters by guide type', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-1', productCategory: 'mattresses', guideType: 'cleaning', title: 'Mattress Cleaning', summary: 'Clean your mattress', content: 'Tips...', priority: 1, active: true },
      { _id: 'g-2', productCategory: 'mattresses', guideType: 'warranty', title: 'Mattress Warranty', summary: 'Coverage', content: 'Terms...', priority: 2, active: true },
    ]);

    const result = await getProductGuides('mattresses', 'cleaning');
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(1);
    expect(result.guides[0].guideType).toBe('cleaning');
  });

  it('returns empty for unknown category', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-1', productCategory: 'futon-frames', guideType: 'assembly', title: 'Guide', summary: 'Test', content: 'Content', priority: 1, active: true },
    ]);

    const result = await getProductGuides('nonexistent');
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(0);
  });

  it('requires product category', async () => {
    const result = await getProductGuides('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('category');
  });

  it('sanitizes HTML in category input', async () => {
    __seed('ProductCareGuides', []);
    const result = await getProductGuides('<script>alert(1)</script>');
    // Sanitized to 'alert(1)' — no match, empty result
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(0);
  });

  it('handles invalid steps JSON gracefully', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-1', productCategory: 'covers', guideType: 'fabric_care', title: 'Cover Care', summary: 'Care tips', content: 'Details...', steps: 'not valid json', priority: 1, active: true },
    ]);

    const result = await getProductGuides('covers');
    expect(result.success).toBe(true);
    expect(result.guides[0].steps).toEqual([]);
  });
});

// ── deliverGuidesForOrder ─────────────────────────────────────────────

describe('deliverGuidesForOrder', () => {
  it('returns guides grouped by category for an order', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-1', productCategory: 'futon-frames', guideType: 'assembly', title: 'Frame Assembly', summary: 'Assemble', content: 'Steps...', steps: '["Unbox","Attach legs"]', priority: 1, active: true },
      { _id: 'g-2', productCategory: 'mattresses', guideType: 'maintenance', title: 'Mattress Care', summary: 'Maintain', content: 'Rotate quarterly...', steps: '[]', priority: 1, active: true },
      { _id: 'g-3', productCategory: 'covers', guideType: 'fabric_care', title: 'Cover Washing', summary: 'Wash guide', content: 'Machine wash cold...', steps: '["Remove","Wash","Dry"]', priority: 1, active: true },
    ]);

    const result = await deliverGuidesForOrder('order-123', ['futon-frames', 'mattresses']);
    expect(result.success).toBe(true);
    expect(Object.keys(result.guidesByCategory)).toHaveLength(2);
    expect(result.guidesByCategory['futon-frames']).toHaveLength(1);
    expect(result.guidesByCategory['mattresses']).toHaveLength(1);
  });

  it('requires a valid order ID', async () => {
    const result = await deliverGuidesForOrder('', ['futon-frames']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('order ID');
  });

  it('requires product categories', async () => {
    const result = await deliverGuidesForOrder('order-123', []);
    expect(result.success).toBe(false);
    expect(result.error).toContain('categories');
  });

  it('requires non-null categories array', async () => {
    const result = await deliverGuidesForOrder('order-123', null);
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await deliverGuidesForOrder('order-123', ['futon-frames']);
    expect(result.success).toBe(false);
  });

  it('limits categories to 10', async () => {
    __seed('ProductCareGuides', []);
    const categories = Array.from({ length: 15 }, (_, i) => `cat-${i}`);
    const result = await deliverGuidesForOrder('order-123', categories);
    expect(result.success).toBe(true);
  });
});

// ── getUpsellRecommendations ──────────────────────────────────────────

describe('getUpsellRecommendations', () => {
  it('returns recommendations for a category', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u-1', sourceCategory: 'futon-frames', sourceProductId: '', recommendedProductId: 'prod-cover-1', recommendedProductName: 'Premium Futon Cover', recommendedCategory: 'covers', reason: 'Protect your new frame', discount: 15, delayDays: 3, priority: 1, active: true },
      { _id: 'u-2', sourceCategory: 'futon-frames', sourceProductId: '', recommendedProductId: 'prod-matt-1', recommendedProductName: 'Memory Foam Mattress', recommendedCategory: 'mattresses', reason: 'Upgrade your comfort', discount: 10, delayDays: 5, priority: 2, active: true },
    ]);

    const result = await getUpsellRecommendations('futon-frames', null, 5);
    expect(result.success).toBe(true);
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].recommendedProductName).toBe('Premium Futon Cover');
    expect(result.recommendations[0].discount).toBe(15);
  });

  it('filters by delay days', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u-1', sourceCategory: 'mattresses', sourceProductId: '', recommendedProductId: 'prod-1', recommendedProductName: 'Pillow Set', recommendedCategory: 'accessories', reason: 'Complete your setup', discount: 0, delayDays: 3, priority: 1, active: true },
      { _id: 'u-2', sourceCategory: 'mattresses', sourceProductId: '', recommendedProductId: 'prod-2', recommendedProductName: 'Mattress Protector', recommendedCategory: 'accessories', reason: 'Protect your investment', discount: 20, delayDays: 7, priority: 2, active: true },
    ]);

    const result = await getUpsellRecommendations('mattresses', null, 4);
    expect(result.success).toBe(true);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].recommendedProductName).toBe('Pillow Set');
  });

  it('prefers product-specific recommendations', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u-1', sourceCategory: 'futon-frames', sourceProductId: 'frame-deluxe', recommendedProductId: 'prod-specific', recommendedProductName: 'Deluxe Cover', recommendedCategory: 'covers', reason: 'Perfect match for your frame', discount: 20, delayDays: 3, priority: 1, active: true },
      { _id: 'u-2', sourceCategory: 'futon-frames', sourceProductId: '', recommendedProductId: 'prod-generic', recommendedProductName: 'Generic Cover', recommendedCategory: 'covers', reason: 'Works with any frame', discount: 10, delayDays: 3, priority: 1, active: true },
    ]);

    const result = await getUpsellRecommendations('futon-frames', 'frame-deluxe', 5);
    expect(result.success).toBe(true);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].recommendedProductName).toBe('Deluxe Cover');
  });

  it('falls back to category recs when no product-specific match', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u-1', sourceCategory: 'futon-frames', sourceProductId: '', recommendedProductId: 'prod-generic', recommendedProductName: 'Generic Cover', recommendedCategory: 'covers', reason: 'Works with any frame', discount: 10, delayDays: 3, priority: 1, active: true },
    ]);

    const result = await getUpsellRecommendations('futon-frames', 'no-match-id', 5);
    expect(result.success).toBe(true);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].recommendedProductName).toBe('Generic Cover');
  });

  it('requires product category', async () => {
    const result = await getUpsellRecommendations('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('category');
  });

  it('clamps days to valid range', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u-1', sourceCategory: 'covers', sourceProductId: '', recommendedProductId: 'prod-1', recommendedProductName: 'Spray Cleaner', recommendedCategory: 'accessories', reason: 'Keep it clean', discount: 0, delayDays: 0, priority: 1, active: true },
    ]);

    const result = await getUpsellRecommendations('covers', null, -5);
    expect(result.success).toBe(true);
    // daysSincePurchase clamped to 0, delayDays 0 should still match
    expect(result.recommendations).toHaveLength(1);
  });
});

// ── trackGuideEngagement ──────────────────────────────────────────────

describe('trackGuideEngagement', () => {
  it('records a guide view', async () => {
    const result = await trackGuideEngagement({
      guideId: 'guide-1',
      orderId: 'order-123',
      productCategory: 'futon-frames',
      action: 'view',
      duration: 45,
    });

    expect(result.success).toBe(true);
  });

  it('records a video play event', async () => {
    const result = await trackGuideEngagement({
      guideId: 'guide-2',
      action: 'video_play',
      duration: 120,
    });

    expect(result.success).toBe(true);
  });

  it('records a share event', async () => {
    const result = await trackGuideEngagement({
      guideId: 'guide-3',
      action: 'share',
    });

    expect(result.success).toBe(true);
  });

  it('requires valid guide ID', async () => {
    const result = await trackGuideEngagement({
      guideId: '',
      action: 'view',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('guide ID');
  });

  it('rejects invalid action', async () => {
    const result = await trackGuideEngagement({
      guideId: 'guide-1',
      action: 'invalid_action',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid action');
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await trackGuideEngagement({
      guideId: 'guide-1',
      action: 'view',
    });

    expect(result.success).toBe(false);
  });

  it('clamps duration to valid range', async () => {
    const result = await trackGuideEngagement({
      guideId: 'guide-1',
      action: 'complete',
      duration: 99999,
    });

    expect(result.success).toBe(true);
  });
});

// ── logUpsellConversion ───────────────────────────────────────────────

describe('logUpsellConversion', () => {
  it('records an upsell conversion', async () => {
    const result = await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-frame-1',
      recommendedProductId: 'prod-cover-1',
      discount: 15,
      revenue: 89.99,
    });

    expect(result.success).toBe(true);
  });

  it('requires source order ID', async () => {
    const result = await logUpsellConversion({
      sourceOrderId: '',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('source order ID');
  });

  it('requires recommended product ID', async () => {
    const result = await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('recommended product ID');
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
    });

    expect(result.success).toBe(false);
  });

  it('clamps discount to 0-100', async () => {
    const result = await logUpsellConversion({
      sourceOrderId: 'order-123',
      sourceProductId: 'prod-1',
      recommendedProductId: 'prod-2',
      discount: 150,
      revenue: 50,
    });

    expect(result.success).toBe(true);
  });

  it('handles missing optional fields', async () => {
    const result = await logUpsellConversion({
      sourceOrderId: 'order-123',
      recommendedProductId: 'prod-2',
    });

    expect(result.success).toBe(true);
  });
});

// ── getAssemblyFollowUpData ───────────────────────────────────────────

describe('getAssemblyFollowUpData', () => {
  it('returns assembly guides and support info for an order', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-1', productCategory: 'futon-frames', guideType: 'assembly', title: 'Frame Assembly Guide', summary: 'How to assemble', content: 'Step by step...', steps: '["Unbox","Attach legs","Secure bolts"]', videoUrl: 'https://example.com/video', priority: 1, active: true },
    ]);

    const result = await getAssemblyFollowUpData('order-123', ['futon-frames']);
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(1);
    expect(result.guides[0].title).toBe('Frame Assembly Guide');
    expect(result.guides[0].videoUrl).toBeTruthy();
    expect(result.supportPhone).toBeTruthy();
    expect(result.supportEmail).toBeTruthy();
  });

  it('returns guides across multiple product categories', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-1', productCategory: 'futon-frames', guideType: 'assembly', title: 'Frame Assembly', summary: 'Assemble frame', content: 'Steps...', steps: '[]', priority: 1, active: true },
      { _id: 'g-2', productCategory: 'mattresses', guideType: 'assembly', title: 'Mattress Setup', summary: 'Setup mattress', content: 'Steps...', steps: '[]', priority: 1, active: true },
    ]);

    const result = await getAssemblyFollowUpData('order-456', ['futon-frames', 'mattresses']);
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(2);
  });

  it('returns empty guides when no assembly guides exist for categories', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g-1', productCategory: 'covers', guideType: 'fabric_care', title: 'Cover Care', summary: 'Care', content: 'Tips', steps: '[]', priority: 1, active: true },
    ]);

    const result = await getAssemblyFollowUpData('order-789', ['covers']);
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(0);
    expect(result.supportPhone).toBeTruthy();
  });

  it('requires valid order ID', async () => {
    const result = await getAssemblyFollowUpData('', ['futon-frames']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('order ID');
  });

  it('requires product categories', async () => {
    const result = await getAssemblyFollowUpData('order-123', []);
    expect(result.success).toBe(false);
    expect(result.error).toContain('categories');
  });

  it('handles null categories', async () => {
    const result = await getAssemblyFollowUpData('order-123', null);
    expect(result.success).toBe(false);
  });

  it('sanitizes input', async () => {
    __seed('ProductCareGuides', []);
    const result = await getAssemblyFollowUpData('order-123', ['<script>alert(1)</script>']);
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(0);
  });
});

// ── getReviewSolicitationData ─────────────────────────────────────────

describe('getReviewSolicitationData', () => {
  it('returns review data for an order', async () => {
    const result = await getReviewSolicitationData('order-123', 'Bob', [
      { name: 'Eureka Frame', productId: 'prod-1' },
      { name: 'Moonshadow Mattress', productId: 'prod-2' },
    ]);
    expect(result.success).toBe(true);
    expect(result.reviewUrl).toBeTruthy();
    expect(result.customerName).toBe('Bob');
    expect(result.products).toHaveLength(2);
    expect(result.products[0].name).toBe('Eureka Frame');
    expect(result.products[0].reviewUrl).toBeTruthy();
  });

  it('generates product-specific review URLs', async () => {
    const result = await getReviewSolicitationData('order-456', 'Alice', [
      { name: 'Eureka Frame', productId: 'prod-1' },
    ]);
    expect(result.success).toBe(true);
    expect(result.products[0].reviewUrl).toContain('prod-1');
  });

  it('requires valid order ID', async () => {
    const result = await getReviewSolicitationData('', 'Bob', []);
    expect(result.success).toBe(false);
    expect(result.error).toContain('order ID');
  });

  it('handles empty product list', async () => {
    const result = await getReviewSolicitationData('order-123', 'Bob', []);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('handles null product list', async () => {
    const result = await getReviewSolicitationData('order-123', 'Bob', null);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('sanitizes customer name', async () => {
    const result = await getReviewSolicitationData('order-123', '<script>alert(1)</script>Bob', []);
    expect(result.success).toBe(true);
    expect(result.customerName).not.toContain('<script>');
  });
});
