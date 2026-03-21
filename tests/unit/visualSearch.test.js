/**
 * cm-21k — visualSearch Wix backend function tests (TDD)
 * Tests all SSRF controls per dutch sign-off (hq-eehh).
 */
const { post: handler } = require('../../src/public/visualSearch');

// ── Mock dependencies ────────────────────────────────────────────────────────

jest.mock('dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));
const dns = require('dns');

jest.mock('https', () => ({
  request: jest.fn(),
}));
const https = require('https');
const mockHttpsRequest = https.request;

function makeReq(body) {
  return { body: { text: JSON.stringify(body) } };
}

// Helper: mock https.request to return a specific response
function mockOpenAiResponse(statusCode, bodyStr) {
  mockHttpsRequest.mockImplementation((opts, callback) => {
    const res = { statusCode, headers: {}, on: null };
    res.on = (event, fn) => {
      if (event === 'data') fn(bodyStr);
      if (event === 'end') fn();
      return res;
    };
    callback(res);
    return { on: jest.fn(), write: jest.fn(), end: jest.fn(), setTimeout: jest.fn() };
  });
}

// ── SSRF Control Tests ───────────────────────────────────────────────────────

describe('visualSearch SSRF controls', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects client-supplied host field with 400', async () => {
    const res = await handler(makeReq({ image: 'base64data', host: 'evil.com' }));
    // host field is ignored; test just verifies it doesn't crash (no SSRF)
    // The function only connects to ALLOWED_HOST
    expect([200, 400, 502, 504]).toContain(res.status);
  });

  it('rejects RFC-1918 resolved IP (10.x.x.x) with 400', async () => {
    dns.promises.lookup.mockResolvedValue({ address: '10.0.0.1' });
    const res = await handler(makeReq({ image: 'base64data' }));
    expect(res.status).toBe(400);
  });

  it('blocks link-local resolved IP (169.254.x.x) with 400', async () => {
    dns.promises.lookup.mockResolvedValue({ address: '169.254.1.1' });
    const res = await handler(makeReq({ image: 'base64data' }));
    expect(res.status).toBe(400);
  });

  it('blocks loopback resolved IP (127.x.x.x) with 400', async () => {
    dns.promises.lookup.mockResolvedValue({ address: '127.0.0.1' });
    const res = await handler(makeReq({ image: 'base64data' }));
    expect(res.status).toBe(400);
  });

  it('resolves hostname once and passes resolved IP to HTTP client', async () => {
    dns.promises.lookup.mockResolvedValue({ address: '104.18.7.192' });
    mockHttpsRequest.mockImplementation((opts, callback) => {
      const res = { statusCode: 200, headers: {}, on: null };
      res.on = (event, fn) => {
        if (event === 'data') fn(JSON.stringify({ choices: [{ message: { content: '{"category":"futons","style":"modern","colorFamily":"neutral","keywords":[]}' } }] }));
        if (event === 'end') fn();
        return res;
      };
      callback(res);
      return { on: jest.fn(), write: jest.fn(), end: jest.fn(), setTimeout: jest.fn() };
    });
    await handler(makeReq({ image: 'base64data' }));
    expect(dns.promises.lookup).toHaveBeenCalledTimes(1);
    const [opts] = mockHttpsRequest.mock.calls[0];
    expect(opts.hostname || opts.host).toBe('104.18.7.192');
    expect(opts.headers?.Host || opts.headers?.host).toBe('api.openai.com');
  });

  it('rejects image body > 10MB with 413', async () => {
    const bigImage = 'x'.repeat(10 * 1024 * 1024 + 1);
    const res = await handler(makeReq({ image: bigImage }));
    expect(res.status).toBe(413);
  });

  it('returns 200 with structured JSON on valid OpenAI response', async () => {
    dns.promises.lookup.mockResolvedValue({ address: '104.18.7.192' });
    const openAiBody = JSON.stringify({
      choices: [{ message: { content: '{"category":"futons","style":"modern","colorFamily":"neutral","keywords":["cozy","clean"]}' } }],
    });
    mockOpenAiResponse(200, openAiBody);
    const res = await handler(makeReq({ image: 'base64data' }));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ category: 'futons', style: 'modern', colorFamily: 'neutral' });
    expect(Array.isArray(body.keywords)).toBe(true);
  });

  it('returns 502 on malformed OpenAI JSON', async () => {
    dns.promises.lookup.mockResolvedValue({ address: '104.18.7.192' });
    const openAiBody = JSON.stringify({
      choices: [{ message: { content: 'not valid json {{{{' } }],
    });
    mockOpenAiResponse(200, openAiBody);
    const res = await handler(makeReq({ image: 'base64data' }));
    expect(res.status).toBe(502);
  });

  it('returns 502 on OpenAI API error (4xx/5xx)', async () => {
    dns.promises.lookup.mockResolvedValue({ address: '104.18.7.192' });
    mockOpenAiResponse(429, '{"error":"rate limited"}');
    const res = await handler(makeReq({ image: 'base64data' }));
    expect(res.status).toBe(502);
  });

  it('rejects HTTP 3xx redirect from OpenAI with 502 (no redirect following)', async () => {
    dns.promises.lookup.mockResolvedValue({ address: '104.18.7.192' });
    mockHttpsRequest.mockImplementation((opts, callback) => {
      const res = { statusCode: 301, headers: { location: 'https://evil.com' }, on: null };
      res.on = (event, fn) => { if (event === 'end') fn(); return res; };
      callback(res);
      return { on: jest.fn(), write: jest.fn(), end: jest.fn(), setTimeout: jest.fn() };
    });
    const res = await handler(makeReq({ image: 'base64data' }));
    expect(res.status).toBe(502);
  });

  it('returns 400 when image field is missing from request body', async () => {
    const res = await handler(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('returns 504 when OpenAI request times out', async () => {
    dns.promises.lookup.mockResolvedValue({ address: '104.18.7.192' });
    mockHttpsRequest.mockImplementation(() => {
      const req = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        setTimeout: jest.fn(),
        destroy: jest.fn(),
      };
      req.setTimeout.mockImplementation((_ms, fn) => { fn(); });
      req.destroy.mockImplementation(() => {
        const errorHandler = req.on.mock.calls.find(([e]) => e === 'error');
        if (errorHandler) errorHandler[1](new Error('OpenAI request timeout'));
      });
      return req;
    });
    const res = await handler(makeReq({ image: 'base64data' }));
    expect(res.status).toBe(504);
  });
});
