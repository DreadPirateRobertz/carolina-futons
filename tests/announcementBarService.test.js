/**
 * announcementBarService.test.js
 *
 * Unit tests for src/backend/announcementBarService.web.js
 *
 * Covers:
 *  - Happy path: returns active bars sorted by priority descending
 *  - Date filtering: bars outside startDate/endDate are excluded (by mock)
 *  - Response shape: message, linkUrl, backgroundColor, textColor, priority
 *  - Empty result: returns empty array when no active bars
 *  - Error path: logs error and returns empty array on wixData failure
 *  - Field defaults: null for missing optional fields
 *  - Limit: at most 10 bars returned
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockFind, mockLimit, mockDescending, mockGe, mockLe, mockEq, mockQuery } = vi.hoisted(() => {
  const mockFind = vi.fn();
  const mockLimit = vi.fn(() => ({ find: mockFind }));
  const mockDescending = vi.fn(() => ({ limit: mockLimit }));
  const mockGe = vi.fn(() => ({ descending: mockDescending }));
  const mockLe = vi.fn(() => ({ ge: mockGe }));
  const mockEq = vi.fn(() => ({ le: mockLe }));
  const mockQuery = vi.fn(() => ({ eq: mockEq }));
  return { mockFind, mockLimit, mockDescending, mockGe, mockLe, mockEq, mockQuery };
});

vi.mock('wix-data', () => ({ default: { query: mockQuery } }));
vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));

import { getActiveAnnouncementBars } from '../src/backend/announcementBarService.web.js';
import { logError } from 'backend/utils/errorHandler';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBar(overrides = {}) {
  return {
    message: 'Spring Sale — 20% off frames!',
    linkUrl: 'https://carolinafutons.com/sale',
    backgroundColor: '#3A2518',
    textColor: '#FAF7F2',
    priority: 10,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  // Re-wire chain after reset
  mockFind.mockResolvedValue({ items: [] });
  mockLimit.mockReturnValue({ find: mockFind });
  mockDescending.mockReturnValue({ limit: mockLimit });
  mockGe.mockReturnValue({ descending: mockDescending });
  mockLe.mockReturnValue({ ge: mockGe });
  mockEq.mockReturnValue({ le: mockLe });
  mockQuery.mockReturnValue({ eq: mockEq });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getActiveAnnouncementBars', () => {
  describe('happy path', () => {
    it('returns mapped bars with correct shape', async () => {
      const raw = makeBar();
      mockFind.mockResolvedValueOnce({ items: [raw] });
      const result = await getActiveAnnouncementBars();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        message: 'Spring Sale — 20% off frames!',
        linkUrl: 'https://carolinafutons.com/sale',
        backgroundColor: '#3A2518',
        textColor: '#FAF7F2',
        priority: 10,
      });
    });

    it('returns multiple bars in priority order (highest first)', async () => {
      mockFind.mockResolvedValueOnce({
        items: [makeBar({ priority: 10, message: 'High priority' }), makeBar({ priority: 5, message: 'Low priority' })],
      });
      const result = await getActiveAnnouncementBars();
      expect(result[0].priority).toBe(10);
      expect(result[1].priority).toBe(5);
    });

    it('queries the AnnouncementBars collection with active=true filter', async () => {
      await getActiveAnnouncementBars();
      expect(mockQuery).toHaveBeenCalledWith('AnnouncementBars');
      expect(mockEq).toHaveBeenCalledWith('active', true);
    });

    it('applies startDate le now and endDate ge now for date filtering', async () => {
      await getActiveAnnouncementBars();
      // le('startDate', now) and ge('endDate', now) filter active date range
      expect(mockLe).toHaveBeenCalledWith('startDate', expect.any(Date));
      expect(mockGe).toHaveBeenCalledWith('endDate', expect.any(Date));
    });

    it('sorts by priority descending', async () => {
      await getActiveAnnouncementBars();
      expect(mockDescending).toHaveBeenCalledWith('priority');
    });

    it('limits to 10 bars', async () => {
      await getActiveAnnouncementBars();
      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  describe('empty result', () => {
    it('returns empty array when no active bars exist', async () => {
      mockFind.mockResolvedValueOnce({ items: [] });
      const result = await getActiveAnnouncementBars();
      expect(result).toEqual([]);
    });
  });

  describe('field defaults', () => {
    it('returns null for missing optional fields', async () => {
      mockFind.mockResolvedValueOnce({
        items: [{ message: 'Hello', priority: 1 }],
      });
      const result = await getActiveAnnouncementBars();
      expect(result[0].linkUrl).toBeNull();
      expect(result[0].backgroundColor).toBeNull();
      expect(result[0].textColor).toBeNull();
    });

    it('returns empty string for missing message field', async () => {
      mockFind.mockResolvedValueOnce({ items: [{ priority: 1 }] });
      const result = await getActiveAnnouncementBars();
      expect(result[0].message).toBe('');
    });

    it('returns 0 for missing priority field', async () => {
      mockFind.mockResolvedValueOnce({ items: [{ message: 'Hello' }] });
      const result = await getActiveAnnouncementBars();
      expect(result[0].priority).toBe(0);
    });
  });

  describe('error handling', () => {
    it('logs error and returns empty array when wixData.query throws', async () => {
      mockFind.mockRejectedValueOnce(new Error('DB connection failed'));
      const result = await getActiveAnnouncementBars();
      expect(result).toEqual([]);
      expect(logError).toHaveBeenCalledWith(
        'announcementBarService.getActiveAnnouncementBars',
        expect.any(Error)
      );
    });

    it('does not throw when wixData fails', async () => {
      mockFind.mockRejectedValueOnce(new Error('Timeout'));
      await expect(getActiveAnnouncementBars()).resolves.toEqual([]);
    });
  });
});
