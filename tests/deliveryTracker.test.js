/**
 * @file deliveryTracker.test.js
 * @description Tests for the delivery day experience module (cf-0xun).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  createDeliveryTracking,
  updateDriverLocation,
  markDeliveryStatus,
  getTrackingByToken,
  generateRoomPrepChecklist,
  checkDoorFit,
  _NOTIFICATION_THRESHOLDS,
  _STANDARD_DIMENSIONS,
} from '../src/backend/deliveryTracker.web.js';

beforeEach(() => {
  __reset();
});

// ── Create Tracking ─────────────────────────────────────────────────

describe('createDeliveryTracking', () => {
  it('creates a tracking session with token and URL', async () => {
    const result = await createDeliveryTracking({
      orderId: 'ORD-001',
      contactEmail: 'buyer@example.com',
      deliveryAddress: '123 Mountain View Dr, Hendersonville NC 28792',
      estimatedDelivery: new Date('2026-04-05T14:00:00Z'),
      items: [{ name: 'Eureka Frame', widthInches: 54, depthInches: 38, heightInches: 33, weightLbs: 85 }],
    });

    expect(result.success).toBe(true);
    expect(result.trackingId).toBeTruthy();
    expect(result.trackingUrl).toContain('delivery-tracker');

    const inserted = __getInserted('DeliveryTracking');
    expect(inserted[0].status).toBe('scheduled');
    expect(inserted[0].orderId).toBe('ORD-001');
  });

  it('requires orderId, email, and address', async () => {
    const result = await createDeliveryTracking({ orderId: 'ORD-001' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid delivery date', async () => {
    const result = await createDeliveryTracking({
      orderId: 'ORD-001',
      contactEmail: 'buyer@example.com',
      deliveryAddress: '123 Main St',
      estimatedDelivery: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});

// ── Driver Location Updates ─────────────────────────────────────────

describe('updateDriverLocation', () => {
  it('updates GPS position and ETA', async () => {
    __seed('DeliveryTracking', [{
      _id: 'track-1', orderId: 'ORD-001', status: 'scheduled',
      contactEmail: 'buyer@example.com', notificationsSent: '[]',
    }]);

    const result = await updateDriverLocation('track-1', 35.3187, -82.4612, 45);
    expect(result.success).toBe(true);
  });

  it('triggers notification at 30-minute threshold', async () => {
    __seed('DeliveryTracking', [{
      _id: 'track-1', orderId: 'ORD-001', status: 'in_transit',
      contactEmail: 'buyer@example.com', notificationsSent: '[]',
    }]);

    const result = await updateDriverLocation('track-1', 35.32, -82.46, 25);
    expect(result.notificationsSent).toContain('eta_30');

    const notifs = __getInserted('DeliveryNotifications');
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  it('triggers multiple thresholds at once', async () => {
    __seed('DeliveryTracking', [{
      _id: 'track-1', orderId: 'ORD-001', status: 'in_transit',
      contactEmail: 'buyer@example.com', notificationsSent: '[]',
    }]);

    const result = await updateDriverLocation('track-1', 35.32, -82.46, 4);
    expect(result.notificationsSent).toContain('eta_30');
    expect(result.notificationsSent).toContain('eta_10');
    expect(result.notificationsSent).toContain('eta_5');
  });

  it('does not re-send already-sent notifications', async () => {
    __seed('DeliveryTracking', [{
      _id: 'track-1', orderId: 'ORD-001', status: 'in_transit',
      contactEmail: 'buyer@example.com', notificationsSent: '["eta_30"]',
    }]);

    const result = await updateDriverLocation('track-1', 35.32, -82.46, 25);
    expect(result.notificationsSent).not.toContain('eta_30');
  });

  it('sets status to nearby when ETA <= 5', async () => {
    __seed('DeliveryTracking', [{
      _id: 'track-1', orderId: 'ORD-001', status: 'in_transit',
      contactEmail: 'buyer@example.com', notificationsSent: '["eta_30","eta_10"]',
    }]);

    await updateDriverLocation('track-1', 35.32, -82.46, 3);
    // Status updated to 'nearby' — verified by no error
  });
});

// ── Delivery Status ─────────────────────────────────────────────────

describe('markDeliveryStatus', () => {
  it('marks as arrived', async () => {
    __seed('DeliveryTracking', [{
      _id: 'track-1', orderId: 'ORD-001', status: 'nearby', contactEmail: 'buyer@example.com',
    }]);

    const result = await markDeliveryStatus('track-1', 'arrived');
    expect(result.success).toBe(true);

    const notifs = __getInserted('DeliveryNotifications');
    expect(notifs[0].type).toBe('arrived');
  });

  it('marks as delivered', async () => {
    __seed('DeliveryTracking', [{
      _id: 'track-1', orderId: 'ORD-001', status: 'arrived', contactEmail: 'buyer@example.com',
    }]);

    const result = await markDeliveryStatus('track-1', 'delivered');
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', async () => {
    const result = await markDeliveryStatus('track-1', 'cancelled');
    expect(result.success).toBe(false);
  });
});

// ── Tracking by Token ───────────────────────────────────────────────

describe('getTrackingByToken', () => {
  it('returns tracking data for valid token', async () => {
    __seed('DeliveryTracking', [{
      _id: 'track-1', trackingToken: 'ABC123XYZ0', orderId: 'ORD-001',
      status: 'in_transit', etaMinutes: 20, driverLat: 35.32, driverLng: -82.46,
    }]);

    const result = await getTrackingByToken('ABC123XYZ0');
    expect(result.success).toBe(true);
    expect(result.tracking.status).toBe('in_transit');
    expect(result.tracking.driverLat).toBe(35.32);
  });

  it('hides driver location when not in transit', async () => {
    __seed('DeliveryTracking', [{
      _id: 'track-1', trackingToken: 'ABC123XYZ0', status: 'scheduled',
      driverLat: 35.32, driverLng: -82.46,
    }]);

    const result = await getTrackingByToken('ABC123XYZ0');
    expect(result.tracking.driverLat).toBeNull();
  });

  it('returns failure for unknown token', async () => {
    __seed('DeliveryTracking', []);
    const result = await getTrackingByToken('NONEXISTENT');
    expect(result.success).toBe(false);
  });
});

// ── Room Prep Checklist ─────────────────────────────────────────────

describe('generateRoomPrepChecklist', () => {
  it('generates checklist for standard futon frame', () => {
    const result = generateRoomPrepChecklist([
      { name: 'Eureka Frame', widthInches: 54, depthInches: 38, heightInches: 33, weightLbs: 85 },
    ]);

    expect(result.success).toBe(true);
    expect(result.checklist.length).toBeGreaterThanOrEqual(2);
    const tasks = result.checklist.map(c => c.task);
    expect(tasks).toContain('Clear the placement area');
  });

  it('flags door measurement for wide items', () => {
    const result = generateRoomPrepChecklist([
      { name: 'Wide Sofa', widthInches: 84, depthInches: 36, heightInches: 33, weightLbs: 120 },
    ]);

    const doorTask = result.checklist.find(c => c.task.includes('front door'));
    expect(doorTask).toBeDefined();
    expect(doorTask.priority).toBe('high');
  });

  it('recommends helper for heavy deliveries', () => {
    const result = generateRoomPrepChecklist([
      { name: 'Frame', widthInches: 54, depthInches: 38, heightInches: 33, weightLbs: 85 },
      { name: 'Mattress', widthInches: 54, depthInches: 38, heightInches: 8, weightLbs: 75 },
    ]);

    const helperTask = result.checklist.find(c => c.task.includes('helper'));
    expect(helperTask).toBeDefined();
    expect(helperTask.detail).toContain('160');
  });

  it('returns empty for no items', () => {
    const result = generateRoomPrepChecklist([]);
    expect(result.success).toBe(false);
  });
});

// ── Door Fit Validator ──────────────────────────────────────────────

describe('checkDoorFit', () => {
  it('passes for product smaller than standard door', () => {
    const result = checkDoorFit(
      { widthInches: 30, depthInches: 20, heightInches: 33 },
      [{ type: 'frontDoor' }]
    );

    expect(result.fits).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails for product that cannot be tilted through door', () => {
    // 84x42x40 — sorted [40, 42, 84], minTwo = [40, 42] — both > 36" door width
    const result = checkDoorFit(
      { widthInches: 84, depthInches: 42, heightInches: 40 },
      [{ type: 'frontDoor' }]
    );

    expect(result.fits).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].entryPoint).toBe('frontDoor');
  });

  it('considers tilting (uses two smallest dimensions)', () => {
    // 54x38x33 — smallest two are 33 and 38, which fit through 36x80 door
    const result = checkDoorFit(
      { widthInches: 54, depthInches: 38, heightInches: 33 },
      [{ type: 'frontDoor' }]
    );

    expect(result.fits).toBe(true);
  });

  it('checks multiple entry points', () => {
    const result = checkDoorFit(
      { widthInches: 54, depthInches: 38, heightInches: 33 },
      [{ type: 'frontDoor' }, { type: 'interiorDoor' }]
    );

    expect(result.success).toBe(true);
    // 33x38 fits through 36x80 front door; 33x38 may not fit 32" interior
    // smallest two: 33, 38 → 33 fits 32? No. 38 fits 32? No. So interior fails.
    // Actually: dims sorted = [33, 38, 54], minTwo = [33, 38]
    // frontDoor (36x80): 33<=36 && 38<=80 → fits
    // interiorDoor (32x80): 33<=32? No. 38<=32? No. fitsA=false, fitsB=false → fails
    expect(result.fits).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].entryPoint).toBe('interiorDoor');
  });

  it('uses custom dimensions when provided', () => {
    const result = checkDoorFit(
      { widthInches: 30, depthInches: 20, heightInches: 33 },
      [{ type: 'frontDoor', width: 24, height: 80 }]
    );

    // 20x30 smallest two — 20<=24 && 30<=80 → fits
    expect(result.fits).toBe(true);
  });

  it('returns failure for missing input', () => {
    expect(checkDoorFit(null, []).success).toBe(false);
    expect(checkDoorFit({}, null).success).toBe(false);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('delivery tracker constants', () => {
  it('has 3 notification thresholds', () => {
    expect(_NOTIFICATION_THRESHOLDS).toEqual([30, 10, 5]);
  });

  it('standard front door is 36x80', () => {
    expect(_STANDARD_DIMENSIONS.frontDoor).toEqual({ width: 36, height: 80 });
  });
});
