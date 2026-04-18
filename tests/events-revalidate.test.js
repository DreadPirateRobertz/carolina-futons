import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

// ── Wix platform mock ────────────────────────────────────────────────

const mockGetSecret = vi.fn();
vi.mock('wix-secrets-backend', () => ({ getSecret: (...a) => mockGetSecret(...a) }));
vi.mock('wix-data', () => ({ default: { insert: vi.fn(), get: vi.fn(), update: vi.fn() } }));
vi.mock('backend/utils/sanitize', () => ({ sanitize: (v) => v }));
vi.mock('backend/contentOrchestrator.web', () => ({ triggerEventOrchestration: vi.fn() }));
vi.mock('backend/emailAutomation.web', () => ({ triggerRestockNotifications: vi.fn() }));

// ── fetch mock ────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const TEST_URL = 'https://cfw.example.com/api/revalidate';
const TEST_SECRET = 'test-hmac-secret';

function expectedSig(body) {
  return 'sha256=' + createHmac('sha256', TEST_SECRET).update(body).digest('hex');
}

// ── helpers ───────────────────────────────────────────────────────────

function okResponse() {
  return { ok: true, status: 200 };
}

// ── tests ─────────────────────────────────────────────────────────────

describe('_postRevalidateWebhook (via wixStores_onProductUpdated)', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue(okResponse());
    mockGetSecret.mockImplementation((key) => {
      if (key === 'VERCEL_REVALIDATE_URL') return Promise.resolve(TEST_URL);
      if (key === 'WIX_WEBHOOK_SECRET') return Promise.resolve(TEST_SECRET);
      return Promise.resolve('unused');
    });
  });

  it('POSTs HMAC-signed JSON to VERCEL_REVALIDATE_URL on product update', async () => {
    const { wixStores_onProductUpdated } = await import('../src/backend/events.js');
    await wixStores_onProductUpdated({ entity: { _id: 'prod-1', name: 'Sofa' } });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(TEST_URL);
    expect(opts.method).toBe('POST');

    const body = opts.body;
    const parsed = JSON.parse(body);
    expect(parsed.collectionId).toBe('products');
    expect(parsed.itemId).toBe('prod-1');
    expect(parsed.eventType).toBe('onProductUpdated');

    expect(opts.headers['x-wix-signature']).toBe(expectedSig(body));
  });

  it('POSTs on product created', async () => {
    const { wixStores_onProductCreated } = await import('../src/backend/events.js');
    await wixStores_onProductCreated({ entity: { _id: 'prod-2', name: 'Futon' } });

    expect(mockFetch).toHaveBeenCalledOnce();
    const parsed = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(parsed.collectionId).toBe('products');
    expect(parsed.itemId).toBe('prod-2');
    expect(parsed.eventType).toBe('onProductCreated');
  });

  it('does NOT call fetch when VERCEL_REVALIDATE_URL is empty', async () => {
    mockGetSecret.mockImplementation((key) => {
      if (key === 'VERCEL_REVALIDATE_URL') return Promise.resolve('');
      return Promise.resolve(TEST_SECRET);
    });
    const { wixStores_onProductUpdated } = await import('../src/backend/events.js');
    await wixStores_onProductUpdated({ entity: { _id: 'p1' } });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does NOT call fetch when WIX_WEBHOOK_SECRET is empty', async () => {
    mockGetSecret.mockImplementation((key) => {
      if (key === 'WIX_WEBHOOK_SECRET') return Promise.resolve('');
      return Promise.resolve(TEST_URL);
    });
    const { wixStores_onProductUpdated } = await import('../src/backend/events.js');
    await wixStores_onProductUpdated({ entity: { _id: 'p1' } });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw when fetch rejects (non-fatal)', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    const { wixStores_onProductUpdated } = await import('../src/backend/events.js');
    await expect(
      wixStores_onProductUpdated({ entity: { _id: 'p1' } }),
    ).resolves.not.toThrow();
  });

  it('logs a warning (not error) when fetch returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { wixStores_onProductUpdated } = await import('../src/backend/events.js');
    await wixStores_onProductUpdated({ entity: { _id: 'p1' } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[events] revalidate webhook returned'),
      500,
    );
    warnSpy.mockRestore();
  });
});

describe('wixBlog_onPostPublished', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue(okResponse());
    mockGetSecret.mockImplementation((key) => {
      if (key === 'VERCEL_REVALIDATE_URL') return Promise.resolve(TEST_URL);
      if (key === 'WIX_WEBHOOK_SECRET') return Promise.resolve(TEST_SECRET);
      return Promise.resolve('unused');
    });
  });

  it('POSTs blog/Posts revalidate on post publish', async () => {
    const { wixBlog_onPostPublished } = await import('../src/backend/events.js');
    await wixBlog_onPostPublished({ entity: { _id: 'post-abc', title: 'Hello' } });

    expect(mockFetch).toHaveBeenCalledOnce();
    const parsed = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(parsed.collectionId).toBe('blog/Posts');
    expect(parsed.itemId).toBe('post-abc');
    expect(parsed.eventType).toBe('onPostPublished');
  });

  it('still POSTs when post has no _id', async () => {
    const { wixBlog_onPostPublished } = await import('../src/backend/events.js');
    await wixBlog_onPostPublished({ entity: {} });
    expect(mockFetch).toHaveBeenCalledOnce();
    const parsed = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(parsed.collectionId).toBe('blog/Posts');
    expect(parsed.itemId).toBeUndefined();
  });
});

describe('wixData_onDataItemUpdated', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue(okResponse());
    mockGetSecret.mockImplementation((key) => {
      if (key === 'VERCEL_REVALIDATE_URL') return Promise.resolve(TEST_URL);
      if (key === 'WIX_WEBHOOK_SECRET') return Promise.resolve(TEST_SECRET);
      return Promise.resolve('unused');
    });
  });

  it('POSTs revalidate with collectionId and itemId', async () => {
    const { wixData_onDataItemUpdated } = await import('../src/backend/events.js');
    await wixData_onDataItemUpdated({
      collectionId: 'FAQ',
      item: { _id: 'faq-1' },
    });

    const parsed = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(parsed.collectionId).toBe('FAQ');
    expect(parsed.itemId).toBe('faq-1');
    expect(parsed.eventType).toBe('onDataItemUpdated');
  });

  it('skips POST when collectionId is missing', async () => {
    const { wixData_onDataItemUpdated } = await import('../src/backend/events.js');
    await wixData_onDataItemUpdated({ item: { _id: 'x' } });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('falls back to dataCollectionId when collectionId is absent', async () => {
    const { wixData_onDataItemUpdated } = await import('../src/backend/events.js');
    await wixData_onDataItemUpdated({ dataCollectionId: 'Videos', item: { _id: 'v1' } });
    const parsed = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(parsed.collectionId).toBe('Videos');
    expect(parsed.itemId).toBe('v1');
  });
});
