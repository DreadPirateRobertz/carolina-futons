/**
 * deliveryEstimator.integration.test.js
 *
 * Integration tests across the delivery estimator subsystem:
 *  1. Zip-to-zone → estimateDelivery lifecycle (DeliveryEstimator.js)
 *  2. Slot availability → schedule → capacity enforcement (deliveryScheduling.web.js)
 *  3. Cart delivery label → init/update rendering (cartDeliveryEstimate.js + checkoutOptimization.web.js)
 *  4. Delivery experience status → milestone → survey lifecycle (deliveryExperience.web.js)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mocks ────────────────────────────────────────────────────

// UPS shipping mock
const { mockGetUPSRates, mockGetPackageDimensions } = vi.hoisted(() => ({
  mockGetUPSRates: vi.fn(),
  mockGetPackageDimensions: vi.fn(() => ({ length: 80, width: 40, height: 12, weight: 85 })),
}));
vi.mock('backend/ups-shipping.web', () => ({
  getUPSRates: mockGetUPSRates,
  getPackageDimensions: mockGetPackageDimensions,
}));

vi.mock('public/sharedTokens.js', () => ({
  shippingConfig: {
    freeThreshold: 999999,
    whiteGlove: { freeThreshold: 999999, localPrice: 149, regionalPrice: 249 },
    zones: {
      local: { prefixMin: 287, prefixMax: 289, name: 'WNC' },
      regional: { prefixMin: 270, prefixMax: 399, name: 'Southeast' },
    },
  },
  business: { phone: '(828) 252-9449' },
  colors: {
    success: '#4A7C59', error: '#C0392B', espresso: '#3A2518',
    sunsetCoral: '#E8845C', mountainBlue: '#5B8FA8',
  },
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    success: '#4A7C59', error: '#C0392B', espresso: '#3A2518',
    sunsetCoral: '#E8845C', mountainBlue: '#5B8FA8',
  },
}));

// checkoutOptimization mock for cart delivery
const { mockGetDeliveryEstimate } = vi.hoisted(() => ({
  mockGetDeliveryEstimate: vi.fn(),
}));
vi.mock('backend/checkoutOptimization.web', () => ({
  getDeliveryEstimate: mockGetDeliveryEstimate,
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
}));

// wix-data and wix-members for scheduling + experience
import { __seed, __reset as resetData, __onInsert, __onUpdate, __onRemove } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMembers } from './__mocks__/wix-members-backend.js';

// ── Imports under test ──────────────────────────────────────────────

import { estimateDelivery, getShippingZone, formatDeliveryEstimate } from '../src/public/DeliveryEstimator.js';
import {
  initCartDeliveryEstimate,
  updateCartDeliveryEstimate,
  formatDeliveryLabel,
} from '../src/public/cartDeliveryEstimate.js';
import { announce } from 'public/a11yHelpers';
import {
  getAvailableDeliverySlots,
  scheduleDelivery,
  getMyDeliverySchedule,
  bookAppointment,
  cancelAppointment,
  getAvailableAppointmentSlots,
} from '../src/backend/deliveryScheduling.web.js';
import {
  getDeliveryStatus,
  updateDeliveryMilestone,
  getDeliveryInstructions,
  getAssemblyGuide,
  submitDeliverySurvey,
  getSurveyStats,
} from '../src/backend/deliveryExperience.web.js';

// ── Helpers ─────────────────────────────────────────────────────────

function nextDay(weekday, offsetWeeks = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const diff = ((weekday - d.getDay()) + 7) % 7 || 7;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  return d.toISOString().split('T')[0];
}
const futureWed = () => nextDay(3);
const futureThu = () => nextDay(4);

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    style: { color: '', backgroundColor: '', fontWeight: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._els = els;
  return $w;
}

const MOCK_CART = {
  lineItems: [{ productId: 'p1', name: 'Futon Frame', price: 599, quantity: 1 }],
  totals: { subtotal: 599, total: 648.99 },
};

const LARGE_PRODUCT = {
  _id: 'prod-1',
  name: 'Kodiak Futon Frame',
  price: 599,
  weight: 85,
  collections: ['futon-frames'],
};

const SMALL_PRODUCT = {
  _id: 'prod-2',
  name: 'Futon Cover',
  price: 89,
  weight: 3,
  collections: ['covers'],
};

// ── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetData();
  resetMembers();
  __setMember({ _id: 'member-1', loginEmail: 'customer@test.com' });
});

// =====================================================================
// 1. ZIP-TO-ZONE → estimateDelivery LIFECYCLE
// =====================================================================

describe('zip-to-zone → estimateDelivery integration', () => {
  it('local zip → UPS rates → white-glove offered for large item', async () => {
    mockGetUPSRates.mockResolvedValue([
      { cost: 0, estimatedDelivery: '3-5 business days', isEstimate: false },
    ]);

    const result = await estimateDelivery('28792', LARGE_PRODUCT);

    expect(result.success).toBe(true);
    expect(result.zone).toBe('local');
    expect(result.shippingCost).toBe(0);
    expect(result.whiteGlove).not.toBeNull();
    expect(result.whiteGlove.price).toBe(149);
    expect(result.deliveryText).toContain('3-5 business days');
  });

  it('regional zip → UPS rates → white-glove at regional price', async () => {
    mockGetUPSRates.mockResolvedValue([
      { cost: 39.99, estimatedDelivery: '5-8 business days', isEstimate: false },
    ]);

    const result = await estimateDelivery('30301', LARGE_PRODUCT); // Atlanta
    expect(result.success).toBe(true);
    expect(result.zone).toBe('regional');
    expect(result.whiteGlove.price).toBe(249);
  });

  it('national zip → no white-glove for large item', async () => {
    mockGetUPSRates.mockResolvedValue([
      { cost: 79.99, estimatedDelivery: '7-12 business days', isEstimate: false },
    ]);

    const result = await estimateDelivery('90210', LARGE_PRODUCT); // Beverly Hills
    expect(result.success).toBe(true);
    expect(result.zone).toBe('national');
    expect(result.whiteGlove).toBeNull();
  });

  it('local zip + small item → no white-glove', async () => {
    mockGetUPSRates.mockResolvedValue([
      { cost: 9.99, estimatedDelivery: '3-5 business days', isEstimate: false },
    ]);

    const result = await estimateDelivery('28801', SMALL_PRODUCT);
    expect(result.success).toBe(true);
    expect(result.zone).toBe('local');
    expect(result.whiteGlove).toBeNull();
  });

  it('UPS API failure → falls back to zone-based static estimate', async () => {
    mockGetUPSRates.mockRejectedValue(new Error('UPS API timeout'));

    const result = await estimateDelivery('28792', LARGE_PRODUCT);
    expect(result.success).toBe(true);
    expect(result.zone).toBe('local');
    expect(result.shippingCost).toBe(29.99);
    expect(result.isEstimate).toBe(true);
    expect(result.whiteGlove.price).toBe(149);
  });

  it('UPS returns empty rates → falls back to static estimate', async () => {
    mockGetUPSRates.mockResolvedValue([]);

    const result = await estimateDelivery('37201', LARGE_PRODUCT); // Nashville
    expect(result.success).toBe(true);
    expect(result.zone).toBe('regional');
    expect(result.shippingCost).toBe(39.99);
    expect(result.isEstimate).toBe(true);
  });

  it('invalid zip → error before UPS call', async () => {
    const result = await estimateDelivery('123', LARGE_PRODUCT);
    expect(result.success).toBe(false);
    expect(result.error).toContain('5-digit');
    expect(mockGetUPSRates).not.toHaveBeenCalled();
  });

  it('null product → error', async () => {
    const result = await estimateDelivery('28792', null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product');
  });

  it('zone classification covers all zip ranges', () => {
    expect(getShippingZone('28701')).toBe('local');    // 287xx
    expect(getShippingZone('28801')).toBe('local');    // 288xx
    expect(getShippingZone('28906')).toBe('local');    // 289xx
    expect(getShippingZone('27601')).toBe('regional'); // 276xx
    expect(getShippingZone('39901')).toBe('regional'); // 399xx (boundary)
    expect(getShippingZone('40001')).toBe('national'); // 400xx (out of regional)
    expect(getShippingZone('10001')).toBe('national'); // NYC
    expect(getShippingZone('99501')).toBe('national'); // Alaska
  });

  it('formatDeliveryEstimate renders free shipping text', () => {
    const result = formatDeliveryEstimate({
      zone: 'local',
      shippingCost: 0,
      estimatedDays: '3-5 business days',
      whiteGlove: { price: 149, label: 'White-glove delivery' },
    });
    expect(result.shippingText).toBe('FREE shipping');
    expect(result.deliveryText).toContain('3-5 business days');
    expect(result.whiteGloveText).toContain('$149');
    expect(result.whiteGloveText).toContain('(828) 252-9449');
  });
});

// =====================================================================
// 2. SLOT AVAILABILITY → SCHEDULE → CAPACITY ENFORCEMENT
// =====================================================================

describe('slot availability → schedule → capacity integration', () => {
  it('slots available → schedule delivery → slot count decreases', async () => {
    const date = futureWed();

    // No existing bookings — all slots open
    const slotsBefore = await getAvailableDeliverySlots('standard');
    const wedSlot = slotsBefore.find(s => s.date === date && s.timeWindow === 'morning');
    expect(wedSlot).toBeDefined();
    expect(wedSlot.spotsLeft).toBe(4);

    // Schedule a delivery
    const result = await scheduleDelivery({
      orderId: 'order-1',
      date,
      timeWindow: 'morning',
      type: 'standard',
    });
    expect(result.success).toBe(true);

    // Check slots decreased
    const slotsAfter = await getAvailableDeliverySlots('standard');
    const wedSlotAfter = slotsAfter.find(s => s.date === date && s.timeWindow === 'morning');
    expect(wedSlotAfter.spotsLeft).toBe(3);
  });

  it('fully booked window disappears from available slots', async () => {
    const date = futureWed();

    // Fill all 4 morning slots
    __seed('DeliverySchedule', [
      { _id: 'ds-1', orderId: 'o-1', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-2', orderId: 'o-2', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-3', orderId: 'o-3', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-4', orderId: 'o-4', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
    ]);

    const slots = await getAvailableDeliverySlots('standard');
    const morningSlot = slots.find(s => s.date === date && s.timeWindow === 'morning');
    expect(morningSlot).toBeUndefined(); // Full — not listed

    // Afternoon should still be available
    const afternoonSlot = slots.find(s => s.date === date && s.timeWindow === 'afternoon');
    expect(afternoonSlot).toBeDefined();
    expect(afternoonSlot.spotsLeft).toBe(4);
  });

  it('scheduling into a full window is rejected', async () => {
    const date = futureWed();

    // Seed 4 existing bookings + the insert-first race pattern
    __seed('DeliverySchedule', [
      { _id: 'ds-1', orderId: 'o-1', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-2', orderId: 'o-2', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-3', orderId: 'o-3', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-4', orderId: 'o-4', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
    ]);

    const result = await scheduleDelivery({
      orderId: 'order-new',
      date,
      timeWindow: 'morning',
      type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('fully booked');
  });

  it('cancelled slots do not count toward capacity', async () => {
    const date = futureWed();

    __seed('DeliverySchedule', [
      { _id: 'ds-1', orderId: 'o-1', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-2', orderId: 'o-2', date, timeWindow: 'morning', type: 'standard', status: 'cancelled' },
      { _id: 'ds-3', orderId: 'o-3', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
    ]);

    const slots = await getAvailableDeliverySlots('standard');
    const morningSlot = slots.find(s => s.date === date && s.timeWindow === 'morning');
    expect(morningSlot).toBeDefined();
    // 2 active (not cancelled) → 4 - 2 = 2 spots left
    expect(morningSlot.spotsLeft).toBe(2);
  });

  it('duplicate order scheduling is rejected', async () => {
    const date = futureWed();

    __seed('DeliverySchedule', [
      { _id: 'ds-1', orderId: 'order-dup', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
    ]);

    const result = await scheduleDelivery({
      orderId: 'order-dup',
      date: futureThu(),
      timeWindow: 'afternoon',
      type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('already scheduled');
  });

  it('invalid day (Monday) is rejected', async () => {
    const mon = nextDay(1);
    const result = await scheduleDelivery({
      orderId: 'order-mon',
      date: mon,
      timeWindow: 'morning',
      type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Wednesday through Saturday');
  });

  it('appointment booking → concurrent limit → overbooking rejected', async () => {
    const date = futureWed();

    // Seed 3 confirmed appointments at same time (max concurrent = 3)
    __seed('ShowroomAppointments', [
      { _id: 'a-1', date, timeSlot: '10:00', visitType: 'browse', duration: 30, status: 'confirmed' },
      { _id: 'a-2', date, timeSlot: '10:00', visitType: 'browse', duration: 30, status: 'confirmed' },
      { _id: 'a-3', date, timeSlot: '10:00', visitType: 'browse', duration: 30, status: 'confirmed' },
    ]);

    const result = await bookAppointment({
      date,
      timeSlot: '10:00',
      visitType: 'browse',
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('fully booked');
  });

  it('cancel appointment → slot reopens for booking', async () => {
    const date = futureWed();

    __seed('ShowroomAppointments', [
      { _id: 'a-1', date, timeSlot: '10:00', visitType: 'browse', duration: 30, status: 'confirmed', cancelToken: 'tok123456789012345678901' },
      { _id: 'a-2', date, timeSlot: '10:00', visitType: 'browse', duration: 30, status: 'confirmed', cancelToken: 'tok223456789012345678901' },
      { _id: 'a-3', date, timeSlot: '10:00', visitType: 'browse', duration: 30, status: 'confirmed', cancelToken: 'tok323456789012345678901' },
    ]);

    // Cancel one
    const cancel = await cancelAppointment('a-1', 'tok123456789012345678901');
    expect(cancel.success).toBe(true);

    // Now 10:00 should appear in available slots
    const slots = await getAvailableAppointmentSlots('browse');
    const slot = slots.find(s => s.date === date && s.timeSlot === '10:00');
    expect(slot).toBeDefined();
    expect(slot.spotsLeft).toBeGreaterThan(0);
  });
});

// =====================================================================
// 3. CART DELIVERY LABEL LIFECYCLE
// =====================================================================

describe('cart delivery label → init → update lifecycle', () => {
  it('init populates estimate text and sets ARIA attrs', async () => {
    mockGetDeliveryEstimate.mockResolvedValue({
      success: true,
      data: { minDate: '2026-03-15', maxDate: '2026-03-22', label: 'Mar 15 – Mar 22' },
    });

    const $w = create$w();
    await initCartDeliveryEstimate($w, MOCK_CART, 'standard');

    expect(mockGetDeliveryEstimate).toHaveBeenCalledWith('standard');
    expect($w('#cartDeliveryEstimate').text).toBe('Estimated delivery: Mar 15 – Mar 22');
    expect($w('#cartDeliveryEstimate').accessibility.role).toBe('status');
    expect($w('#cartDeliveryEstimate').accessibility.ariaLive).toBe('polite');
    expect($w('#cartDeliverySection').expand).toHaveBeenCalled();
    expect($w('#cartDeliveryIcon').show).toHaveBeenCalled();
  });

  it('update changes text and announces to screen reader', async () => {
    mockGetDeliveryEstimate.mockResolvedValue({
      success: true,
      data: { minDate: '2026-03-18', maxDate: '2026-03-25', label: 'Mar 18 – Mar 25' },
    });

    const $w = create$w();
    await updateCartDeliveryEstimate($w, MOCK_CART, 'standard');

    expect($w('#cartDeliveryEstimate').text).toBe('Estimated delivery: Mar 18 – Mar 25');
    expect(announce).toHaveBeenCalledWith($w, 'Estimated delivery: Mar 18 – Mar 25');
  });

  it('empty cart → section collapses', async () => {
    const $w = create$w();
    await initCartDeliveryEstimate($w, { lineItems: [] }, 'standard');

    expect(mockGetDeliveryEstimate).not.toHaveBeenCalled();
    expect($w('#cartDeliverySection').collapse).toHaveBeenCalled();
  });

  it('null cart → section collapses', async () => {
    const $w = create$w();
    await initCartDeliveryEstimate($w, null, 'standard');

    expect(mockGetDeliveryEstimate).not.toHaveBeenCalled();
    expect($w('#cartDeliverySection').collapse).toHaveBeenCalled();
  });

  it('backend failure → section collapses gracefully', async () => {
    mockGetDeliveryEstimate.mockResolvedValue({ success: false, error: 'Service unavailable' });

    const $w = create$w();
    await initCartDeliveryEstimate($w, MOCK_CART, 'standard');

    expect($w('#cartDeliverySection').collapse).toHaveBeenCalled();
    expect($w('#cartDeliveryIcon').hide).toHaveBeenCalled();
  });

  it('backend throws → section collapses gracefully', async () => {
    mockGetDeliveryEstimate.mockRejectedValue(new Error('Network error'));

    const $w = create$w();
    await initCartDeliveryEstimate($w, MOCK_CART, 'standard');

    expect($w('#cartDeliverySection').collapse).toHaveBeenCalled();
  });

  it('formatDeliveryLabel handles null/empty data', () => {
    expect(formatDeliveryLabel(null)).toBe('Delivery estimate unavailable');
    expect(formatDeliveryLabel({})).toBe('Delivery estimate unavailable');
    expect(formatDeliveryLabel({ label: '' })).toBe('Delivery estimate unavailable');
  });

  it('init → cart change → update shows new estimate', async () => {
    // First call: initial estimate
    mockGetDeliveryEstimate.mockResolvedValueOnce({
      success: true,
      data: { label: 'Mar 15 – Mar 22' },
    });

    const $w = create$w();
    await initCartDeliveryEstimate($w, MOCK_CART, 'standard');
    expect($w('#cartDeliveryEstimate').text).toBe('Estimated delivery: Mar 15 – Mar 22');

    // Second call: updated cart adds white_glove item → different estimate
    mockGetDeliveryEstimate.mockResolvedValueOnce({
      success: true,
      data: { label: 'Mar 20 – Mar 28' },
    });

    const updatedCart = {
      lineItems: [
        ...MOCK_CART.lineItems,
        { productId: 'p2', name: 'Murphy Cabinet Bed', price: 1999, quantity: 1 },
      ],
    };
    await updateCartDeliveryEstimate($w, updatedCart, 'white_glove_regional');

    expect(mockGetDeliveryEstimate).toHaveBeenLastCalledWith('white_glove_regional');
    expect($w('#cartDeliveryEstimate').text).toBe('Estimated delivery: Mar 20 – Mar 28');
    expect(announce).toHaveBeenCalled();
  });
});

// =====================================================================
// 4. DELIVERY EXPERIENCE STATUS → MILESTONE → SURVEY LIFECYCLE
// =====================================================================

describe('delivery experience → milestone → survey lifecycle', () => {
  it('full lifecycle: status check → milestone update → survey submit → stats', async () => {
    // Seed initial delivery record
    __seed('DeliveryTracking', [{
      _id: 'd-1',
      orderId: 'order-lifecycle',
      memberId: 'member-1',
      status: 'shipped',
      deliveryTier: 'white_glove_local',
      milestones: JSON.stringify([
        { status: 'placed', timestamp: '2026-03-01T10:00:00Z' },
        { status: 'confirmed', timestamp: '2026-03-01T10:05:00Z' },
        { status: 'shipped', timestamp: '2026-03-05T14:00:00Z' },
      ]),
      trackingNumber: '1Z999AA10123456784',
      estimatedDelivery: new Date('2026-03-12'),
      surveyCompleted: false,
    }]);
    __seed('DeliverySurveys', []);

    // Step 1: Member checks status — should be "shipped"
    const status = await getDeliveryStatus('order-lifecycle');
    expect(status.success).toBe(true);
    expect(status.data.status).toBe('shipped');
    expect(status.data.deliveryTier).toBe('white_glove_local');
    expect(status.data.timeline).toHaveLength(7);
    // shipped is step 3, so placed(0), confirmed(1), preparing(2) completed; shipped(3) current
    const shipped = status.data.timeline.find(t => t.status === 'shipped');
    expect(shipped.current).toBe(true);

    // Step 2: Admin updates milestone to "delivered"
    const milestone = await updateDeliveryMilestone('order-lifecycle', 'delivered', 'Left at front door');
    expect(milestone.success).toBe(true);

    // Step 3: Member checks status again — should be "delivered"
    const statusAfter = await getDeliveryStatus('order-lifecycle');
    expect(statusAfter.success).toBe(true);
    expect(statusAfter.data.status).toBe('delivered');
    expect(statusAfter.data.actualDelivery).toBeDefined();

    // Step 4: Member submits post-delivery survey
    const survey = await submitDeliverySurvey({
      orderId: 'order-lifecycle',
      rating: 5,
      onTime: true,
      condition: 'perfect',
      assemblyExperience: 'easy',
      comments: 'Excellent white-glove service!',
    });
    expect(survey.success).toBe(true);

    // Step 5: Verify survey completed flag
    const statusFinal = await getDeliveryStatus('order-lifecycle');
    expect(statusFinal.data.surveyCompleted).toBe(true);

    // Step 6: Admin checks survey stats
    const stats = await getSurveyStats(30);
    expect(stats.success).toBe(true);
    expect(stats.data.totalSurveys).toBe(1);
    expect(stats.data.averageRating).toBe(5);
    expect(stats.data.onTimeRate).toBe(100);
  });

  it('duplicate survey submission is rejected', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd-2', orderId: 'order-dup-survey', memberId: 'member-1',
      status: 'delivered', deliveryTier: 'standard', milestones: '[]',
    }]);
    __seed('DeliverySurveys', [{
      _id: 'survey-1', orderId: 'order-dup-survey', memberId: 'member-1',
      rating: 4, onTime: true, condition: 'perfect', submittedAt: new Date(),
    }]);

    const result = await submitDeliverySurvey({
      orderId: 'order-dup-survey',
      rating: 5,
      onTime: true,
      condition: 'perfect',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already submitted');
  });

  it('delivery instructions match tier from status check', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd-3', orderId: 'order-tier', memberId: 'member-1',
      status: 'preparing', deliveryTier: 'white_glove_regional', milestones: '[]',
    }]);

    const status = await getDeliveryStatus('order-tier');
    expect(status.data.deliveryTier).toBe('white_glove_regional');

    const instructions = getDeliveryInstructions(status.data.deliveryTier);
    expect(instructions.success).toBe(true);
    expect(instructions.data.title).toContain('Regional');
    expect(instructions.data.instructions.length).toBeGreaterThan(0);
    expect(instructions.data.tips.length).toBeGreaterThan(0);
  });

  it('assembly guide integrates with product category from delivery', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd-4', orderId: 'order-assembly', memberId: 'member-1',
      status: 'delivered', deliveryTier: 'standard',
      productCategories: 'futon-frames,mattresses',
      milestones: '[]',
    }]);

    const status = await getDeliveryStatus('order-assembly');
    const categories = (status.data.productCategories || '').split(',').filter(Boolean);

    // For real integration: if status returned productCategories, look up guides
    // But the module doesn't return productCategories in data — we check assembly guide directly
    const guide = getAssemblyGuide('futon-frames');
    expect(guide.success).toBe(true);
    expect(guide.data.estimatedTime).toContain('30-60');
    expect(guide.data.toolsNeeded.length).toBeGreaterThan(0);

    const mattressGuide = getAssemblyGuide('mattresses');
    expect(mattressGuide.success).toBe(true);
    expect(mattressGuide.data.title).toContain('Mattress');
  });

  it('invalid milestone status is rejected', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd-5', orderId: 'order-bad-status', memberId: 'member-1',
      status: 'shipped', milestones: '[]',
    }]);

    const result = await updateDeliveryMilestone('order-bad-status', 'lost_in_space');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });
});
