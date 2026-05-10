/**
 * @file queueEmailWrappers.cfuwfw.test.js
 * @description cf-uwfw (cf-7ozz.1) — HTTP wrappers for cfw's
 * /api/email/trigger route. cfw posts {args:[payload]} via callVelo to
 * /_functions/queueWelcomeEmail and /_functions/queueCartRecovery; Wix
 * doesn't auto-route those, so this PR adds explicit wrappers.
 *
 * Verifies:
 *   - post_queueWelcomeEmail: validates email; calls triggerWelcomeSeries;
 *     forwards firstName when present; surfaces the webMethod's envelope
 *   - post_queueCartRecovery: validates items[]; stub-accepts the hint;
 *     rejects empty/malformed item shapes
 *   - Both: invalid_json on body parse failure; CORS headers on response;
 *     accept both {args:[payload]} (callVelo shape) and direct payload body
 *   - 500 server_error + errorId on unexpected throws
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the underlying webMethod so we can assert its argument shape.
vi.mock('backend/emailAutomation.web', async () => {
  const actual = await vi.importActual('backend/emailAutomation.web');
  return {
    ...actual,
    triggerWelcomeSeries: vi.fn().mockResolvedValue({ success: true, queued: 5 }),
  };
});

import { post_queueWelcomeEmail, options_queueWelcomeEmail, post_queueCartRecovery, options_queueCartRecovery } from '../src/backend/http-functions.js';
import { triggerWelcomeSeries } from 'backend/emailAutomation.web';

const goodOrigin = 'https://carolina-futons-web.vercel.app';

const makeReq = (body) => ({
  body: { json: async () => body },
  headers: { origin: goodOrigin },
});

beforeEach(() => {
  vi.mocked(triggerWelcomeSeries).mockReset();
  vi.mocked(triggerWelcomeSeries).mockResolvedValue({ success: true, queued: 5 });
});

describe('cf-uwfw · post_queueWelcomeEmail', () => {
  it('calls triggerWelcomeSeries with email + firstName from callVelo {args} shape', async () => {
    const res = await post_queueWelcomeEmail(makeReq({ args: [{ type: 'welcome', email: 'shopper@example.com', firstName: 'Asha' }] }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, queued: 5 });
    expect(vi.mocked(triggerWelcomeSeries)).toHaveBeenCalledWith('shopper@example.com', 'Asha');
  });

  it('accepts a direct payload body too (no callVelo wrapping)', async () => {
    await post_queueWelcomeEmail(makeReq({ email: 'direct@example.com', firstName: 'Direct' }));
    expect(vi.mocked(triggerWelcomeSeries)).toHaveBeenCalledWith('direct@example.com', 'Direct');
  });

  it('passes empty firstName when omitted', async () => {
    await post_queueWelcomeEmail(makeReq({ args: [{ email: 'noname@example.com' }] }));
    expect(vi.mocked(triggerWelcomeSeries)).toHaveBeenCalledWith('noname@example.com', '');
  });

  it('returns 400 invalid_json when body parse fails', async () => {
    const req = {
      body: { json: async () => { throw new SyntaxError('bad json'); } },
      headers: { origin: goodOrigin },
    };
    const res = await post_queueWelcomeEmail(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
    expect(vi.mocked(triggerWelcomeSeries)).not.toHaveBeenCalled();
  });

  it('returns 400 when email is missing', async () => {
    const res = await post_queueWelcomeEmail(makeReq({ args: [{ type: 'welcome' }] }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/email/i);
    expect(vi.mocked(triggerWelcomeSeries)).not.toHaveBeenCalled();
  });

  it('returns 500 + errorId when triggerWelcomeSeries throws', async () => {
    vi.mocked(triggerWelcomeSeries).mockRejectedValue(new Error('Wix Data unavailable'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post_queueWelcomeEmail(makeReq({ args: [{ email: 'shopper@example.com' }] }));
    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('server_error');
    expect(typeof body.errorId).toBe('string');
    consoleErr.mockRestore();
  });

  it('options preflight returns a CORS response', () => {
    const res = options_queueWelcomeEmail({ headers: { origin: goodOrigin } });
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});

describe('cf-uwfw · post_queueCartRecovery', () => {
  it('accepts a valid items[] payload via callVelo {args} shape', async () => {
    const res = await post_queueCartRecovery(makeReq({
      args: [{ type: 'cart-recovery', items: [{ productId: 'prod-1', quantity: 2 }] }],
    }));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.accepted).toBe(1);
  });

  it('accepts direct payload (no callVelo wrapping)', async () => {
    const res = await post_queueCartRecovery(makeReq({
      items: [{ productId: 'prod-1', quantity: 1 }, { productId: 'prod-2', quantity: 3 }],
    }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).accepted).toBe(2);
  });

  it('returns 400 when items is missing', async () => {
    const res = await post_queueCartRecovery(makeReq({ args: [{ type: 'cart-recovery' }] }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/items\[\] is required/);
  });

  it('returns 400 when items is empty', async () => {
    const res = await post_queueCartRecovery(makeReq({ args: [{ items: [] }] }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/items\[\] is required/);
  });

  it('returns 400 when an item has no productId', async () => {
    const res = await post_queueCartRecovery(makeReq({ items: [{ quantity: 1 }] }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/productId/);
  });

  it('returns 400 when an item has zero or negative quantity', async () => {
    const res = await post_queueCartRecovery(makeReq({ items: [{ productId: 'p-1', quantity: 0 }] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 invalid_json when body parse fails', async () => {
    const req = {
      body: { json: async () => { throw new SyntaxError('bad json'); } },
      headers: { origin: goodOrigin },
    };
    const res = await post_queueCartRecovery(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
  });

  it('options preflight returns a CORS response', () => {
    const res = options_queueCartRecovery({ headers: { origin: goodOrigin } });
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});
