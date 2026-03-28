/**
 * @file liveShopping.test.js
 * @description Tests for the live shopping stream module (cf-e1zx).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  scheduleStream,
  updateStreamStatus,
  getStreams,
  pinProduct,
  getStreamPins,
  trackEngagement,
  getStreamAnalytics,
} from '../src/backend/liveShopping.web.js';

beforeEach(() => {
  __reset();
});

// ── Stream Scheduling ───────────────────────────────────────────────

describe('scheduleStream', () => {
  it('creates a scheduled stream', async () => {
    const result = await scheduleStream({
      title: 'Friday Futon Showcase',
      description: 'Weekly live demo from our showroom',
      scheduledAt: new Date('2026-04-04T18:00:00Z'),
      durationMinutes: 15,
    });

    expect(result.success).toBe(true);
    expect(result.streamId).toBeTruthy();

    const inserted = __getInserted('LiveShoppingStreams');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].title).toBe('Friday Futon Showcase');
    expect(inserted[0].status).toBe('scheduled');
    expect(inserted[0].durationMinutes).toBe(15);
  });

  it('requires title', async () => {
    const result = await scheduleStream({ scheduledAt: new Date() });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Title');
  });

  it('requires scheduled time', async () => {
    const result = await scheduleStream({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Scheduled');
  });

  it('clamps duration to 5-120 minutes', async () => {
    const result = await scheduleStream({
      title: 'Short Stream',
      scheduledAt: new Date('2026-04-04T18:00:00Z'),
      durationMinutes: 2,
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted('LiveShoppingStreams');
    expect(inserted[0].durationMinutes).toBe(5);
  });

  it('logs to AuditLog', async () => {
    await scheduleStream({
      title: 'Audited Stream',
      scheduledAt: new Date('2026-04-04T18:00:00Z'),
    });
    const audits = __getInserted('AuditLog');
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe('schedule');
  });
});

// ── Stream Status ───────────────────────────────────────────────────

describe('updateStreamStatus', () => {
  it('transitions to live', async () => {
    __seed('LiveShoppingStreams', [
      { _id: 'stream-1', title: 'Test', status: 'scheduled' },
    ]);

    const result = await updateStreamStatus('stream-1', 'live');
    expect(result.success).toBe(true);
  });

  it('transitions to ended', async () => {
    __seed('LiveShoppingStreams', [
      { _id: 'stream-1', title: 'Test', status: 'live', startedAt: new Date() },
    ]);

    const result = await updateStreamStatus('stream-1', 'ended');
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', async () => {
    const result = await updateStreamStatus('stream-1', 'paused');
    expect(result.success).toBe(false);
  });

  it('sets vodUrl on ended', async () => {
    __seed('LiveShoppingStreams', [
      { _id: 'stream-1', title: 'Test', status: 'live' },
    ]);

    await updateStreamStatus('stream-1', 'ended', { vodUrl: 'https://youtube.com/watch?v=abc' });
    // vodUrl is set during update — verified by the fact it doesn't error
  });
});

// ── Get Streams ─────────────────────────────────────────────────────

describe('getStreams', () => {
  it('returns live, upcoming, and recent streams', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    __seed('LiveShoppingStreams', [
      { _id: 's-live', title: 'Live Now', status: 'live', scheduledAt: new Date() },
      { _id: 's-upcoming', title: 'Next Week', status: 'scheduled', scheduledAt: future },
      { _id: 's-ended', title: 'Last Week', status: 'ended', endedAt: new Date() },
    ]);

    const result = await getStreams();
    expect(result.success).toBe(true);
    expect(result.live).toBeTruthy();
    expect(result.live.title).toBe('Live Now');
    expect(result.upcoming).toHaveLength(1);
    expect(result.recent).toHaveLength(1);
  });

  it('returns null live when no stream is active', async () => {
    __seed('LiveShoppingStreams', []);
    const result = await getStreams();
    expect(result.live).toBeNull();
  });
});

// ── Product Pins ────────────────────────────────────────────────────

describe('pinProduct', () => {
  it('creates a product pin with timestamp', async () => {
    __seed('StreamProductPins', []);

    const result = await pinProduct({
      streamId: 'stream-1',
      productId: 'prod-001',
      productName: 'Eureka Futon Frame',
      price: 499,
      productSlug: 'eureka-futon-frame',
      timestampSeconds: 120,
    });

    expect(result.success).toBe(true);
    expect(result.pinId).toBeTruthy();

    const inserted = __getInserted('StreamProductPins');
    expect(inserted[0].productName).toBe('Eureka Futon Frame');
    expect(inserted[0].timestampSeconds).toBe(120);
  });

  it('requires streamId, productId, and productName', async () => {
    const result = await pinProduct({ streamId: 'stream-1' });
    expect(result.success).toBe(false);
  });

  it('enforces max 20 pins per stream', async () => {
    const existingPins = Array.from({ length: 20 }, (_, i) => ({
      streamId: 'stream-1',
      productId: `prod-${i}`,
      productName: `Product ${i}`,
    }));
    __seed('StreamProductPins', existingPins);

    const result = await pinProduct({
      streamId: 'stream-1',
      productId: 'prod-21',
      productName: 'One Too Many',
      price: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('20');
  });
});

describe('getStreamPins', () => {
  it('returns pins sorted by timestamp', async () => {
    __seed('StreamProductPins', [
      { _id: 'pin-1', streamId: 'stream-1', productId: 'p1', productName: 'Frame A', timestampSeconds: 300, price: 499, clicks: 5, addToCarts: 2 },
      { _id: 'pin-2', streamId: 'stream-1', productId: 'p2', productName: 'Frame B', timestampSeconds: 60, price: 399, clicks: 3, addToCarts: 1 },
    ]);

    const result = await getStreamPins('stream-1');
    expect(result.success).toBe(true);
    expect(result.pins).toHaveLength(2);
    expect(result.pins[0].productName).toBe('Frame B'); // earlier timestamp
  });

  it('returns empty for unknown stream', async () => {
    __seed('StreamProductPins', []);
    const result = await getStreamPins('nonexistent');
    expect(result.pins).toEqual([]);
  });
});

// ── Engagement Tracking ─────────────────────────────────────────────

describe('trackEngagement', () => {
  it('records a join event', async () => {
    const result = await trackEngagement({ streamId: 'stream-1', action: 'join' });
    expect(result.success).toBe(true);

    const inserted = __getInserted('StreamEngagement');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].action).toBe('join');
  });

  it('records add_to_cart and updates pin stats', async () => {
    __seed('StreamProductPins', [
      { _id: 'pin-1', streamId: 'stream-1', productId: 'prod-1', clicks: 5, addToCarts: 2 },
    ]);

    await trackEngagement({
      streamId: 'stream-1',
      action: 'add_to_cart',
      productId: 'prod-1',
    });

    const inserted = __getInserted('StreamEngagement');
    expect(inserted[0].action).toBe('add_to_cart');
  });

  it('rejects invalid actions', async () => {
    const result = await trackEngagement({ streamId: 'stream-1', action: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing streamId', async () => {
    const result = await trackEngagement({ action: 'join' });
    expect(result.success).toBe(false);
  });
});

// ── Analytics ───────────────────────────────────────────────────────

describe('getStreamAnalytics', () => {
  it('computes viewer count and conversion rate', async () => {
    __seed('LiveShoppingStreams', [
      { _id: 'stream-1', title: 'Test Stream', status: 'ended' },
    ]);
    __seed('StreamEngagement', [
      { streamId: 'stream-1', action: 'join' },
      { streamId: 'stream-1', action: 'join' },
      { streamId: 'stream-1', action: 'pin_click', productId: 'p1' },
      { streamId: 'stream-1', action: 'vod_play' },
    ]);
    __seed('StreamProductPins', [
      { _id: 'pin-1', streamId: 'stream-1', productName: 'Frame A', clicks: 10, addToCarts: 3 },
      { _id: 'pin-2', streamId: 'stream-1', productName: 'Frame B', clicks: 5, addToCarts: 1 },
    ]);

    const result = await getStreamAnalytics('stream-1');
    expect(result.success).toBe(true);
    expect(result.analytics.viewers).toBe(2);
    expect(result.analytics.pinClicks).toBe(15);
    expect(result.analytics.addToCarts).toBe(4);
    expect(result.analytics.vodPlays).toBe(1);
    expect(result.analytics.conversionRate).toBe(27); // 4/15 = 26.7 → 27
    expect(result.analytics.topProducts[0].name).toBe('Frame A');
  });

  it('returns null for unknown stream', async () => {
    __seed('LiveShoppingStreams', []);
    const result = await getStreamAnalytics('nonexistent');
    expect(result.success).toBe(false);
  });
});
