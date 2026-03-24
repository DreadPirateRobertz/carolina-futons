import { describe, it, expect, vi } from 'vitest';
import {
  KNOWN_DISCOVERY_IDS,
  validateDiscoveryEvent,
  handleIllustrationReply,
} from '../src/public/illustrationDiscovery.js';

// ── KNOWN_DISCOVERY_IDS ────────────────────────────────────────────────────────

describe('KNOWN_DISCOVERY_IDS', () => {
  it('is a Set', () => {
    expect(KNOWN_DISCOVERY_IDS).toBeInstanceOf(Set);
  });

  it('contains at least one entry', () => {
    expect(KNOWN_DISCOVERY_IDS.size).toBeGreaterThan(0);
  });

  it('all entries are non-empty strings', () => {
    for (const id of KNOWN_DISCOVERY_IDS) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('contains constellation-orion', () => {
    expect(KNOWN_DISCOVERY_IDS.has('constellation-orion')).toBe(true);
  });
});

// ── validateDiscoveryEvent ─────────────────────────────────────────────────────

describe('validateDiscoveryEvent', () => {
  it('returns discoveryId for a valid event', () => {
    const event = { data: { type: 'discovery', discoveryId: 'constellation-orion' } };
    expect(validateDiscoveryEvent(event)).toBe('constellation-orion');
  });

  it('accepts event without .data wrapper (flat format)', () => {
    const event = { type: 'discovery', discoveryId: 'mountain-firefly' };
    expect(validateDiscoveryEvent(event)).toBe('mountain-firefly');
  });

  it('returns null for unknown discoveryId (silent no-op)', () => {
    const event = { data: { type: 'discovery', discoveryId: 'unknown-thing' } };
    expect(validateDiscoveryEvent(event)).toBeNull();
  });

  it('returns null for XSS attempt in discoveryId', () => {
    const event = { data: { type: 'discovery', discoveryId: '<script>alert(1)</script>' } };
    expect(validateDiscoveryEvent(event)).toBeNull();
  });

  it('returns null for wrong type field', () => {
    const event = { data: { type: 'sky-update', discoveryId: 'constellation-orion' } };
    expect(validateDiscoveryEvent(event)).toBeNull();
  });

  it('returns null when discoveryId is missing', () => {
    const event = { data: { type: 'discovery' } };
    expect(validateDiscoveryEvent(event)).toBeNull();
  });

  it('returns null when discoveryId is not a string', () => {
    const event = { data: { type: 'discovery', discoveryId: 42 } };
    expect(validateDiscoveryEvent(event)).toBeNull();
  });

  it('returns null for null event', () => {
    expect(validateDiscoveryEvent(null)).toBeNull();
  });

  it('returns null for undefined event', () => {
    expect(validateDiscoveryEvent(undefined)).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(validateDiscoveryEvent({})).toBeNull();
  });

  it('rejects all KNOWN_DISCOVERY_IDs only accepts exactly matching strings', () => {
    // Partial match should not pass
    expect(validateDiscoveryEvent({ data: { type: 'discovery', discoveryId: 'constellation' } })).toBeNull();
    expect(validateDiscoveryEvent({ data: { type: 'discovery', discoveryId: 'constellation-orion ' } })).toBeNull(); // trailing space
  });
});

// ── handleIllustrationReply ────────────────────────────────────────────────────

describe('handleIllustrationReply', () => {
  function makeReceiveEvent(result = { success: true }) {
    return vi.fn(async () => result);
  }

  it('routes valid discovery to receiveEvent with discovery_ prefix', async () => {
    const receiveEvent = makeReceiveEvent({ success: true, newTotal: 50 });
    const event = { data: { type: 'discovery', discoveryId: 'constellation-orion' } };
    const result = await handleIllustrationReply(event, 'mem-1', { receiveEvent });
    expect(result.handled).toBe(true);
    expect(receiveEvent).toHaveBeenCalledWith('discovery_constellation-orion', {}, 'mem-1');
  });

  it('returns handled=false for unknown discoveryId — no receiveEvent call', async () => {
    const receiveEvent = makeReceiveEvent();
    const event = { data: { type: 'discovery', discoveryId: 'not-real' } };
    const result = await handleIllustrationReply(event, 'mem-1', { receiveEvent });
    expect(result.handled).toBe(false);
    expect(receiveEvent).not.toHaveBeenCalled();
  });

  it('returns handled=false for null event — no receiveEvent call', async () => {
    const receiveEvent = makeReceiveEvent();
    const result = await handleIllustrationReply(null, 'mem-1', { receiveEvent });
    expect(result.handled).toBe(false);
    expect(receiveEvent).not.toHaveBeenCalled();
  });

  it('returns handled=false for sky-update event type', async () => {
    const receiveEvent = makeReceiveEvent();
    const event = { data: { type: 'sky-update', skyColors: ['#abc'] } };
    const result = await handleIllustrationReply(event, 'mem-1', { receiveEvent });
    expect(result.handled).toBe(false);
    expect(receiveEvent).not.toHaveBeenCalled();
  });

  it('includes receiveEvent result in return value', async () => {
    const receiveEvent = makeReceiveEvent({ success: true, newTotal: 200 });
    const event = { data: { type: 'discovery', discoveryId: 'mountain-firefly' } };
    const { result } = await handleIllustrationReply(event, 'mem-2', { receiveEvent });
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(200);
  });

  it('handles receiveEvent throw gracefully — returns handled=true, success=false', async () => {
    const receiveEvent = vi.fn(async () => { throw new Error('backend down'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const event = { data: { type: 'discovery', discoveryId: 'rainbow-arch' } };
    const result = await handleIllustrationReply(event, 'mem-3', { receiveEvent });
    expect(result.handled).toBe(true);
    expect(result.result.success).toBe(false);
    consoleSpy.mockRestore();
  });

  it('routes each known discovery ID correctly', async () => {
    for (const id of KNOWN_DISCOVERY_IDS) {
      const receiveEvent = makeReceiveEvent({ success: true });
      const event = { data: { type: 'discovery', discoveryId: id } };
      const result = await handleIllustrationReply(event, 'mem-x', { receiveEvent });
      expect(result.handled, `${id} should be handled`).toBe(true);
      expect(receiveEvent).toHaveBeenCalledWith(`discovery_${id}`, {}, 'mem-x');
    }
  });
});
