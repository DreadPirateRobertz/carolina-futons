/**
 * @file lookupOrderWrapper.cf54st.test.js
 * @description cf-54st (cf-fd94.fu1) HTTP wrapper for cfw's /track-order
 * route. cfw posts {args:[orderNumber, email]} via callVelo (or direct
 * {orderNumber, email}) to /_functions/lookupOrder. Wix doesn't
 * auto-route webMethods to HTTP endpoints (cf-vtx5), so this wrapper
 * adapts the payload into the underlying lookupOrder(orderNumber, email)
 * webMethod call.
 *
 * Verifies:
 *   - validates both args (orderNumber + email) before delegating
 *   - accepts both {args:[n, e]} (callVelo shape) and {orderNumber, email}
 *   - invalid_json on body parse failure
 *   - 500 server_error + errorId on unexpected throws from lookupOrder
 *   - response shape is forwarded verbatim (success + error envelopes)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/orderTracking.web', async () => {
  const actual = await vi.importActual('backend/orderTracking.web');
  return {
    ...actual,
    lookupOrder: vi.fn().mockResolvedValue({
      success: true,
      order: { number: '10042', status: 'Shipped' },
    }),
  };
});

import { post_lookupOrder, options_lookupOrder } from '../src/backend/http-functions.js';
import { lookupOrder } from 'backend/orderTracking.web';

const goodOrigin = 'https://carolina-futons-web.vercel.app';

const makeReq = (body) => ({
  body: { json: async () => body },
  headers: { origin: goodOrigin },
});

beforeEach(() => {
  vi.mocked(lookupOrder).mockReset();
  vi.mocked(lookupOrder).mockResolvedValue({
    success: true,
    order: { number: '10042', status: 'Shipped' },
  });
});

describe('cf-54st · post_lookupOrder', () => {
  it('calls lookupOrder with (orderNumber, email) from callVelo {args} shape', async () => {
    const res = await post_lookupOrder(makeReq({ args: ['10042', 'jane@example.com'] }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
    expect(vi.mocked(lookupOrder)).toHaveBeenCalledWith('10042', 'jane@example.com');
  });

  it('accepts a direct payload body too (no callVelo wrapping)', async () => {
    await post_lookupOrder(makeReq({ orderNumber: '10043', email: 'direct@example.com' }));
    expect(vi.mocked(lookupOrder)).toHaveBeenCalledWith('10043', 'direct@example.com');
  });

  it('forwards the webMethod response envelope verbatim on success', async () => {
    vi.mocked(lookupOrder).mockResolvedValueOnce({
      success: true,
      order: { number: '10042', status: 'In Transit' },
      shipping: { carrier: 'UPS', trackingNumber: '1Z999' },
    });
    const res = await post_lookupOrder(makeReq({ args: ['10042', 'jane@example.com'] }));
    const body = JSON.parse(res.body);
    expect(body.shipping.trackingNumber).toBe('1Z999');
  });

  it('forwards a success:false envelope from the webMethod without rewriting it', async () => {
    vi.mocked(lookupOrder).mockResolvedValueOnce({
      success: false,
      error: 'Order not found. Please check your order number.',
    });
    const res = await post_lookupOrder(makeReq({ args: ['10099', 'jane@example.com'] }));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 400 invalid_json when body parse fails', async () => {
    const req = {
      body: { json: async () => { throw new SyntaxError('bad json'); } },
      headers: { origin: goodOrigin },
    };
    const res = await post_lookupOrder(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
    expect(vi.mocked(lookupOrder)).not.toHaveBeenCalled();
  });

  it('returns 400 when orderNumber is missing', async () => {
    const res = await post_lookupOrder(makeReq({ args: [null, 'jane@example.com'] }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/orderNumber/);
    expect(vi.mocked(lookupOrder)).not.toHaveBeenCalled();
  });

  it('returns 400 when email is missing', async () => {
    const res = await post_lookupOrder(makeReq({ args: ['10042'] }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/email/);
    expect(vi.mocked(lookupOrder)).not.toHaveBeenCalled();
  });

  it('returns 500 + errorId on unexpected throws from lookupOrder', async () => {
    vi.mocked(lookupOrder).mockRejectedValueOnce(new Error('Wix data outage'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post_lookupOrder(makeReq({ args: ['10042', 'jane@example.com'] }));
    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('server_error');
    expect(typeof body.errorId).toBe('string');
    consoleErr.mockRestore();
  });

  it('options preflight returns CORS response', () => {
    const res = options_lookupOrder({ headers: { origin: goodOrigin } });
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});
