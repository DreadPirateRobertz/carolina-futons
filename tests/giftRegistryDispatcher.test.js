/**
 * @file giftRegistryDispatcher.test.js
 * @description cf-bkxh coverage for the giftRegistry dispatcher.
 * cfw's actions/registry.ts uses `r(method) = giftRegistry/${method}` to
 * call 5 webMethods on `backend/giftRegistry.web` via callVelo. Same
 * dispatcher pattern as rennala's #1164 wishlist + cf-yvs4 contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/giftRegistry.web', () => ({
  createRegistry: vi.fn(),
  deleteRegistry: vi.fn(),
  getMyRegistries: vi.fn(),
  getPublicRegistry: vi.fn(),
  markItemPurchased: vi.fn(),
  // Methods intentionally NOT in the dispatcher allowlist — must 404.
  getRegistry: vi.fn(),
  addRegistryItem: vi.fn(),
  removeRegistryItem: vi.fn(),
}));

import {
  post_giftRegistry,
  options_giftRegistry,
} from '../src/backend/http-functions.js';
import {
  createRegistry,
  deleteRegistry,
  getMyRegistries,
  getPublicRegistry,
  markItemPurchased,
  addRegistryItem,
} from 'backend/giftRegistry.web';

const goodOrigin = 'https://carolina-futons-web.vercel.app';

const makeRequest = (method, body = { args: [] }) => ({
  path: method ? [method] : [],
  body: { json: async () => body },
  headers: { origin: goodOrigin },
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Allowlist routing ─────────────────────────────────────────────────────────

describe('cf-bkxh · post_giftRegistry dispatcher', () => {
  it('routes getMyRegistries with empty args + returns the bare result', async () => {
    vi.mocked(getMyRegistries).mockResolvedValue({ success: true, data: { registries: [{ _id: 'r1' }] } });
    const res = await post_giftRegistry(makeRequest('getMyRegistries'));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, data: { registries: [{ _id: 'r1' }] } });
    expect(vi.mocked(getMyRegistries)).toHaveBeenCalledWith();
  });

  it('routes createRegistry with positional args (cfw passes [{name, ...}])', async () => {
    vi.mocked(createRegistry).mockResolvedValue({ success: true, data: { _id: 'r2', slug: 'jane-doe-baby' } });
    await post_giftRegistry(makeRequest('createRegistry', { args: [{ name: 'Jane Doe Baby', occasion: 'baby' }] }));
    expect(vi.mocked(createRegistry)).toHaveBeenCalledWith({ name: 'Jane Doe Baby', occasion: 'baby' });
  });

  it('routes deleteRegistry with the registryId arg', async () => {
    vi.mocked(deleteRegistry).mockResolvedValue({ success: true });
    await post_giftRegistry(makeRequest('deleteRegistry', { args: ['r-99'] }));
    expect(vi.mocked(deleteRegistry)).toHaveBeenCalledWith('r-99');
  });

  it('routes getPublicRegistry by slug (Permissions.Anyone)', async () => {
    vi.mocked(getPublicRegistry).mockResolvedValue({ success: true, data: { _id: 'r1', items: [] } });
    await post_giftRegistry(makeRequest('getPublicRegistry', { args: ['jane-doe-baby'] }));
    expect(vi.mocked(getPublicRegistry)).toHaveBeenCalledWith('jane-doe-baby');
  });

  it('routes markItemPurchased with itemId + data args (Permissions.Anyone)', async () => {
    vi.mocked(markItemPurchased).mockResolvedValue({ success: true });
    await post_giftRegistry(makeRequest('markItemPurchased', { args: ['item-7', { name: 'Aunt Sue' }] }));
    expect(vi.mocked(markItemPurchased)).toHaveBeenCalledWith('item-7', { name: 'Aunt Sue' });
  });
});

// ── Allowlist gating (defense — methods NOT exposed to cfw) ───────────────────

describe('cf-bkxh · post_giftRegistry allowlist gating', () => {
  it('returns 404 unknown_method for addRegistryItem (in module but NOT in allowlist)', async () => {
    const res = await post_giftRegistry(makeRequest('addRegistryItem'));
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ success: false, error: 'unknown_method', method: 'addRegistryItem' });
    expect(vi.mocked(addRegistryItem)).not.toHaveBeenCalled();
  });

  it('returns 404 for getRegistry / removeRegistryItem (not in allowlist)', async () => {
    const r1 = await post_giftRegistry(makeRequest('getRegistry'));
    expect(r1.status).toBe(404);
    const r2 = await post_giftRegistry(makeRequest('removeRegistryItem'));
    expect(r2.status).toBe(404);
  });

  it('returns 404 when path is empty', async () => {
    const res = await post_giftRegistry(makeRequest(null));
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body).error).toBe('unknown_method');
  });
});

// ── cf-yvs4 contract ──────────────────────────────────────────────────────────

describe('cf-bkxh · cf-yvs4 contract', () => {
  it('400 invalid_json on body parse failure', async () => {
    const req = {
      path: ['getMyRegistries'],
      body: { json: async () => { throw new SyntaxError('Bad JSON'); } },
      headers: { origin: goodOrigin },
    };
    const res = await post_giftRegistry(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
  });

  it('400 args_must_be_array when body lacks args[]', async () => {
    const res = await post_giftRegistry(makeRequest('getMyRegistries', { foo: 'bar' }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('args_must_be_array');
  });

  it('cf-yvs4: maps webMethod {success:false} to a 4xx via _veloDispatchSoftFailStatus', async () => {
    vi.mocked(getMyRegistries).mockResolvedValue({ success: false, error: 'Authentication required' });
    const res = await post_giftRegistry(makeRequest('getMyRegistries'));
    expect(res.status).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ success: false, error: 'Authentication required' });
  });

  it('500 server_error + errorId on unexpected throw, logged with same id', async () => {
    vi.mocked(createRegistry).mockRejectedValue(new Error('Wix Data unavailable'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post_giftRegistry(makeRequest('createRegistry'));
    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ success: false, error: 'server_error' });
    expect(typeof body.errorId).toBe('string');
    const logged = consoleErr.mock.calls.flat().map(String).join('\n');
    expect(logged).toContain(body.errorId);
    expect(logged).toContain('post_giftRegistry:createRegistry');
    consoleErr.mockRestore();
  });

  it('options preflight responds', () => {
    const res = options_giftRegistry({ headers: { origin: goodOrigin } });
    expect(res).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});
