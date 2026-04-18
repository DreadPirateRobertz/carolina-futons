import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  allowOrigin,
  corsHeaders,
  corsPreflight,
  __TEST__,
} from '../src/backend/utils/cors.js';

function req(origin) {
  return { headers: origin ? { origin } : {} };
}

describe('allowOrigin', () => {
  it('allows the production vercel domain', () => {
    expect(allowOrigin(req('https://carolina-futons-web.vercel.app'))).toBe(
      'https://carolina-futons-web.vercel.app',
    );
  });

  it('allows the dreadpiraterobertz-projects vercel domain', () => {
    const origin = 'https://carolina-futons-web-dreadpiraterobertzs-projects.vercel.app';
    expect(allowOrigin(req(origin))).toBe(origin);
  });

  it('allows per-branch preview URLs', () => {
    const origin =
      'https://carolina-futons-web-git-cf-3qt-2-commerce-core-dreadpiraterobertzs-projects.vercel.app';
    expect(allowOrigin(req(origin))).toBe(origin);
  });

  it('allows localhost:3000', () => {
    expect(allowOrigin(req('http://localhost:3000'))).toBe('http://localhost:3000');
  });

  it('rejects unknown origins', () => {
    expect(allowOrigin(req('https://evil.example.com'))).toBeNull();
  });

  it('rejects look-alike origins (missing suffix)', () => {
    expect(allowOrigin(req('https://carolina-futons-web-git-something.vercel.app'))).toBeNull();
  });

  it('rejects when Origin header is missing', () => {
    expect(allowOrigin(req(null))).toBeNull();
  });

  it('reads case-variant Origin header', () => {
    const r = { headers: { Origin: 'http://localhost:3000' } };
    expect(allowOrigin(r)).toBe('http://localhost:3000');
  });
});

describe('corsHeaders', () => {
  it('returns CORS fields when the origin is allowed', () => {
    const h = corsHeaders(req('http://localhost:3000'), { 'Content-Type': 'application/json' });
    expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    expect(h['Access-Control-Allow-Credentials']).toBe('true');
    expect(h['Access-Control-Expose-Headers']).toMatch(/Content-Type/);
    expect(h.Vary).toBe('Origin');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('omits CORS fields but keeps extras when the origin is disallowed', () => {
    const h = corsHeaders(req('https://evil.example.com'), { 'Content-Type': 'application/json' });
    expect(h['Access-Control-Allow-Origin']).toBeUndefined();
    expect(h.Vary).toBeUndefined();
    expect(h['Content-Type']).toBe('application/json');
  });

  it('works without extra headers', () => {
    const h = corsHeaders(req('http://localhost:3000'));
    expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });
});

describe('corsPreflight', () => {
  it('returns 204 with full preflight headers for allowed origins', () => {
    const r = corsPreflight(req('http://localhost:3000'));
    expect(r.status).toBe(204);
    expect(r.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    expect(r.headers['Access-Control-Allow-Methods']).toMatch(/GET.*POST.*OPTIONS/);
    expect(r.headers['Access-Control-Allow-Headers']).toMatch(/Content-Type/);
    expect(r.headers['Access-Control-Max-Age']).toBe('86400');
  });

  it('returns 403 for disallowed origins', () => {
    const r = corsPreflight(req('https://evil.example.com'));
    expect(r.status).toBe(403);
    expect(r.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('origin-rejection observability', () => {
  let spy;
  beforeEach(() => { spy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { spy.mockRestore(); });

  it('logs when corsHeaders sees a disallowed Origin header', () => {
    corsHeaders(req('https://evil.example.com'));
    expect(spy).toHaveBeenCalledWith(
      '[cors.originRejected.headers]',
      expect.stringContaining('https://evil.example.com'),
    );
  });

  it('logs when corsPreflight sees a disallowed Origin header', () => {
    corsPreflight(req('https://evil.example.com'));
    expect(spy).toHaveBeenCalledWith(
      '[cors.originRejected.preflight]',
      expect.stringContaining('https://evil.example.com'),
    );
  });

  it('does not log when no Origin header is present (same-origin/server-to-server)', () => {
    corsHeaders(req(null));
    corsPreflight(req(null));
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not log when the origin is allowed', () => {
    corsHeaders(req('http://localhost:3000'));
    corsPreflight(req('http://localhost:3000'));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('allowlist sanity', () => {
  it('exports the exact origins list for documentation parity', () => {
    expect(__TEST__.EXACT_ORIGINS).toEqual([
      'https://carolina-futons-web.vercel.app',
      'https://carolina-futons-web-dreadpiraterobertzs-projects.vercel.app',
      'http://localhost:3000',
    ]);
  });

  it('wildcard pattern matches git-<branch>- preview format only', () => {
    expect(__TEST__.WILDCARD_ORIGIN_PATTERN.test(
      'https://carolina-futons-web-git-feature-x-dreadpiraterobertzs-projects.vercel.app',
    )).toBe(true);
    expect(__TEST__.WILDCARD_ORIGIN_PATTERN.test(
      'https://carolina-futons-web-git--dreadpiraterobertzs-projects.vercel.app',
    )).toBe(false);
  });
});
