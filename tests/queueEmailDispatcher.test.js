/**
 * @file queueEmailDispatcher.test.js
 * @description cf-uwfw (cf-7ozz.1) — coverage for the
 * post_queueWelcomeEmail / post_queueCartRecovery HTTP function wrappers
 * + the underlying webMethods in src/backend/emailFlow.web.js.
 *
 * Pins (cf-vtx5 dispatcher contract):
 *   - 400 invalid_json on body parse failure
 *   - 400 args_must_be_array when body lacks args[]
 *   - 400 mapping for "Invalid …" payload errors (cf-yvs4 + cf-mgnh)
 *   - 503 mapping for "Failed to …" infra errors
 *   - 200 + {success:true} on the happy path
 *   - 200 + {success:false} for business-logic outcomes (unsubscribed,
 *     already-queued)
 *   - 500 + errorId on unexpected throw
 *   - options preflight responds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the webMethod targets so we can inspect what the dispatcher
// passes through and force soft-fail / throw paths.
vi.mock('backend/emailFlow.web', () => ({
  queueWelcomeEmail: vi.fn(),
  queueCartRecovery: vi.fn(),
}));

import {
  post_queueWelcomeEmail,
  options_queueWelcomeEmail,
  post_queueCartRecovery,
  options_queueCartRecovery,
} from '../src/backend/http-functions.js';
import { queueWelcomeEmail, queueCartRecovery } from 'backend/emailFlow.web';

const goodOrigin = 'https://carolina-futons-web.vercel.app';

const makeRequest = (body) => ({
  path: [],
  body: { json: async () => body },
  headers: { origin: goodOrigin },
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── post_queueWelcomeEmail ───────────────────────────────────────────────────

describe('post_queueWelcomeEmail — cf-vtx5 dispatcher contract', () => {
  it('200 on happy path; passes payload to queueWelcomeEmail', async () => {
    vi.mocked(queueWelcomeEmail).mockResolvedValue({ success: true, queued: 3 });
    const payload = { type: 'welcome', email: 'new@example.com' };
    const res = await post_queueWelcomeEmail(makeRequest({ args: [payload] }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, queued: 3 });
    expect(vi.mocked(queueWelcomeEmail)).toHaveBeenCalledWith(payload);
  });

  it('400 invalid_json on body parse failure', async () => {
    const req = {
      path: [],
      body: { json: async () => { throw new SyntaxError('Bad JSON'); } },
      headers: { origin: goodOrigin },
    };
    const res = await post_queueWelcomeEmail(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
    expect(vi.mocked(queueWelcomeEmail)).not.toHaveBeenCalled();
  });

  it('400 args_must_be_array when body lacks args[]', async () => {
    const res = await post_queueWelcomeEmail(makeRequest({ foo: 'bar' }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('args_must_be_array');
    expect(vi.mocked(queueWelcomeEmail)).not.toHaveBeenCalled();
  });

  it('400 maps "Invalid email" soft-fail (cf-yvs4 + cf-mgnh)', async () => {
    vi.mocked(queueWelcomeEmail).mockResolvedValue({ success: false, error: 'Invalid email' });
    const res = await post_queueWelcomeEmail(makeRequest({
      args: [{ type: 'welcome', email: 'not-an-email' }],
    }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ success: false, error: 'Invalid email' });
  });

  it('503 maps "Failed to resolve contact" infra error', async () => {
    vi.mocked(queueWelcomeEmail).mockResolvedValue({ success: false, error: 'Failed to resolve contact' });
    const res = await post_queueWelcomeEmail(makeRequest({
      args: [{ type: 'welcome', email: 'good@example.com' }],
    }));
    expect(res.status).toBe(503);
  });

  it('200 + {success:false} for business-logic outcome (no error string)', async () => {
    // triggerWelcomeSequence returns { success: false, queued: 0 } on
    // unsubscribed / already-queued — no `error` field, so the classifier
    // returns null and the dispatcher keeps 200 so cfw can branch on
    // body.success without try/catch.
    vi.mocked(queueWelcomeEmail).mockResolvedValue({ success: false, queued: 0 });
    const res = await post_queueWelcomeEmail(makeRequest({
      args: [{ type: 'welcome', email: 'unsub@example.com' }],
    }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ success: false });
  });

  it('500 + errorId on unexpected throw; logs include label + id', async () => {
    vi.mocked(queueWelcomeEmail).mockRejectedValue(new Error('Wix Data unavailable'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post_queueWelcomeEmail(makeRequest({
      args: [{ type: 'welcome', email: 'a@b.com' }],
    }));
    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ success: false, error: 'server_error' });
    expect(typeof body.errorId).toBe('string');
    const logged = consoleErr.mock.calls.flat().map(String).join('\n');
    expect(logged).toContain(body.errorId);
    expect(logged).toContain('post_queueWelcomeEmail');
    consoleErr.mockRestore();
  });

  it('options preflight responds', () => {
    const res = options_queueWelcomeEmail({ headers: { origin: goodOrigin } });
    expect(res).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});

// ── post_queueCartRecovery ───────────────────────────────────────────────────

describe('post_queueCartRecovery — cf-vtx5 dispatcher contract', () => {
  const validPayload = {
    type: 'cart-recovery',
    items: [{ productId: 'prod-123', quantity: 2 }],
  };

  it('200 on happy path; passes payload to queueCartRecovery', async () => {
    vi.mocked(queueCartRecovery).mockResolvedValue({ success: true, acknowledged: 1, note: 'ack' });
    const res = await post_queueCartRecovery(makeRequest({ args: [validPayload] }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ success: true, acknowledged: 1 });
    expect(vi.mocked(queueCartRecovery)).toHaveBeenCalledWith(validPayload);
  });

  it('400 invalid_json on body parse failure', async () => {
    const req = {
      path: [],
      body: { json: async () => { throw new SyntaxError('Bad JSON'); } },
      headers: { origin: goodOrigin },
    };
    const res = await post_queueCartRecovery(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
  });

  it('400 args_must_be_array', async () => {
    const res = await post_queueCartRecovery(makeRequest({}));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('args_must_be_array');
  });

  it('400 maps "Invalid items" soft-fail', async () => {
    vi.mocked(queueCartRecovery).mockResolvedValue({ success: false, error: 'Invalid items' });
    const res = await post_queueCartRecovery(makeRequest({ args: [validPayload] }));
    expect(res.status).toBe(400);
  });

  it('400 maps "items is required" soft-fail', async () => {
    vi.mocked(queueCartRecovery).mockResolvedValue({ success: false, error: 'items is required' });
    const res = await post_queueCartRecovery(makeRequest({ args: [{ type: 'cart-recovery' }] }));
    expect(res.status).toBe(400);
  });

  it('500 + errorId on unexpected throw', async () => {
    vi.mocked(queueCartRecovery).mockRejectedValue(new Error('boom'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post_queueCartRecovery(makeRequest({ args: [validPayload] }));
    expect(res.status).toBe(500);
    expect(JSON.parse(res.body)).toMatchObject({ success: false, error: 'server_error' });
    consoleErr.mockRestore();
  });

  it('options preflight responds', () => {
    const res = options_queueCartRecovery({ headers: { origin: goodOrigin } });
    expect(res).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});
