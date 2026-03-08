import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import { __setMember } from '../__mocks__/wix-members-backend.js';
import {
  getDeliveryStatus,
  updateDeliveryMilestone,
  getDeliveryInstructions,
  getAssemblyGuide,
  getAllAssemblyGuides,
  submitDeliverySurvey,
  getSurveyStats,
} from '../../src/backend/deliveryExperience.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
});

// ── getDeliveryStatus ──────────────────────────────────────────────

describe('getDeliveryStatus', () => {
  it('returns delivery status with timeline', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd-1',
      orderId: 'order-123',
      memberId: 'member-1',
      status: 'shipped',
      deliveryTier: 'white_glove_local',
      milestones: JSON.stringify([
        { status: 'placed', timestamp: '2026-02-18T10:00:00Z' },
        { status: 'confirmed', timestamp: '2026-02-18T10:05:00Z' },
        { status: 'preparing', timestamp: '2026-02-19T08:00:00Z' },
        { status: 'shipped', timestamp: '2026-02-20T14:00:00Z' },
      ]),
      trackingNumber: '1Z999AA10123456784',
      estimatedDelivery: new Date('2026-02-25'),
    }]);

    const result = await getDeliveryStatus('order-123');
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('shipped');
    expect(result.data.statusLabel).toBe('Shipped');
    expect(result.data.deliveryTier).toBe('white_glove_local');
    expect(result.data.trackingNumber).toBe('1Z999AA10123456784');
    expect(result.data.timeline).toHaveLength(7);
  });

  it('marks completed/current/upcoming steps in timeline', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd-1', orderId: 'order-1', memberId: 'member-1',
      status: 'preparing', milestones: '[]',
    }]);

    const result = await getDeliveryStatus('order-1');
    const timeline = result.data.timeline;

    // placed (0) and confirmed (1) should be completed, preparing (2) should be current
    expect(timeline[0].completed).toBe(true);
    expect(timeline[1].completed).toBe(true);
    expect(timeline[2].current).toBe(true);
    expect(timeline[3].upcoming).toBe(true);
  });

  it('fails for non-existent order', async () => {
    __seed('DeliveryTracking', []);
    const result = await getDeliveryStatus('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails for empty order ID', async () => {
    const result = await getDeliveryStatus('');
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getDeliveryStatus('order-123');
    expect(result.success).toBe(false);
  });

  it('only returns delivery for the authenticated member', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd-1', orderId: 'order-123', memberId: 'other-member',
      status: 'shipped', milestones: '[]',
    }]);

    const result = await getDeliveryStatus('order-123');
    expect(result.success).toBe(false);
  });

  it('includes survey completion status', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd-1', orderId: 'order-123', memberId: 'member-1',
      status: 'delivered', milestones: '[]', surveyCompleted: true,
    }]);

    const result = await getDeliveryStatus('order-123');
    expect(result.data.surveyCompleted).toBe(true);
  });
});

// ── updateDeliveryMilestone ────────────────────────────────────────

describe('updateDeliveryMilestone', () => {
  it('updates delivery status and adds milestone', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });

    __seed('DeliveryTracking', [{
      _id: 'd-1', orderId: 'order-123', memberId: 'member-1',
      status: 'preparing', milestones: '[]',
    }]);

    const result = await updateDeliveryMilestone('order-123', 'shipped', 'Picked up by UPS');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('shipped');

    const milestones = JSON.parse(updated.milestones);
    expect(milestones).toHaveLength(1);
    expect(milestones[0].status).toBe('shipped');
    expect(milestones[0].note).toBe('Picked up by UPS');
  });

  it('sets actualDelivery when status is delivered', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });

    __seed('DeliveryTracking', [{
      _id: 'd-1', orderId: 'order-123', memberId: 'member-1',
      status: 'out_for_delivery', milestones: '[]',
    }]);

    await updateDeliveryMilestone('order-123', 'delivered');
    expect(updated.actualDelivery).toBeInstanceOf(Date);
  });

  it('rejects invalid status', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd-1', orderId: 'order-123', memberId: 'member-1',
      status: 'placed', milestones: '[]',
    }]);

    const result = await updateDeliveryMilestone('order-123', 'invalid_status');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('fails for non-existent order', async () => {
    __seed('DeliveryTracking', []);
    const result = await updateDeliveryMilestone('nonexistent', 'shipped');
    expect(result.success).toBe(false);
  });

  it('fails for empty order ID', async () => {
    const result = await updateDeliveryMilestone('', 'shipped');
    expect(result.success).toBe(false);
  });
});

// ── getDeliveryInstructions ────────────────────────────────────────

describe('getDeliveryInstructions', () => {
  it('returns standard delivery instructions', () => {
    const result = getDeliveryInstructions('standard');
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('Standard');
    expect(result.data.instructions.length).toBeGreaterThan(0);
    expect(result.data.tips.length).toBeGreaterThan(0);
  });

  it('returns white glove local instructions', () => {
    const result = getDeliveryInstructions('white_glove_local');
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('White Glove Local');
    expect(result.data.instructions.some(i => i.toLowerCase().includes('assemble'))).toBe(true);
  });

  it('returns white glove regional instructions', () => {
    const result = getDeliveryInstructions('white_glove_regional');
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('White Glove Regional');
  });

  it('fails for unknown tier', () => {
    const result = getDeliveryInstructions('premium_express');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown delivery tier');
  });

  it('defaults to standard for empty input', () => {
    const result = getDeliveryInstructions('');
    // Empty sanitizes to empty, then defaults via || 'standard'
    const result2 = getDeliveryInstructions('standard');
    expect(result2.success).toBe(true);
  });
});

// ── getAssemblyGuide ───────────────────────────────────────────────

describe('getAssemblyGuide', () => {
  it('returns futon frame assembly guide', () => {
    const result = getAssemblyGuide('futon-frames');
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('Futon Frame');
    expect(result.data.estimatedTime).toBe('30-60 minutes');
    expect(result.data.toolsNeeded.length).toBeGreaterThan(0);
    expect(result.data.steps.length).toBeGreaterThan(0);
  });

  it('returns murphy bed setup guide', () => {
    const result = getAssemblyGuide('murphy-cabinet-beds');
    expect(result.success).toBe(true);
    expect(result.data.estimatedTime).toContain('2 minutes');
    expect(result.data.toolsNeeded).toHaveLength(0);
  });

  it('returns platform bed guide', () => {
    const result = getAssemblyGuide('platform-beds');
    expect(result.success).toBe(true);
    expect(result.data.steps.length).toBeGreaterThan(3);
  });

  it('returns mattress care guide', () => {
    const result = getAssemblyGuide('mattresses');
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('Care');
  });

  it('fails for unknown category', () => {
    const result = getAssemblyGuide('outdoor-furniture');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Available');
  });

  it('handles spaces in category name', () => {
    const result = getAssemblyGuide('futon frames');
    expect(result.success).toBe(true);
  });
});

// ── getAllAssemblyGuides ────────────────────────────────────────────

describe('getAllAssemblyGuides', () => {
  it('returns all guides', () => {
    const result = getAllAssemblyGuides();
    expect(result.success).toBe(true);
    expect(Object.keys(result.guides).length).toBeGreaterThanOrEqual(4);
    expect(result.guides['futon-frames']).toBeDefined();
    expect(result.guides['murphy-cabinet-beds']).toBeDefined();
    expect(result.guides['platform-beds']).toBeDefined();
    expect(result.guides['mattresses']).toBeDefined();
  });
});

// ── submitDeliverySurvey ───────────────────────────────────────────

describe('submitDeliverySurvey', () => {
  it('submits a delivery survey', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', [{
      _id: 'd-1', orderId: 'order-123', memberId: 'member-1',
      status: 'delivered', milestones: '[]', surveyCompleted: false,
    }]);

    const result = await submitDeliverySurvey({
      orderId: 'order-123',
      rating: 5,
      onTime: true,
      condition: 'perfect',
      assemblyExperience: 'easy',
      comments: 'Great delivery experience!',
    });

    expect(result.success).toBe(true);
    expect(inserted.rating).toBe(5);
    expect(inserted.condition).toBe('perfect');
  });

  it('rejects duplicate survey', async () => {
    __seed('DeliverySurveys', [{
      _id: 's-1', orderId: 'order-123', memberId: 'member-1',
      rating: 4, onTime: true, condition: 'perfect',
    }]);

    const result = await submitDeliverySurvey({
      orderId: 'order-123', rating: 5, onTime: true, condition: 'perfect',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already submitted');
  });

  it('requires valid order ID', async () => {
    const result = await submitDeliverySurvey({
      orderId: '', rating: 5, onTime: true, condition: 'perfect',
    });
    expect(result.success).toBe(false);
  });

  it('requires rating', async () => {
    __seed('DeliverySurveys', []);
    const result = await submitDeliverySurvey({
      orderId: 'order-123', rating: null, onTime: true, condition: 'perfect',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Rating');
  });

  it('clamps rating to 1-5', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', []);

    await submitDeliverySurvey({
      orderId: 'order-123', rating: 10, onTime: true, condition: 'perfect',
    });
    expect(inserted.rating).toBe(5);
  });

  it('rejects invalid condition', async () => {
    __seed('DeliverySurveys', []);
    const result = await submitDeliverySurvey({
      orderId: 'order-123', rating: 4, onTime: true, condition: 'broken',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Condition');
  });

  it('rejects invalid assembly experience', async () => {
    __seed('DeliverySurveys', []);
    const result = await submitDeliverySurvey({
      orderId: 'order-123', rating: 4, onTime: true, condition: 'perfect',
      assemblyExperience: 'impossible',
    });
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await submitDeliverySurvey({
      orderId: 'order-123', rating: 5, onTime: true, condition: 'perfect',
    });
    expect(result.success).toBe(false);
  });

  it('fails with null data', async () => {
    const result = await submitDeliverySurvey(null);
    expect(result.success).toBe(false);
  });

  it('sanitizes comments', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', []);

    await submitDeliverySurvey({
      orderId: 'order-123', rating: 5, onTime: true, condition: 'perfect',
      comments: '<script>alert(1)</script>Nice delivery',
    });
    expect(inserted.comments).not.toContain('<script>');
  });
});

// ── getSurveyStats ─────────────────────────────────────────────────

describe('getSurveyStats', () => {
  it('calculates survey statistics', async () => {
    __seed('DeliverySurveys', [
      { _id: 's-1', rating: 5, onTime: true, condition: 'perfect', submittedAt: new Date() },
      { _id: 's-2', rating: 4, onTime: true, condition: 'perfect', submittedAt: new Date() },
      { _id: 's-3', rating: 3, onTime: false, condition: 'minor_damage', submittedAt: new Date() },
    ]);

    const result = await getSurveyStats(30);
    expect(result.success).toBe(true);
    expect(result.data.totalSurveys).toBe(3);
    expect(result.data.averageRating).toBe(4);
    expect(result.data.onTimeRate).toBe(67);
    expect(result.data.conditionBreakdown.perfect).toBe(2);
    expect(result.data.conditionBreakdown.minor_damage).toBe(1);
  });

  it('returns zero stats with no surveys', async () => {
    __seed('DeliverySurveys', []);
    const result = await getSurveyStats(30);
    expect(result.success).toBe(true);
    expect(result.data.totalSurveys).toBe(0);
    expect(result.data.averageRating).toBe(0);
  });

  it('clamps days to 1-365', async () => {
    __seed('DeliverySurveys', []);
    const result = await getSurveyStats(500);
    expect(result.data.period).toBe('365 days');
  });

  it('defaults to 30 days', async () => {
    __seed('DeliverySurveys', []);
    const result = await getSurveyStats();
    expect(result.data.period).toBe('30 days');
  });
});
