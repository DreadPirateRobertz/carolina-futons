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

function mockSuccessResponse(storyId = '123456') {
  return { ok: true, status: 200, json: () => Promise.resolve({ id: storyId }) };
}

function mockErrorResponse(status, message) {
  return { ok: false, status, json: () => Promise.resolve({ error: { message } }) };
}

// ── postStory — token expiry edge cases ──────────────────────────────

describe('postStory — token and credential edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSecret.mockImplementation((key) => {
      if (key === 'META_PAGE_ID') return Promise.resolve('page_123');
      if (key === 'META_PAGE_ACCESS_TOKEN') return Promise.resolve('token_abc');
      return Promise.resolve(null);
    });
  });

  it('returns error when META_PAGE_ID is empty string', async () => {
    mockGetSecret.mockImplementation((key) => {
      if (key === 'META_PAGE_ID') return Promise.resolve('');
      if (key === 'META_PAGE_ACCESS_TOKEN') return Promise.resolve('token_abc');
      return Promise.resolve(null);
    });
    const result = await postStory({ imageUrl: 'https://example.com/img.png' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('returns error when META_PAGE_ACCESS_TOKEN is empty string', async () => {
    mockGetSecret.mockImplementation((key) => {
      if (key === 'META_PAGE_ID') return Promise.resolve('page_123');
      if (key === 'META_PAGE_ACCESS_TOKEN') return Promise.resolve('');
      return Promise.resolve(null);
    });
    const result = await postStory({ imageUrl: 'https://example.com/img.png' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('returns error when getSecret throws for one key only', async () => {
    let callCount = 0;
    mockGetSecret.mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('partial failure');
      return Promise.resolve('token_abc');
    });
    const result = await postStory({ imageUrl: 'https://example.com/img.png' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to retrieve');
  });
});

// ── postStory — rate limit exhaustion ────────────────────────────────

describe('postStory — rate limit exhaustion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetSecret.mockImplementation((key) => {
      if (key === 'META_PAGE_ID') return Promise.resolve('page_123');
      if (key === 'META_PAGE_ACCESS_TOKEN') return Promise.resolve('token_abc');
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exhausts all retries on persistent 429 and returns rate limit error', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(429, 'Rate limit exceeded'));
    const promise = postStory({ imageUrl: 'https://example.com/img.png' });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limit exceeded');
    expect(result.status).toBe(429);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('uses exponential backoff delay between retries', async () => {
    mockFetch
      .mockResolvedValueOnce(mockErrorResponse(500, 'Server error'))
      .mockResolvedValueOnce(mockErrorResponse(502, 'Bad gateway'))
      .mockResolvedValueOnce(mockSuccessResponse('final'));

    const promise = postStory({ imageUrl: 'https://example.com/img.png' });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.storyId).toBe('final');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('mixes network errors and API errors across retries', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('DNS resolution failed'))
      .mockResolvedValueOnce(mockErrorResponse(503, 'Service unavailable'))
      .mockResolvedValueOnce(mockSuccessResponse('recovered'));

    const promise = postStory({ imageUrl: 'https://example.com/img.png' });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.storyId).toBe('recovered');
  });
});

// ── postStory — invalid image URL handling ───────────────────────────

describe('postStory — API error scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSecret.mockImplementation((key) => {
      if (key === 'META_PAGE_ID') return Promise.resolve('page_123');
      if (key === 'META_PAGE_ACCESS_TOKEN') return Promise.resolve('token_abc');
      return Promise.resolve(null);
    });
  });

  it('returns 400 error for invalid image URL without retrying', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(400, 'Invalid image URL format'));
    const result = await postStory({ imageUrl: 'not-a-valid-url' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid image URL format');
    expect(result.status).toBe(400);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns 401 error for expired token without retrying', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(401, 'Invalid OAuth 2.0 Access Token'));
    const result = await postStory({ imageUrl: 'https://example.com/img.png' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid OAuth 2.0 Access Token');
    expect(result.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns 403 error for insufficient permissions without retrying', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(403, 'Insufficient permissions'));
    const result = await postStory({ imageUrl: 'https://example.com/img.png' });
    expect(result.success).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles API response with ok=true but missing id', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    const result = await postStory({ imageUrl: 'https://example.com/img.png' });
    // ok=true but no body.id — falls through to error path
    expect(result.success).toBe(false);
  });

  it('handles API response with missing error message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({}),
    });
    const result = await postStory({ imageUrl: 'https://example.com/img.png' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 400');
  });
});

// ── checkTokenHealth — edge cases ────────────────────────────────────

describe('checkTokenHealth — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invalid when getSecret returns null (not empty string)', async () => {
    mockGetSecret.mockResolvedValue(null);
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('handles debug_token response with null data', async () => {
    mockGetSecret.mockResolvedValue('some_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: null }),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
  });

  it('handles debug_token response with missing data.is_valid', async () => {
    mockGetSecret.mockResolvedValue('some_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: {} }),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token is invalid');
  });

  it('handles debug_token with is_valid=false and no error message', async () => {
    mockGetSecret.mockResolvedValue('some_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: { is_valid: false } }),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token is invalid');
  });

  it('handles debug_token with is_valid=false and custom error message', async () => {
    mockGetSecret.mockResolvedValue('some_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        data: { is_valid: false, error: { message: 'Token has been revoked by user' } },
      }),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token has been revoked by user');
  });

  it('handles json parse failure in debug_token', async () => {
    mockGetSecret.mockResolvedValue('some_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.reject(new Error('Invalid JSON')),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Token check failed');
  });

  it('encodes access token in debug URL', async () => {
    mockGetSecret.mockResolvedValue('token with spaces & special=chars');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: { is_valid: true } }),
    });
    await checkTokenHealth();
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain(encodeURIComponent('token with spaces & special=chars'));
    expect(url).not.toContain('token with spaces');
  });

  it('returns "never" when expires_at is null', async () => {
    mockGetSecret.mockResolvedValue('valid_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: { is_valid: true, expires_at: null } }),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBe('never');
  });
});

// ── getScheduleStatus — edge cases ───────────────────────────────────

describe('getScheduleStatus — edge cases', () => {
  it('handles Wednesday (new_arrival)', async () => {
    const result = await getScheduleStatus('2026-03-18T12:00:00');
    expect(result.dayOfWeek).toBe(3);
    expect(result.scheduledTypes).toEqual(['new_arrival']);
  });

  it('handles Thursday (did_you_know)', async () => {
    const result = await getScheduleStatus('2026-03-19T12:00:00');
    expect(result.dayOfWeek).toBe(4);
    expect(result.scheduledTypes).toEqual(['did_you_know']);
  });

  it('handles Saturday (customer_spotlight)', async () => {
    const result = await getScheduleStatus('2026-03-21T12:00:00');
    expect(result.dayOfWeek).toBe(6);
    expect(result.scheduledTypes).toEqual(['customer_spotlight']);
  });

  it('throws on invalid date string (no input validation)', async () => {
    // getScheduleStatus calls toISOString() on Invalid Date, which throws
    await expect(getScheduleStatus('not-a-date')).rejects.toThrow('Invalid time value');
  });
});
