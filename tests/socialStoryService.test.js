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
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ id: storyId }),
  };
}

function mockErrorResponse(status, message) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message } }),
  };
}

// ── postStory ────────────────────────────────────────────────────────

describe('postStory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSecret.mockImplementation((key) => {
      if (key === 'META_PAGE_ID') return Promise.resolve('page_123');
      if (key === 'META_PAGE_ACCESS_TOKEN') return Promise.resolve('token_abc');
      return Promise.resolve(null);
    });
  });

  it('returns error when imageUrl is missing', async () => {
    const result = await postStory({ caption: 'test' });
    expect(result).toEqual({ success: false, error: 'imageUrl is required' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns error when secrets are not configured', async () => {
    mockGetSecret.mockResolvedValue(null);
    const result = await postStory({ imageUrl: 'https://example.com/story.png' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('returns error when getSecret throws', async () => {
    mockGetSecret.mockRejectedValue(new Error('secrets unavailable'));
    const result = await postStory({ imageUrl: 'https://example.com/story.png' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to retrieve');
  });

  it('posts story successfully', async () => {
    mockFetch.mockResolvedValue(mockSuccessResponse('story_789'));
    const result = await postStory({
      imageUrl: 'https://cdn.example.com/story.png',
      caption: 'Did you know?',
      storyType: 'did_you_know',
    });
    expect(result).toEqual({ success: true, storyId: 'story_789' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('page_123/photo_stories');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer token_abc');
    const body = JSON.parse(opts.body);
    expect(body.url).toBe('https://cdn.example.com/story.png');
    expect(body.caption).toBe('Did you know?');
    expect(body.published).toBe(true);
  });

  it('sanitizes caption text', async () => {
    mockFetch.mockResolvedValue(mockSuccessResponse());
    await postStory({
      imageUrl: 'https://example.com/s.png',
      caption: 'A'.repeat(3000),
      storyType: 'care_tip',
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.caption.length).toBeLessThanOrEqual(2200);
  });

  it('handles empty caption', async () => {
    mockFetch.mockResolvedValue(mockSuccessResponse());
    await postStory({ imageUrl: 'https://example.com/s.png' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.caption).toBe('');
  });

  it('returns dry run payload without posting', async () => {
    const result = await postStory({
      imageUrl: 'https://example.com/story.png',
      caption: 'Test caption',
      storyType: 'did_you_know',
      dryRun: true,
    });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.payload.url).toBe('https://example.com/story.png');
    expect(result.payload.endpoint).toContain('photo_stories');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles API error response', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(400, 'Invalid image URL'));
    const result = await postStory({
      imageUrl: 'https://example.com/bad.png',
      storyType: 'care_tip',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid image URL');
    expect(result.status).toBe(400);
  });

  it('retries on 429 rate limit', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(mockErrorResponse(429, 'Rate limited'))
      .mockResolvedValueOnce(mockSuccessResponse('retry_ok'));

    const promise = postStory({
      imageUrl: 'https://example.com/s.png',
      storyType: 'did_you_know',
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ success: true, storyId: 'retry_ok' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('retries on 500 server error', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(mockErrorResponse(500, 'Internal error'))
      .mockResolvedValueOnce(mockSuccessResponse('retry_500'));

    const promise = postStory({
      imageUrl: 'https://example.com/s.png',
      storyType: 'care_tip',
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ success: true, storyId: 'retry_500' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('gives up after max retries', async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue(mockErrorResponse(503, 'Service unavailable'));
    const promise = postStory({
      imageUrl: 'https://example.com/s.png',
      storyType: 'did_you_know',
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toBe('Service unavailable');
    expect(mockFetch).toHaveBeenCalledTimes(3); // MAX_RETRIES
    vi.useRealTimers();
  });

  it('retries on network errors', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(mockSuccessResponse('net_retry'));

    const promise = postStory({
      imageUrl: 'https://example.com/s.png',
      storyType: 'did_you_know',
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ success: true, storyId: 'net_retry' });
    vi.useRealTimers();
  });

  it('gives up after max network retries', async () => {
    vi.useFakeTimers();
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const promise = postStory({
      imageUrl: 'https://example.com/s.png',
      storyType: 'did_you_know',
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('does not retry on 400 client errors', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(400, 'Bad request'));
    const result = await postStory({
      imageUrl: 'https://example.com/s.png',
      storyType: 'did_you_know',
    });
    expect(result.success).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ── checkTokenHealth ─────────────────────────────────────────────────

describe('checkTokenHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invalid when secret retrieval fails', async () => {
    mockGetSecret.mockRejectedValue(new Error('no secrets'));
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot retrieve');
  });

  it('returns invalid when token is empty', async () => {
    mockGetSecret.mockResolvedValue('');
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('returns valid with expiry for good token', async () => {
    mockGetSecret.mockResolvedValue('valid_token');
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        data: { is_valid: true, expires_at: expiresAt },
      }),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBeTruthy();
  });

  it('returns valid with "never" for non-expiring token', async () => {
    mockGetSecret.mockResolvedValue('valid_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        data: { is_valid: true, expires_at: 0 },
      }),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBe('never');
  });

  it('returns invalid for expired token', async () => {
    mockGetSecret.mockResolvedValue('expired_token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        data: { is_valid: false, error: { message: 'Token expired' } },
      }),
    });
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token expired');
  });

  it('handles fetch errors gracefully', async () => {
    mockGetSecret.mockResolvedValue('some_token');
    mockFetch.mockRejectedValue(new Error('network failure'));
    const result = await checkTokenHealth();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Token check failed');
  });
});

// ── getScheduleStatus ────────────────────────────────────────────────

describe('getScheduleStatus', () => {
  it('returns did_you_know for Monday', async () => {
    // Use T12:00:00 to avoid UTC midnight timezone shift
    const result = await getScheduleStatus('2026-03-16T12:00:00');
    expect(result.dayOfWeek).toBe(1);
    expect(result.scheduledTypes).toEqual(['did_you_know']);
  });

  it('returns care_tip for Tuesday', async () => {
    const result = await getScheduleStatus('2026-03-17T12:00:00');
    expect(result.dayOfWeek).toBe(2);
    expect(result.scheduledTypes).toEqual(['care_tip']);
  });

  it('returns weekend_visit for Friday', async () => {
    const result = await getScheduleStatus('2026-03-20T12:00:00');
    expect(result.dayOfWeek).toBe(5);
    expect(result.scheduledTypes).toEqual(['weekend_visit']);
  });

  it('returns empty array for Sunday', async () => {
    const result = await getScheduleStatus('2026-03-22T12:00:00');
    expect(result.dayOfWeek).toBe(0);
    expect(result.scheduledTypes).toEqual([]);
  });

  it('returns defensive copy of scheduled types', async () => {
    const r1 = await getScheduleStatus('2026-03-16T12:00:00');
    r1.scheduledTypes.push('hacked');
    const r2 = await getScheduleStatus('2026-03-16T12:00:00');
    expect(r2.scheduledTypes).toEqual(['did_you_know']);
  });

  it('returns date string in ISO format', async () => {
    const result = await getScheduleStatus('2026-03-16T12:00:00');
    expect(result.date).toBe('2026-03-16');
  });

  it('defaults to current date when no argument', async () => {
    const result = await getScheduleStatus();
    expect(result.date).toBeTruthy();
    expect(result.dayOfWeek).toBeGreaterThanOrEqual(0);
    expect(result.dayOfWeek).toBeLessThanOrEqual(6);
  });
});
