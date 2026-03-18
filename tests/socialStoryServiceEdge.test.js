/**
 * socialStoryServiceEdge.test.js
 *
 * Additional edge-case coverage for socialStoryService.web.js:
 *   - postStory: invalid/malformed image URLs, retry exhaustion, auth failures
 *   - checkTokenHealth: null token, expired token, malformed API responses
 *   - getScheduleStatus: Wednesday, Thursday, Saturday schedule verification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockGetSecret = vi.fn();
const mockFetch = vi.fn();

vi.mock('wix-web-module', () => ({
  webMethod: (_perm, fn) => fn,
  Permissions: { Admin: 'Admin', Anyone: 'Anyone' },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: (...args) => mockGetSecret(...args),
}));

vi.mock('wix-fetch', () => ({
  fetch: (...args) => mockFetch(...args),
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, max) => String(str).slice(0, max),
}));

import { postStory, checkTokenHealth, getScheduleStatus } from '../src/backend/socialStoryService.web.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeSuccess(storyId = 'sid-ok') {
  return { ok: true, status: 200, json: () => Promise.resolve({ id: storyId }) };
}

function makeError(status, message) {
  return { ok: false, status, json: () => Promise.resolve({ error: { message } }) };
}

// ── postStory — image URL edge cases ─────────────────────────────────

describe('postStory — image URL edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSecret.mockImplementation((key) => {
      if (key === 'META_PAGE_ID') return Promise.resolve('page_99');
      if (key === 'META_PAGE_ACCESS_TOKEN') return Promise.resolve('tok_abc');
      return Promise.resolve(null);
    });
  });

  it('returns error when imageUrl is empty string', async () => {
    const result = await postStory({ imageUrl: '', caption: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('imageUrl is required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns error when imageUrl is undefined', async () => {
    const result = await postStory({ caption: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('imageUrl is required');
  });

  it('forwards imageUrl verbatim to Meta API (validation is Meta-side)', async () => {
    mockFetch.mockResolvedValue(makeError(400, 'OAuthException: Invalid image URL'));
    const result = await postStory({ imageUrl: 'not-a-valid-url' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid image URL');
    expect(result.status).toBe(400);
  });

  it('sends imageUrl in POST body', async () => {
    mockFetch.mockResolvedValue(makeSuccess());
    await postStory({ imageUrl: 'https://cdn.example.com/story.png', caption: 'hi' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.url).toBe('https://cdn.example.com/story.png');
  });

  it('dryRun with imageUrl containing special characters returns payload without posting', async () => {
    const imageUrl = 'https://example.com/image with spaces & stuff.png';
    const result = await postStory({ imageUrl, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.payload.url).toBe(imageUrl);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── postStory — retry exhaustion ────────────────────────────────────

describe('postStory — retry exhaustion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSecret.mockImplementation((key) => {
      if (key === 'META_PAGE_ID') return Promise.resolve('page_99');
      if (key === 'META_PAGE_ACCESS_TOKEN') return Promise.resolve('tok_abc');
      return Promise.resolve(null);
    });
  });

  it('exhausts all 3 retries on persistent rate limit and returns error', async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue(makeError(429, 'Rate limited — please back off'));
    const promise = postStory({ imageUrl: 'https://example.com/s.png' });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limited — please back off');
    expect(mockFetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('exhausts all 3 retries on persistent 503 and returns error', async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue(makeError(503, 'Service unavailable'));
    const promise = postStory({ imageUrl: 'https://example.com/s.png' });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.success).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('succeeds on 3rd attempt after 2 rate limits', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(makeError(429, 'Rate limited'))
      .mockResolvedValueOnce(makeError(429, 'Rate limited'))
      .mockResolvedValueOnce(makeSuccess('third_ok'));
    const promise = postStory({ imageUrl: 'https://example.com/s.png' });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.storyId).toBe('third_ok');
    expect(mockFetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('does not retry on 401 unauthorized', async () => {
    mockFetch.mockResolvedValue(makeError(401, 'Invalid OAuth access token'));
    const result = await postStory({ imageUrl: 'https://example.com/s.png' });
    expect(result.success).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 403 forbidden', async () => {
    mockFetch.mockResolvedValue(makeError(403, 'Forbidden'));
    const result = await postStory({ imageUrl: 'https://example.com/s.png' });
    expect(result.success).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns error when API response has no id field despite 200 status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}), // no id
    });
    const result = await postStory({ imageUrl: 'https://example.com/s.png' });
    expect(result.success).toBe(false);
    expect(result.status).toBe(200);
  });
});

// ── checkTokenHealth — edge cases ────────────────────────────────────

describe('checkTokenHealth — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invalid when token resolves to null', async () => {
    mockGetSecret.mockResolvedValue(null);
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('returns invalid when API returns data.is_valid false without error message', async () => {
    mockGetSecret.mockResolvedValue('some_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: { is_valid: false } }),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns invalid when response has no data field', async () => {
    mockGetSecret.mockResolvedValue('some_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({}), // no data field
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns valid with expiresAt when expires_at is a future unix timestamp', async () => {
    mockGetSecret.mockResolvedValue('valid_token');
    const futureTimestamp = Math.floor(Date.now() / 1000) + 3600 * 24 * 60;
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: { is_valid: true, expires_at: futureTimestamp } }),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(true);
    expect(result.expiresAt).toContain('202'); // ISO date string starts with 202x
  });

  it('includes token in debug_token request URL', async () => {
    mockGetSecret.mockResolvedValue('my_secret_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: { is_valid: true, expires_at: 0 } }),
    });
    await checkTokenHealth();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('debug_token');
    expect(url).toContain('my_secret_token');
  });
});

// ── getScheduleStatus — additional days ──────────────────────────────

describe('getScheduleStatus — Wednesday / Thursday / Saturday', () => {
  it('returns new_arrival for Wednesday (day 3)', async () => {
    // 2026-03-18 is a Wednesday
    const result = await getScheduleStatus('2026-03-18T12:00:00');
    expect(result.dayOfWeek).toBe(3);
    expect(result.scheduledTypes).toEqual(['new_arrival']);
  });

  it('returns did_you_know for Thursday (day 4)', async () => {
    // 2026-03-19 is a Thursday
    const result = await getScheduleStatus('2026-03-19T12:00:00');
    expect(result.dayOfWeek).toBe(4);
    expect(result.scheduledTypes).toEqual(['did_you_know']);
  });

  it('returns customer_spotlight for Saturday (day 6)', async () => {
    // 2026-03-21 is a Saturday
    const result = await getScheduleStatus('2026-03-21T12:00:00');
    expect(result.dayOfWeek).toBe(6);
    expect(result.scheduledTypes).toEqual(['customer_spotlight']);
  });

  it('returns date string in YYYY-MM-DD format for all days tested', async () => {
    const dates = ['2026-03-18', '2026-03-19', '2026-03-21'];
    for (const d of dates) {
      const result = await getScheduleStatus(`${d}T12:00:00`);
      expect(result.date).toBe(d);
    }
  });
});
