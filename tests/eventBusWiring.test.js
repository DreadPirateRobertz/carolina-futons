/**
 * @file eventBusWiring.test.js
 * @description Tests that gamificationEventReceiver fires web→mobile bus events.
 * Verifies points_earned and tier_upgraded dispatch calls.
 * CF-44r
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetFetch, __setHandler } from './__mocks__/wix-fetch.js';

// Import receiveGamificationEvent (wires through eventBusDispatcher)
import { receiveGamificationEvent, _resetActiveChallengesRateLimit, _resetRecordChallengeProgressRateLimit } from '../src/backend/gamificationEventReceiver.web.js';

beforeEach(() => {
  __reset();
  resetSecrets();
  resetFetch();
  vi.clearAllMocks();
  _resetActiveChallengesRateLimit();
  _resetRecordChallengeProgressRateLimit();
});

describe('web→mobile event bus — points_earned dispatch', () => {
  it('dispatches points_earned to mobile endpoint after awarding points', async () => {
    __setSecrets({ MOBILE_BUS_URL: 'https://mobile.example.com/bus', BUS_SECRET: 'sec' });

    let dispatched = null;
    __setHandler((url, opts) => {
      dispatched = { url, body: JSON.parse(opts.body) };
      return { ok: true, status: 200 };
    });

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-wiring-1');

    expect(dispatched).not.toBeNull();
    expect(dispatched.url).toBe('https://mobile.example.com/bus');
    expect(dispatched.body.event).toBe('points_earned');
    expect(dispatched.body.userId).toBe('mem-wiring-1');
    expect(dispatched.body.schemaVersion).toBe('1.0');
    expect(dispatched.body.source).toBe('web');
    expect(typeof dispatched.body.delta).toBe('number');
    expect(dispatched.body.delta).toBeGreaterThan(0);
  });

  it('does not dispatch when zero points are awarded (unknown event)', async () => {
    __setSecrets({ MOBILE_BUS_URL: 'https://mobile.example.com/bus', BUS_SECRET: 'sec' });

    let dispatched = false;
    __setHandler(() => { dispatched = true; return { ok: true, status: 200 }; });

    await receiveGamificationEvent('gamification_unknown_event', {}, 'mem-wiring-2');

    expect(dispatched).toBe(false);
  });

  it('silently skips dispatch when MOBILE_BUS_URL secret is not configured', async () => {
    // No secrets — dispatcher should silently no-op
    let dispatched = false;
    __setHandler(() => { dispatched = true; return { ok: true, status: 200 }; });

    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-wiring-3');
    expect(result.success).toBe(true);
    expect(dispatched).toBe(false);
  });
});

describe('web→mobile event bus — tier_upgraded dispatch', () => {
  it('dispatches tier_upgraded when member crosses tier threshold', async () => {
    // Silver threshold = 500 pts; member at 495, adding 5 add-to-cart = crosses to Silver
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-tier-1',
      totalPoints: 495, tier: 'Bronze',
    }]);
    __setSecrets({ MOBILE_BUS_URL: 'https://mobile.example.com/bus', BUS_SECRET: 'sec' });

    const dispatched = [];
    __setHandler((url, opts) => {
      dispatched.push(JSON.parse(opts.body));
      return { ok: true, status: 200 };
    });

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-tier-1');

    const tierEvent = dispatched.find(d => d.event === 'tier_upgraded');
    expect(tierEvent).toBeTruthy();
    expect(tierEvent.userId).toBe('mem-tier-1');
    expect(tierEvent.schemaVersion).toBe('1.0');
  });
});
