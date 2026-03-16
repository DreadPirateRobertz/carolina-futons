import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
  },
}));

let _collections = {};
let _insertCbs = [];
let _updateCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function __onInsert(cb) { _insertCbs.push(cb); }
function __onUpdate(cb) { _updateCbs.push(cb); }

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ne: (field, val) => { filters[field] = { type: 'ne', value: val }; return chain; },
    le: (field, val) => { filters[field] = { type: 'le', value: val }; return chain; },
    ge: (field, val) => { filters[field] = { type: 'ge', value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[field] !== f.value);
        if (f.type === 'le') items = items.filter(i => i[field] <= f.value);
        if (f.type === 'ge') items = items.filter(i => i[field] >= f.value);
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      for (const cb of _insertCbs) cb(collection, record);
      return record;
    },
    update: async (collection, item) => {
      _collections[collection] = (_collections[collection] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      for (const cb of _updateCbs) cb(collection, item);
      return item;
    },
  },
}));

let _mockMemberId = 'member-abc';
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: async () => (_mockMemberId ? { _id: _mockMemberId } : null),
  },
}));

vi.mock('public/sharedTokens.js', () => ({
  colors: { success: '#00C853', mountainBlue: '#1565C0', espressoLight: '#8D6E63', sunsetCoral: '#FF6F61' },
}));

beforeEach(() => {
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
  _mockMemberId = 'member-abc';
});

// ── Import under test ───────────────────────────────────────────────
const mod = await import('../src/backend/deliveryExperience.web.js');
const {
  getDeliveryStatus,
  updateDeliveryMilestone,
  getDeliveryInstructions,
  getAssemblyGuide,
  getAllAssemblyGuides,
  submitDeliverySurvey,
  getSurveyStats,
} = mod;

// ═════════════════════════════════════════════════════════════════════
// getDeliveryStatus
// ═════════════════════════════════════════════════════════════════════
describe('getDeliveryStatus', () => {
  it('returns delivery status with timeline for valid order', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'order-1', memberId: 'member-abc', status: 'shipped',
      deliveryTier: 'white_glove_local', trackingNumber: 'TRK123',
      estimatedDelivery: new Date('2026-04-01'), actualDelivery: null,
      milestones: JSON.stringify([{ status: 'placed', timestamp: '2026-03-01' }]),
      surveyCompleted: false,
    }]);
    const result = await getDeliveryStatus('order-1');
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('shipped');
    expect(result.data.statusLabel).toBe('Shipped');
    expect(result.data.deliveryTier).toBe('white_glove_local');
    expect(result.data.trackingNumber).toBe('TRK123');
    expect(result.data.timeline).toHaveLength(7);
  });

  it('builds timeline with completed/current/upcoming flags', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'o1', memberId: 'member-abc', status: 'preparing',
      milestones: '[]', deliveryTier: 'standard',
    }]);
    const result = await getDeliveryStatus('o1');
    const timeline = result.data.timeline;
    // preparing is step 2
    expect(timeline[0].completed).toBe(true);  // placed (step 0)
    expect(timeline[1].completed).toBe(true);  // confirmed (step 1)
    expect(timeline[2].current).toBe(true);    // preparing (step 2)
    expect(timeline[3].upcoming).toBe(true);   // shipped (step 3)
  });

  it('returns error for invalid orderId', async () => {
    const result = await getDeliveryStatus('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('order ID');
  });

  it('returns error for null orderId', async () => {
    const result = await getDeliveryStatus(null);
    expect(result.success).toBe(false);
  });

  it('returns not found for wrong order', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'other-order', memberId: 'member-abc', status: 'placed', milestones: '[]',
    }]);
    const result = await getDeliveryStatus('order-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns not found when order belongs to different member', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'order-1', memberId: 'other-member', status: 'placed', milestones: '[]',
    }]);
    const result = await getDeliveryStatus('order-1');
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await getDeliveryStatus('order-1');
    expect(result.success).toBe(false);
  });

  it('defaults deliveryTier to standard when missing', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'o1', memberId: 'member-abc', status: 'placed', milestones: '[]',
    }]);
    const result = await getDeliveryStatus('o1');
    expect(result.data.deliveryTier).toBe('standard');
  });

  it('defaults trackingNumber to empty string when missing', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'o1', memberId: 'member-abc', status: 'placed', milestones: '[]',
    }]);
    const result = await getDeliveryStatus('o1');
    expect(result.data.trackingNumber).toBe('');
  });

  it('handles malformed milestones JSON', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'o1', memberId: 'member-abc', status: 'placed', milestones: 'not-json',
    }]);
    const result = await getDeliveryStatus('o1');
    expect(result.success).toBe(true);
    // parseMilestones returns [] for invalid JSON
    expect(result.data.timeline[0].timestamp).toBeNull();
  });

  it('handles null milestones', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'o1', memberId: 'member-abc', status: 'placed', milestones: null,
    }]);
    const result = await getDeliveryStatus('o1');
    expect(result.success).toBe(true);
  });

  it('falls back to placed status display for unknown status', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'o1', memberId: 'member-abc', status: 'unknown_status', milestones: '[]',
    }]);
    const result = await getDeliveryStatus('o1');
    expect(result.success).toBe(true);
    expect(result.data.statusLabel).toBe('Order Placed');
  });

  it('includes milestone timestamps in timeline when available', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'o1', memberId: 'member-abc', status: 'shipped',
      milestones: JSON.stringify([
        { status: 'placed', timestamp: '2026-03-01T00:00:00Z' },
        { status: 'confirmed', timestamp: '2026-03-02T00:00:00Z' },
      ]),
    }]);
    const result = await getDeliveryStatus('o1');
    expect(result.data.timeline[0].timestamp).toBe('2026-03-01T00:00:00Z');
    expect(result.data.timeline[1].timestamp).toBe('2026-03-02T00:00:00Z');
    expect(result.data.timeline[2].timestamp).toBeNull(); // preparing — no milestone
  });
});

// ═════════════════════════════════════════════════════════════════════
// updateDeliveryMilestone
// ═════════════════════════════════════════════════════════════════════
describe('updateDeliveryMilestone', () => {
  it('updates status and appends milestone', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'order-1', status: 'placed', milestones: '[]',
    }]);
    const result = await updateDeliveryMilestone('order-1', 'shipped', 'Shipped via UPS');
    expect(result.success).toBe(true);
    const updated = _collections.DeliveryTracking.find(d => d._id === 'd1');
    expect(updated.status).toBe('shipped');
    const milestones = JSON.parse(updated.milestones);
    expect(milestones).toHaveLength(1);
    expect(milestones[0].status).toBe('shipped');
    expect(milestones[0].note).toBe('Shipped via UPS');
  });

  it('sets actualDelivery when status is delivered', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'o1', status: 'out_for_delivery', milestones: '[]',
    }]);
    await updateDeliveryMilestone('o1', 'delivered');
    const updated = _collections.DeliveryTracking.find(d => d._id === 'd1');
    expect(updated.actualDelivery).toBeInstanceOf(Date);
  });

  it('does not set actualDelivery for non-delivered status', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'o1', status: 'placed', milestones: '[]',
    }]);
    await updateDeliveryMilestone('o1', 'shipped');
    const updated = _collections.DeliveryTracking.find(d => d._id === 'd1');
    expect(updated.actualDelivery).toBeUndefined();
  });

  it('rejects invalid status', async () => {
    const result = await updateDeliveryMilestone('o1', 'invalid_status');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('rejects empty orderId', async () => {
    const result = await updateDeliveryMilestone('', 'shipped');
    expect(result.success).toBe(false);
  });

  it('returns error when delivery record not found', async () => {
    __seed('DeliveryTracking', []);
    const result = await updateDeliveryMilestone('nonexistent', 'shipped');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('accepts all valid delivery statuses', async () => {
    const statuses = ['placed', 'confirmed', 'preparing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'];
    for (const s of statuses) {
      _collections = {};
      __seed('DeliveryTracking', [{ _id: 'd1', orderId: 'o1', status: 'placed', milestones: '[]' }]);
      const result = await updateDeliveryMilestone('o1', s);
      expect(result.success).toBe(true);
    }
  });

  it('sanitizes note with HTML', async () => {
    __seed('DeliveryTracking', [{ _id: 'd1', orderId: 'o1', status: 'placed', milestones: '[]' }]);
    await updateDeliveryMilestone('o1', 'shipped', '<script>alert(1)</script>Note');
    const updated = _collections.DeliveryTracking.find(d => d._id === 'd1');
    const milestones = JSON.parse(updated.milestones);
    expect(milestones[0].note).not.toContain('<script>');
    expect(milestones[0].note).toContain('Note');
  });

  it('handles empty note', async () => {
    __seed('DeliveryTracking', [{ _id: 'd1', orderId: 'o1', status: 'placed', milestones: '[]' }]);
    await updateDeliveryMilestone('o1', 'confirmed');
    const updated = _collections.DeliveryTracking.find(d => d._id === 'd1');
    const milestones = JSON.parse(updated.milestones);
    expect(milestones[0].note).toBe('');
  });

  it('appends to existing milestones', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', orderId: 'o1', status: 'confirmed',
      milestones: JSON.stringify([{ status: 'placed', timestamp: '2026-03-01' }]),
    }]);
    await updateDeliveryMilestone('o1', 'shipped');
    const updated = _collections.DeliveryTracking.find(d => d._id === 'd1');
    const milestones = JSON.parse(updated.milestones);
    expect(milestones).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getDeliveryInstructions
// ═════════════════════════════════════════════════════════════════════
describe('getDeliveryInstructions', () => {
  it('returns standard delivery instructions', () => {
    const result = getDeliveryInstructions('standard');
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Standard Curbside Delivery');
    expect(result.data.instructions.length).toBeGreaterThan(0);
    expect(result.data.tips.length).toBeGreaterThan(0);
  });

  it('returns white glove local instructions', () => {
    const result = getDeliveryInstructions('white_glove_local');
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('White Glove Local');
  });

  it('returns white glove regional instructions', () => {
    const result = getDeliveryInstructions('white_glove_regional');
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('White Glove Regional');
  });

  it('defaults to standard when no tier specified', () => {
    const result = getDeliveryInstructions(undefined);
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('Standard');
  });

  it('returns error for unknown tier', () => {
    const result = getDeliveryInstructions('express');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown delivery tier');
  });

  it('defaults empty string to standard (falsy || "standard")', () => {
    const result = getDeliveryInstructions('');
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('Standard');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getAssemblyGuide
// ═════════════════════════════════════════════════════════════════════
describe('getAssemblyGuide', () => {
  it('returns futon frame assembly guide', () => {
    const result = getAssemblyGuide('futon-frames');
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('Futon Frame');
    expect(result.data.estimatedTime).toBe('30-60 minutes');
    expect(result.data.steps.length).toBeGreaterThan(0);
  });

  it('returns murphy cabinet bed guide', () => {
    const result = getAssemblyGuide('murphy-cabinet-beds');
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('Murphy');
  });

  it('returns platform beds guide', () => {
    const result = getAssemblyGuide('platform-beds');
    expect(result.success).toBe(true);
  });

  it('returns mattresses guide', () => {
    const result = getAssemblyGuide('mattresses');
    expect(result.success).toBe(true);
  });

  it('normalizes category with spaces to dashes', () => {
    const result = getAssemblyGuide('futon frames');
    expect(result.success).toBe(true);
  });

  it('lowercases category', () => {
    const result = getAssemblyGuide('FUTON-FRAMES');
    expect(result.success).toBe(true);
  });

  it('returns error for unknown category', () => {
    const result = getAssemblyGuide('sofas');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No assembly guide');
  });

  it('handles empty category', () => {
    const result = getAssemblyGuide('');
    expect(result.success).toBe(false);
  });

  it('handles null category', () => {
    const result = getAssemblyGuide(null);
    expect(result.success).toBe(false);
  });

  it('includes category in response data', () => {
    const result = getAssemblyGuide('platform-beds');
    expect(result.data.category).toBe('platform-beds');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getAllAssemblyGuides
// ═════════════════════════════════════════════════════════════════════
describe('getAllAssemblyGuides', () => {
  it('returns all guides', () => {
    const result = getAllAssemblyGuides();
    expect(result.success).toBe(true);
    expect(Object.keys(result.guides)).toEqual(
      expect.arrayContaining(['futon-frames', 'murphy-cabinet-beds', 'platform-beds', 'mattresses'])
    );
  });

  it('returns a copy (not the original object)', () => {
    const result = getAllAssemblyGuides();
    result.guides['new-category'] = {};
    const result2 = getAllAssemblyGuides();
    expect(result2.guides['new-category']).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// submitDeliverySurvey
// ═════════════════════════════════════════════════════════════════════
describe('submitDeliverySurvey', () => {
  it('submits a valid survey', async () => {
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', [{ _id: 'd1', orderId: 'order-1', surveyCompleted: false }]);
    const result = await submitDeliverySurvey({
      orderId: 'order-1', rating: 5, onTime: true, condition: 'perfect',
      assemblyExperience: 'easy', comments: 'Great delivery!',
    });
    expect(result.success).toBe(true);
    expect(_collections.DeliverySurveys).toHaveLength(1);
    expect(_collections.DeliverySurveys[0].rating).toBe(5);
  });

  it('marks delivery as survey completed', async () => {
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', [{ _id: 'd1', orderId: 'order-1', surveyCompleted: false }]);
    await submitDeliverySurvey({
      orderId: 'order-1', rating: 4, onTime: true, condition: 'perfect',
    });
    const delivery = _collections.DeliveryTracking.find(d => d._id === 'd1');
    expect(delivery.surveyCompleted).toBe(true);
  });

  it('rejects null data', async () => {
    const result = await submitDeliverySurvey(null);
    expect(result.success).toBe(false);
  });

  it('rejects non-object data', async () => {
    const result = await submitDeliverySurvey('string');
    expect(result.success).toBe(false);
  });

  it('requires orderId', async () => {
    const result = await submitDeliverySurvey({ rating: 5, condition: 'perfect' });
    expect(result.success).toBe(false);
  });

  it('requires rating', async () => {
    const result = await submitDeliverySurvey({ orderId: 'o1', condition: 'perfect' });
    expect(result.success).toBe(false);
  });

  it('clamps rating to 1-5 range', async () => {
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', []);
    await submitDeliverySurvey({ orderId: 'o1', rating: 10, onTime: true, condition: 'perfect' });
    expect(_collections.DeliverySurveys[0].rating).toBe(5);
  });

  it('rounds fractional rating', async () => {
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', []);
    await submitDeliverySurvey({ orderId: 'o1', rating: 3.7, onTime: true, condition: 'perfect' });
    expect(_collections.DeliverySurveys[0].rating).toBe(4);
  });

  it('rejects rating 0 (below minimum)', async () => {
    const result = await submitDeliverySurvey({ orderId: 'o1', rating: 0, condition: 'perfect' });
    expect(result.success).toBe(false);
  });

  it('NaN rating is rejected (Number(NaN) is NaN, !NaN is true)', async () => {
    const result = await submitDeliverySurvey({ orderId: 'o1', rating: NaN, condition: 'perfect' });
    expect(result.success).toBe(false);
  });

  it('requires valid condition', async () => {
    const result = await submitDeliverySurvey({ orderId: 'o1', rating: 5, condition: 'destroyed' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid conditions', async () => {
    for (const c of ['perfect', 'minor_damage', 'damaged']) {
      _collections = {};
      __seed('DeliverySurveys', []);
      __seed('DeliveryTracking', []);
      const result = await submitDeliverySurvey({ orderId: 'o1', rating: 5, condition: c });
      expect(result.success).toBe(true);
    }
  });

  it('defaults assemblyExperience to na', async () => {
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', []);
    await submitDeliverySurvey({ orderId: 'o1', rating: 5, condition: 'perfect' });
    expect(_collections.DeliverySurveys[0].assemblyExperience).toBe('na');
  });

  it('accepts all valid assembly experiences', async () => {
    for (const a of ['easy', 'moderate', 'difficult', 'na']) {
      _collections = {};
      __seed('DeliverySurveys', []);
      __seed('DeliveryTracking', []);
      const result = await submitDeliverySurvey({ orderId: 'o1', rating: 5, condition: 'perfect', assemblyExperience: a });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid assemblyExperience', async () => {
    const result = await submitDeliverySurvey({
      orderId: 'o1', rating: 5, condition: 'perfect', assemblyExperience: 'impossible',
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate survey for same order', async () => {
    __seed('DeliverySurveys', [
      { orderId: 'o1', memberId: 'member-abc' },
    ]);
    const result = await submitDeliverySurvey({ orderId: 'o1', rating: 5, condition: 'perfect' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already submitted');
  });

  it('coerces onTime to boolean', async () => {
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', []);
    await submitDeliverySurvey({ orderId: 'o1', rating: 5, condition: 'perfect', onTime: 1 });
    expect(_collections.DeliverySurveys[0].onTime).toBe(true);
  });

  it('sanitizes comments to 1000 chars', async () => {
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', []);
    const longComment = 'x'.repeat(2000);
    await submitDeliverySurvey({ orderId: 'o1', rating: 5, condition: 'perfect', comments: longComment });
    expect(_collections.DeliverySurveys[0].comments.length).toBeLessThanOrEqual(1000);
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await submitDeliverySurvey({ orderId: 'o1', rating: 5, condition: 'perfect' });
    expect(result.success).toBe(false);
  });

  it('handles no matching delivery record gracefully', async () => {
    __seed('DeliverySurveys', []);
    __seed('DeliveryTracking', []);
    // No delivery record, but survey should still succeed (just won't mark surveyCompleted)
    const result = await submitDeliverySurvey({ orderId: 'o1', rating: 5, condition: 'perfect' });
    expect(result.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getSurveyStats
// ═════════════════════════════════════════════════════════════════════
describe('getSurveyStats', () => {
  it('returns stats for surveys in the period', async () => {
    const recent = new Date();
    __seed('DeliverySurveys', [
      { rating: 5, onTime: true, condition: 'perfect', submittedAt: recent },
      { rating: 3, onTime: false, condition: 'minor_damage', submittedAt: recent },
    ]);
    const result = await getSurveyStats(30);
    expect(result.success).toBe(true);
    expect(result.data.totalSurveys).toBe(2);
    expect(result.data.averageRating).toBe(4);
    expect(result.data.onTimeRate).toBe(50);
    expect(result.data.conditionBreakdown).toEqual({ perfect: 1, minor_damage: 1 });
  });

  it('returns zeros when no surveys', async () => {
    __seed('DeliverySurveys', []);
    const result = await getSurveyStats();
    expect(result.success).toBe(true);
    expect(result.data.totalSurveys).toBe(0);
    expect(result.data.averageRating).toBe(0);
    expect(result.data.onTimeRate).toBe(0);
  });

  it('defaults daysBack to 30', async () => {
    __seed('DeliverySurveys', []);
    const result = await getSurveyStats();
    expect(result.data.period).toBe('30 days');
  });

  it('daysBack 0 is falsy — defaults to 30 via (Number(0) || 30)', async () => {
    __seed('DeliverySurveys', []);
    const result = await getSurveyStats(0);
    expect(result.data.period).toBe('30 days');
  });

  it('clamps daysBack maximum to 365', async () => {
    __seed('DeliverySurveys', []);
    const result = await getSurveyStats(1000);
    expect(result.data.period).toBe('365 days');
  });

  it('handles NaN daysBack — defaults to 30', async () => {
    __seed('DeliverySurveys', []);
    const result = await getSurveyStats('not-a-number');
    expect(result.data.period).toBe('30 days');
  });

  it('rounds average rating to 1 decimal place', async () => {
    const recent = new Date();
    __seed('DeliverySurveys', [
      { rating: 4, onTime: true, condition: 'perfect', submittedAt: recent },
      { rating: 5, onTime: true, condition: 'perfect', submittedAt: recent },
      { rating: 3, onTime: true, condition: 'perfect', submittedAt: recent },
    ]);
    const result = await getSurveyStats();
    expect(result.data.averageRating).toBe(4);
  });

  it('calculates 100% on-time rate', async () => {
    const recent = new Date();
    __seed('DeliverySurveys', [
      { rating: 5, onTime: true, condition: 'perfect', submittedAt: recent },
      { rating: 4, onTime: true, condition: 'perfect', submittedAt: recent },
    ]);
    const result = await getSurveyStats();
    expect(result.data.onTimeRate).toBe(100);
  });

  it('calculates 0% on-time rate', async () => {
    const recent = new Date();
    __seed('DeliverySurveys', [
      { rating: 3, onTime: false, condition: 'damaged', submittedAt: recent },
    ]);
    const result = await getSurveyStats();
    expect(result.data.onTimeRate).toBe(0);
  });
});
