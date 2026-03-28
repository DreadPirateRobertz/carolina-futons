/**
 * Tests for liveShowroom.web.js — Live Showroom Camera backend
 * CF-gt99: NOVEL — Live Showroom Camera
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

const mockItems = {
  cameras: [],
  reservations: [],
};

const createMockQuery = (collection) => ({
  eq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  hasSome: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn().mockImplementation(() => {
    if (collection === 'ShowroomCameras') {
      return Promise.resolve({ items: mockItems.cameras });
    }
    return Promise.resolve({ items: mockItems.reservations });
  }),
});

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn((col) => createMockQuery(col)),
    get: vi.fn(),
    insert: vi.fn((col, data) => Promise.resolve({ ...data, _id: 'res-123' })),
    update: vi.fn((col, data) => Promise.resolve(data)),
  },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn().mockResolvedValue({ _id: 'member-456' }),
  },
}));

import {
  getShowroomStatus,
  getLiveDisplayProducts,
  reserveShowroomPiece,
  checkReservation,
  cameraHeartbeat,
} from '../src/backend/liveShowroom.web.js';
import wixData from 'wix-data';

beforeEach(() => {
  vi.clearAllMocks();
  mockItems.cameras = [];
  mockItems.reservations = [];
});

// ── getShowroomStatus ───────────────────────────────────────────────

describe('getShowroomStatus', () => {
  it('returns onDisplay=false when product not on any camera', async () => {
    const result = await getShowroomStatus('prod-123');
    expect(result.onDisplay).toBe(false);
    expect(result.camera).toBeNull();
  });

  it('returns onDisplay=true with camera info when product is displayed', async () => {
    mockItems.cameras = [{
      cameraId: 'cam-1',
      streamUrl: 'https://stream.example.com/cam1.m3u8',
      label: 'Front Display',
      isOnline: true,
      lastHeartbeat: new Date(),
      productIds: ['prod-123'],
    }];

    const result = await getShowroomStatus('prod-123');
    expect(result.onDisplay).toBe(true);
    expect(result.isLive).toBe(true);
    expect(result.camera.label).toBe('Front Display');
    expect(result.camera.streamUrl).toContain('cam1.m3u8');
  });

  it('returns isLive=false when heartbeat is stale', async () => {
    mockItems.cameras = [{
      cameraId: 'cam-1',
      streamUrl: 'https://stream.example.com/cam1.m3u8',
      label: 'Front Display',
      isOnline: true,
      lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
      productIds: ['prod-123'],
    }];

    const result = await getShowroomStatus('prod-123');
    expect(result.onDisplay).toBe(true);
    expect(result.isLive).toBe(false);
    expect(result.camera.streamUrl).toBeNull(); // no stream when not live
  });

  it('returns empty for invalid product ID', async () => {
    const result = await getShowroomStatus('');
    expect(result.onDisplay).toBe(false);
  });
});

// ── reserveShowroomPiece ────────────────────────────────────────────

describe('reserveShowroomPiece', () => {
  beforeEach(() => {
    // Product is on display
    mockItems.cameras = [{
      cameraId: 'cam-1',
      streamUrl: 'https://stream.example.com/cam1.m3u8',
      label: 'Front Display',
      isOnline: true,
      lastHeartbeat: new Date(),
      productIds: ['prod-123'],
    }];
  });

  it('creates a reservation with discount code', async () => {
    const result = await reserveShowroomPiece('prod-123', 'session-abc');

    expect(result.success).toBe(true);
    expect(result.reservation.discountCode).toMatch(/^SHOWROOM-/);
    expect(result.reservation.discountPercent).toBe(5);
    expect(result.reservation.minutesRemaining).toBe(30);
    expect(wixData.insert).toHaveBeenCalled();
  });

  it('rejects when product not on display', async () => {
    mockItems.cameras = []; // no cameras

    const result = await reserveShowroomPiece('prod-999', 'session-abc');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not currently on showroom');
  });

  it('rejects when piece already reserved', async () => {
    mockItems.reservations = [{ status: 'active', expiresAt: new Date(Date.now() + 600000) }];

    const result = await reserveShowroomPiece('prod-123', 'session-abc');

    expect(result.success).toBe(false);
    expect(result.error).toContain('already reserved');
  });

  it('validates required product ID', async () => {
    const result = await reserveShowroomPiece('', 'session-abc');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID required');
  });
});

// ── checkReservation ────────────────────────────────────────────────

describe('checkReservation', () => {
  it('returns active reservation with countdown', async () => {
    wixData.get.mockResolvedValue({
      _id: 'res-123',
      status: 'active',
      expiresAt: new Date(Date.now() + 15 * 60000),
      discountCode: 'SHOWROOM-ABC-XYZ',
    });

    const result = await checkReservation('res-123');

    expect(result.active).toBe(true);
    expect(result.minutesRemaining).toBeGreaterThan(0);
    expect(result.discountCode).toBe('SHOWROOM-ABC-XYZ');
  });

  it('returns inactive for expired reservation', async () => {
    wixData.get.mockResolvedValue({
      _id: 'res-123',
      status: 'active',
      expiresAt: new Date(Date.now() - 1000), // expired
      discountCode: 'SHOWROOM-ABC-XYZ',
    });

    const result = await checkReservation('res-123');

    expect(result.active).toBe(false);
    expect(result.discountCode).toBe('');
  });

  it('returns inactive for non-existent reservation', async () => {
    wixData.get.mockResolvedValue(null);

    const result = await checkReservation('bad-id');

    expect(result.active).toBe(false);
  });
});

// ── getLiveDisplayProducts ───────────────────────────────────────────

describe('getLiveDisplayProducts', () => {
  it('returns product IDs from all live cameras', async () => {
    mockItems.cameras = [
      { cameraId: 'cam-1', label: 'Front', isOnline: true, lastHeartbeat: new Date(), productIds: ['prod-1', 'prod-2'] },
      { cameraId: 'cam-2', label: 'Back', isOnline: true, lastHeartbeat: new Date(), productIds: ['prod-3'] },
    ];

    const result = await getLiveDisplayProducts();

    expect(result.productIds).toHaveLength(3);
    expect(result.cameras).toHaveLength(2);
  });

  it('excludes cameras with stale heartbeat', async () => {
    mockItems.cameras = [
      { cameraId: 'cam-1', label: 'Front', isOnline: true, lastHeartbeat: new Date(Date.now() - 10 * 60000), productIds: ['prod-1'] },
    ];

    const result = await getLiveDisplayProducts();

    expect(result.productIds).toHaveLength(0);
    expect(result.cameras).toHaveLength(0);
  });
});

// ── cameraHeartbeat ─────────────────────────────────────────────────

describe('cameraHeartbeat', () => {
  it('updates camera lastHeartbeat', async () => {
    mockItems.cameras = [{ _id: 'cam-doc-1', cameraId: 'cam-1', isOnline: false }];

    await cameraHeartbeat('cam-1');

    expect(wixData.update).toHaveBeenCalledWith(
      'ShowroomCameras',
      expect.objectContaining({ isOnline: true })
    );
  });
});
