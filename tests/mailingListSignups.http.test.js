/**
 * @file mailingListSignups.http.test.js
 * @description TDD tests for POST /_functions/mailingListSignups — Velo HTTP wrapper
 * that proxies footer/landing newsletter signups to newsletterService.subscribeToNewsletter.
 *
 * cf-3qt.5.5: re-wire footer newsletter from Server Action to Velo path so the
 * Next.js frontend calls the same rate-limit + dedup + ESP-sync pipeline.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset as resetData, __seed } from './__mocks__/wix-data.js';

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn(),
}));

import { subscribeToNewsletter } from 'backend/newsletterService.web';
import { post_mailingListSignups, options_mailingListSignups } from '../src/backend/http-functions.js';

function makeRequest(body = {}) {
  const json = JSON.stringify(body);
  return {
    body: {
      text: async () => json,
      json: async () => body,
    },
    headers: { origin: 'https://carolina-futons-web.vercel.app' },
  };
}

beforeEach(() => {
  resetData();
  vi.clearAllMocks();
  subscribeToNewsletter.mockResolvedValue({ success: true, discountCode: 'WELCOME10' });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('post_mailingListSignups — success', () => {
  it('returns 200 with discountCode on valid email', async () => {
    const res = await post_mailingListSignups(makeRequest({ email: 'test@example.com' }));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.discountCode).toBe('WELCOME10');
  });

  it('passes source to subscribeToNewsletter', async () => {
    await post_mailingListSignups(makeRequest({ email: 'a@b.com', source: 'newsletter_landing' }));
    expect(subscribeToNewsletter).toHaveBeenCalledWith('a@b.com', expect.objectContaining({ source: 'newsletter_landing' }));
  });

  it('defaults source to footer_newsletter when omitted', async () => {
    await post_mailingListSignups(makeRequest({ email: 'a@b.com' }));
    expect(subscribeToNewsletter).toHaveBeenCalledWith('a@b.com', expect.objectContaining({ source: 'footer_newsletter' }));
  });

  it('passes honeypot field through to subscribeToNewsletter', async () => {
    await post_mailingListSignups(makeRequest({ email: 'a@b.com', honeypot: 'bot-value' }));
    expect(subscribeToNewsletter).toHaveBeenCalledWith('a@b.com', expect.objectContaining({ honeypot: 'bot-value' }));
  });

  it('returns 200 for duplicate subscriber (subscribeToNewsletter returns success:true)', async () => {
    subscribeToNewsletter.mockResolvedValue({ success: true, discountCode: 'WELCOME10' });
    const res = await post_mailingListSignups(makeRequest({ email: 'existing@example.com' }));
    expect(res.status).toBe(200);
  });
});

// ── Validation errors ─────────────────────────────────────────────────────────

describe('post_mailingListSignups — validation', () => {
  it('returns 400 on invalid JSON body', async () => {
    const req = {
      body: { text: async () => 'not-json', json: async () => { throw new Error('bad json'); } },
      headers: {},
    };
    const res = await post_mailingListSignups(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Invalid JSON/i);
  });

  it('returns 400 when subscribeToNewsletter returns success:false (invalid email)', async () => {
    subscribeToNewsletter.mockResolvedValue({ success: false, message: 'Invalid email format' });
    const res = await post_mailingListSignups(makeRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).success).toBe(false);
    expect(JSON.parse(res.body).error).toMatch(/Invalid email/i);
  });

  it('returns 400 when subscribeToNewsletter returns success:false without message', async () => {
    subscribeToNewsletter.mockResolvedValue({ success: false });
    const res = await post_mailingListSignups(makeRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBeTruthy();
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('post_mailingListSignups — rate limiting', () => {
  it('returns 429 when subscribeToNewsletter reports rate limit', async () => {
    subscribeToNewsletter.mockResolvedValue({ success: false, message: 'Too many requests. Please try again later.' });
    const res = await post_mailingListSignups(makeRequest({ email: 'spammer@example.com' }));
    expect(res.status).toBe(429);
    expect(JSON.parse(res.body).success).toBe(false);
  });
});

// ── Server errors ─────────────────────────────────────────────────────────────

describe('post_mailingListSignups — server errors', () => {
  it('returns 500 when subscribeToNewsletter resolves to null/undefined', async () => {
    subscribeToNewsletter.mockResolvedValue(null);
    const res = await post_mailingListSignups(makeRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(500);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  it('returns 500 on unexpected thrown exception', async () => {
    subscribeToNewsletter.mockRejectedValue(new Error('Wix DB timeout'));
    const res = await post_mailingListSignups(makeRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(500);
  });
});

// ── CORS preflight ────────────────────────────────────────────────────────────

describe('options_mailingListSignups', () => {
  it('returns a response object for CORS preflight', async () => {
    const res = await options_mailingListSignups({ headers: { origin: 'https://carolina-futons-web.vercel.app' } });
    expect(res).toBeDefined();
    expect(typeof res.status).toBe('number');
  });
});
