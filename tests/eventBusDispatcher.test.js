/**
 * @file eventBusDispatcher.test.js
 * @description Tests for dispatchBusEvent — web→mobile outbound dispatcher.
 * CF-44r
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetFetch, __setHandler } from './__mocks__/wix-fetch.js';
import { dispatchBusEvent } from '../src/backend/utils/eventBusDispatcher.js';

beforeEach(() => {
  resetSecrets();
  resetFetch();
});

describe('dispatchBusEvent', () => {
  it('POST the event to the mobile endpoint with correct schema fields', async () => {
    __setSecrets({
      MOBILE_BUS_URL: 'https://mobile.example.com/bus',
      BUS_SECRET: 'secret-123',
    });

    let capturedUrl, capturedOptions;
    __setHandler((url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return { ok: true, status: 200 };
    });

    await dispatchBusEvent({
      event: 'points_earned',
      userId: 'mem-1',
      delta: 10,
      newTotal: 110,
    });

    expect(capturedUrl).toBe('https://mobile.example.com/bus');
    expect(capturedOptions.method).toBe('POST');
    expect(capturedOptions.headers['x-bus-secret']).toBe('secret-123');
    const body = JSON.parse(capturedOptions.body);
    expect(body.event).toBe('points_earned');
    expect(body.userId).toBe('mem-1');
    expect(body.delta).toBe(10);
    expect(body.newTotal).toBe(110);
    expect(body.schemaVersion).toBe('1.0');
    expect(body.source).toBe('web');
    expect(typeof body.eventId).toBe('string');
    expect(typeof body.traceId).toBe('string');
    expect(typeof body.ts).toBe('number');
  });

  it('does nothing (no throw) when MOBILE_BUS_URL secret is not configured', async () => {
    // No secrets set — getSecret will throw
    await expect(dispatchBusEvent({ event: 'points_earned', userId: 'mem-1' })).resolves.toBeUndefined();
  });

  it('does not throw when the mobile endpoint returns an error', async () => {
    __setSecrets({
      MOBILE_BUS_URL: 'https://mobile.example.com/bus',
      BUS_SECRET: 'secret-123',
    });
    __setHandler(() => ({ ok: false, status: 503 }));

    await expect(dispatchBusEvent({ event: 'tier_upgraded', userId: 'mem-1' })).resolves.toBeUndefined();
  });

  it('does not throw when fetch itself throws', async () => {
    __setSecrets({
      MOBILE_BUS_URL: 'https://mobile.example.com/bus',
      BUS_SECRET: 'secret-123',
    });
    __setHandler(() => { throw new Error('network error'); });

    await expect(dispatchBusEvent({ event: 'challenge_completed', userId: 'mem-1' })).resolves.toBeUndefined();
  });
});
