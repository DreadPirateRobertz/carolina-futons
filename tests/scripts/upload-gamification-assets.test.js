/**
 * upload-gamification-assets.test.js
 *
 * TDD coverage for scripts/upload-gamification-assets.mjs (CF-tgsn.2).
 *
 * Covers:
 *   makePlaceholderLottie — valid Lottie v5 shape, brown vs tan color, animation keyframes
 *   getConfig             — throws on missing API key, returns correct shape when set
 *   getUploadUrl          — POST to correct endpoint, auth headers, error handling
 *   uploadFile            — multipart POST, uploadToken + file fields, error handling
 *   ANIMATIONS manifest   — correct keys, fileNames, distinct entries
 *   main                  — orchestrates upload flow, prints results, exits 1 on failure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  makePlaceholderLottie,
  getConfig,
  getUploadUrl,
  uploadFile,
  ANIMATIONS,
  main,
} from '../../scripts/upload-gamification-assets.mjs';

// ── fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function okJson(data) {
  return Promise.resolve({ ok: true, json: async () => data, text: async () => JSON.stringify(data) });
}

function failResponse(status, text) {
  return Promise.resolve({ ok: false, status, text: async () => text });
}

// ── env helpers ───────────────────────────────────────────────────────────────

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

beforeEach(() => { mockFetch.mockReset(); });

// ── makePlaceholderLottie ─────────────────────────────────────────────────────

describe('makePlaceholderLottie — Lottie v5 structure', () => {
  it('returns an object with Lottie v5 version field', () => {
    const lottie = makePlaceholderLottie('test', 'brown');
    expect(lottie.v).toBe('5.9.6');
  });

  it('has expected top-level fields: fr, ip, op, w, h, nm, ddd, assets, layers', () => {
    const lottie = makePlaceholderLottie('bear-dance', 'brown');
    expect(typeof lottie.fr).toBe('number');
    expect(lottie.ip).toBe(0);
    expect(lottie.op).toBe(60);
    expect(lottie.w).toBe(400);
    expect(lottie.h).toBe(400);
    expect(lottie.nm).toBe('bear-dance');
    expect(Array.isArray(lottie.assets)).toBe(true);
    expect(Array.isArray(lottie.layers)).toBe(true);
  });

  it('contains exactly one layer', () => {
    const lottie = makePlaceholderLottie('test', 'tan');
    expect(lottie.layers).toHaveLength(1);
  });

  it('layer has scale animation keyframes (a:1)', () => {
    const lottie = makePlaceholderLottie('test', 'brown');
    const scale = lottie.layers[0].ks.s;
    expect(scale.a).toBe(1);
    expect(Array.isArray(scale.k)).toBe(true);
    expect(scale.k.length).toBeGreaterThanOrEqual(3);
  });

  it('brown hue uses orange-brown fill color', () => {
    const lottie = makePlaceholderLottie('dancing', 'brown');
    const fill = lottie.layers[0].shapes[0].it.find(s => s.ty === 'fl');
    const [r, g, b] = fill.c.k;
    // brown: [0.55, 0.27, 0.07]
    expect(r).toBeCloseTo(0.55);
    expect(g).toBeCloseTo(0.27);
    expect(b).toBeCloseTo(0.07);
  });

  it('tan hue uses light-brown fill color', () => {
    const lottie = makePlaceholderLottie('waving', 'tan');
    const fill = lottie.layers[0].shapes[0].it.find(s => s.ty === 'fl');
    const [r, g, b] = fill.c.k;
    // tan: [0.82, 0.69, 0.44]
    expect(r).toBeCloseTo(0.82);
    expect(g).toBeCloseTo(0.69);
    expect(b).toBeCloseTo(0.44);
  });

  it('produces valid JSON when stringified', () => {
    const lottie = makePlaceholderLottie('test', 'brown');
    expect(() => JSON.stringify(lottie)).not.toThrow();
  });
});

// ── getConfig ─────────────────────────────────────────────────────────────────

describe('getConfig', () => {
  it('throws when WIX_SITE_API_KEY is not set', () => {
    withEnv({ WIX_SITE_API_KEY: undefined }, () => {
      expect(() => getConfig()).toThrow('Missing WIX_SITE_API_KEY');
    });
  });

  it('error message includes instructions for obtaining the key', () => {
    withEnv({ WIX_SITE_API_KEY: undefined }, () => {
      expect(() => getConfig()).toThrow('API Keys');
    });
  });

  it('returns apiKey and siteId when WIX_SITE_API_KEY is set', () => {
    withEnv({ WIX_SITE_API_KEY: 'test-key-abc', WIX_SITE_ID: 'site-123' }, () => {
      const config = getConfig();
      expect(config.apiKey).toBe('test-key-abc');
      expect(config.siteId).toBe('site-123');
    });
  });

  it('uses default site ID when WIX_SITE_ID is not set', () => {
    withEnv({ WIX_SITE_API_KEY: 'test-key', WIX_SITE_ID: undefined }, () => {
      const config = getConfig();
      expect(typeof config.siteId).toBe('string');
      expect(config.siteId.length).toBeGreaterThan(0);
    });
  });
});

// ── getUploadUrl ──────────────────────────────────────────────────────────────

describe('getUploadUrl', () => {
  const config = { apiKey: 'key-xyz', siteId: 'site-abc' };

  it('POSTs to the Wix Media upload/url endpoint', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ uploadUrl: 'https://upload.wix.com/u', uploadToken: 'tok' }));
    await getUploadUrl('test.json', 'application/json', config);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/upload/url');
    expect(opts.method).toBe('POST');
  });

  it('sends Authorization and wix-site-id headers', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ uploadUrl: 'u', uploadToken: 't' }));
    await getUploadUrl('f.json', 'application/json', config);
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('key-xyz');
    expect(headers['wix-site-id']).toBe('site-abc');
  });

  it('sends fileName and mimeType in request body', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ uploadUrl: 'u', uploadToken: 't' }));
    await getUploadUrl('bear.json', 'application/json', config);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.fileName).toBe('bear.json');
    expect(body.mimeType).toBe('application/json');
  });

  it('returns uploadUrl and uploadToken from response', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ uploadUrl: 'https://upload.wix.com/signed', uploadToken: 'my-token' }));
    const result = await getUploadUrl('x.json', 'application/json', config);
    expect(result.uploadUrl).toBe('https://upload.wix.com/signed');
    expect(result.uploadToken).toBe('my-token');
  });

  it('throws with status code on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(failResponse(401, 'Unauthorized'));
    await expect(getUploadUrl('x.json', 'application/json', config))
      .rejects.toThrow('401');
  });
});

// ── uploadFile ────────────────────────────────────────────────────────────────

describe('uploadFile', () => {
  it('POSTs to the provided uploadUrl', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ file: { id: 'fileId-1' } }));
    await uploadFile('https://upload.wix.com/target', 'tok', 'bear.json', '{}');
    expect(mockFetch.mock.calls[0][0]).toBe('https://upload.wix.com/target');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });

  it('sends FormData body (no Content-Type override)', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ file: { id: 'x' } }));
    await uploadFile('https://u.wix.com', 'tok', 'f.json', '{"v":1}');
    const body = mockFetch.mock.calls[0][1].body;
    // FormData instances don't have a simple string body
    expect(body).toBeTruthy();
    expect(typeof body).not.toBe('string');
  });

  it('returns response JSON on success', async () => {
    const responseData = { file: { id: 'cute-bear-dancing-AfMGeP3e3h' } };
    mockFetch.mockResolvedValueOnce(okJson(responseData));
    const result = await uploadFile('https://u', 'tok', 'bear.json', '{}');
    expect(result).toEqual(responseData);
  });

  it('throws with status on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(failResponse(403, 'Forbidden'));
    await expect(uploadFile('https://u', 'tok', 'f.json', '{}'))
      .rejects.toThrow('403');
  });
});

// ── ANIMATIONS manifest ───────────────────────────────────────────────────────

describe('ANIMATIONS manifest', () => {
  it('contains exactly 2 entries (dancing bear + idle bear)', () => {
    expect(ANIMATIONS).toHaveLength(2);
  });

  it('first entry is the dancing/celebration bear', () => {
    const dancing = ANIMATIONS.find(a => a.key === 'DANCING_BEAR_ID');
    expect(dancing).toBeDefined();
    expect(dancing.fileName).toContain('dancing');
    expect(dancing.hue).toBe('brown');
  });

  it('second entry is the idle/waving bear', () => {
    const idle = ANIMATIONS.find(a => a.key === 'IDLE_BEAR_ID');
    expect(idle).toBeDefined();
    expect(idle.fileName).toContain('waving');
    expect(idle.hue).toBe('tan');
  });

  it('all entries have key, fileName, hue, description fields', () => {
    for (const anim of ANIMATIONS) {
      expect(typeof anim.key).toBe('string');
      expect(typeof anim.fileName).toBe('string');
      expect(typeof anim.hue).toBe('string');
      expect(typeof anim.description).toBe('string');
    }
  });

  it('fileNames are distinct', () => {
    const names = ANIMATIONS.map(a => a.fileName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keys are distinct', () => {
    const keys = ANIMATIONS.map(a => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all fileNames end with .json', () => {
    for (const anim of ANIMATIONS) {
      expect(anim.fileName).toMatch(/\.json$/);
    }
  });
});

// ── main ──────────────────────────────────────────────────────────────────────

describe('main — upload orchestration', () => {
  let consoleSpy, consoleErrorSpy, exitSpy;

  beforeEach(() => {
    consoleSpy      = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy         = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
    process.env.WIX_SITE_API_KEY = 'test-api-key';
    process.env.WIX_SITE_ID      = 'test-site-id';
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    exitSpy.mockRestore();
    delete process.env.WIX_SITE_API_KEY;
    delete process.env.WIX_SITE_ID;
  });

  it('exits 1 when WIX_SITE_API_KEY is missing', async () => {
    delete process.env.WIX_SITE_API_KEY;
    await expect(main()).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('requests upload URL for each animation', async () => {
    // Each animation needs: getUploadUrl call (→ {uploadUrl, uploadToken}) + uploadFile call (→ {file:{id}})
    for (let i = 0; i < ANIMATIONS.length; i++) {
      mockFetch
        .mockResolvedValueOnce(okJson({ uploadUrl: `https://u${i}.wix.com`, uploadToken: `tok-${i}` }))
        .mockResolvedValueOnce(okJson({ file: { id: `fileId-${i}` } }));
    }
    await main();
    // 2 upload-url requests + 2 file upload requests = 4 fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(ANIMATIONS.length * 2);
  });

  it('prints fileId for each successfully uploaded animation', async () => {
    for (let i = 0; i < ANIMATIONS.length; i++) {
      mockFetch
        .mockResolvedValueOnce(okJson({ uploadUrl: `https://u.wix.com`, uploadToken: `tok` }))
        .mockResolvedValueOnce(okJson({ file: { id: `returned-id-${i}` } }));
    }
    await main();
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('returned-id-0');
    expect(output).toContain('returned-id-1');
  });

  it('exits 1 when any upload fails', async () => {
    // First animation succeeds
    mockFetch
      .mockResolvedValueOnce(okJson({ uploadUrl: 'https://u.wix.com', uploadToken: 'tok' }))
      .mockResolvedValueOnce(okJson({ file: { id: 'ok-id' } }));
    // Second animation getUploadUrl fails
    mockFetch.mockResolvedValueOnce(failResponse(500, 'Internal Server Error'));

    await expect(main()).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('logs a failure comment for each failed animation', async () => {
    mockFetch.mockResolvedValueOnce(failResponse(500, 'Error'));
    await expect(main()).rejects.toThrow('process.exit');
    const errOutput = consoleErrorSpy.mock.calls.flat().join('\n');
    expect(errOutput).toMatch(/Failed|failed/);
  });
});
