// cf-owrr: pin the trusted-proxy XFF parser. The leftmost X-Forwarded-For
// entry is client-controllable (an attacker can ship any value in the
// request header). Wix's edge appends ONE entry to the chain — the
// actual TCP-peer client IP — at the rightmost position. The helper
// strips trustedProxies entries from the right and returns the entry
// just before that. Default trustedProxies=1 = rightmost is Wix edge.
//
// Critical regression cases pinned here:
//   - leftmost-spoofed XFF must NOT determine the bucket key
//   - missing/empty XFF returns null (caller falls back to other axis)
//   - chain shorter than trustedProxies returns null (no guess)

import { describe, it, expect } from 'vitest';

import { extractTrustedClientIp } from 'backend/utils/rateLimit';

function req(xff) {
  return { headers: xff === undefined ? {} : { 'x-forwarded-for': xff } };
}

describe('cf-owrr · extractTrustedClientIp', () => {
  it('returns null when request has no headers', () => {
    expect(extractTrustedClientIp({})).toBeNull();
    expect(extractTrustedClientIp(null)).toBeNull();
    expect(extractTrustedClientIp(undefined)).toBeNull();
  });

  it('returns null when x-forwarded-for header is missing', () => {
    expect(extractTrustedClientIp({ headers: {} })).toBeNull();
  });

  it('returns null when x-forwarded-for is an empty string', () => {
    expect(extractTrustedClientIp(req(''))).toBeNull();
  });

  it('returns null when x-forwarded-for has only whitespace entries', () => {
    expect(extractTrustedClientIp(req(' , , '))).toBeNull();
  });

  it('reads case-insensitive header name (X-Forwarded-For)', () => {
    const r = { headers: { 'X-Forwarded-For': '1.2.3.4, 5.6.7.8' } };
    expect(extractTrustedClientIp(r)).toBe('1.2.3.4');
  });

  it('default trustedProxies=1: chain "client, edge" → returns "client"', () => {
    expect(extractTrustedClientIp(req('203.0.113.5, 198.51.100.1'))).toBe(
      '203.0.113.5',
    );
  });

  it('default trustedProxies=1: 3-entry chain "spoofed, real-client, edge" → returns "real-client" (NOT "spoofed")', () => {
    // The bug we are fixing: leftmost-trust would return '1.1.1.1' (the
    // attacker-supplied entry). Rightmost-trust with trustedProxies=1
    // strips the Wix edge entry ('198.51.100.1') and returns the entry
    // just before it (the actual edge-observed client, '203.0.113.5').
    const r = req('1.1.1.1, 203.0.113.5, 198.51.100.1');
    expect(extractTrustedClientIp(r)).toBe('203.0.113.5');
  });

  it('default trustedProxies=1: chain with ONE entry → returns null (cannot strip + read)', () => {
    // If only the Wix edge entry is present (no client-supplied entries
    // at all), there's no client IP to extract. Return null so the
    // caller falls back to the host axis instead of using the edge IP.
    expect(extractTrustedClientIp(req('198.51.100.1'))).toBeNull();
  });

  it('attacker bypass attempt: each request rotates a fresh leftmost IP — bucket stays stable', () => {
    // Same real-client IP behind Wix edge; attacker rotates the
    // leftmost entry per request. The trusted bucket key must be stable
    // (the real-client IP) regardless of leftmost rotation.
    const ip1 = extractTrustedClientIp(
      req('1.1.1.1, 203.0.113.5, 198.51.100.1'),
    );
    const ip2 = extractTrustedClientIp(
      req('2.2.2.2, 203.0.113.5, 198.51.100.1'),
    );
    const ip3 = extractTrustedClientIp(
      req('9.9.9.9, 203.0.113.5, 198.51.100.1'),
    );
    expect(ip1).toBe('203.0.113.5');
    expect(ip2).toBe('203.0.113.5');
    expect(ip3).toBe('203.0.113.5');
  });

  it('opts.trustedProxies=0: returns the rightmost entry (test harness mode)', () => {
    // For tests that fake the chain WITHOUT the Wix edge entry, the
    // caller can pass trustedProxies=0 to read the rightmost as-is.
    const r = req('1.2.3.4, 5.6.7.8');
    expect(extractTrustedClientIp(r, { trustedProxies: 0 })).toBe('5.6.7.8');
  });

  it('opts.trustedProxies=2: strips two rightmost entries (multi-proxy hypothetical)', () => {
    // Future-proofs against Wix changing the edge proxy count. If the
    // chain has 3 entries and trustedProxies=2, the leftmost-of-three
    // is the trusted client.
    const r = req('203.0.113.5, edge1, edge2');
    expect(extractTrustedClientIp(r, { trustedProxies: 2 })).toBe('203.0.113.5');
  });

  it('trims whitespace inside the chain', () => {
    expect(extractTrustedClientIp(req('  1.2.3.4  ,  5.6.7.8  '))).toBe(
      '1.2.3.4',
    );
  });

  it('skips empty entries (e.g. ",,1.2.3.4, edge")', () => {
    // Empty entries from malformed XFF chains shouldn't shift the
    // trusted-strip count. Filter them out before counting.
    expect(extractTrustedClientIp(req(',, 203.0.113.5, 198.51.100.1'))).toBe(
      '203.0.113.5',
    );
  });
});
