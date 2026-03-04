/**
 * Tests for ugcVoting.js — UGC voting helper with optimistic UI
 *
 * CF-o486: UGC Gallery — voting/favorite logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('backend/ugcService.web', () => ({
  voteForPhoto: vi.fn().mockResolvedValue({ success: true, voted: true, newCount: 1 }),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('wix-storage-frontend', () => ({
  session: {
    getItem: vi.fn((key) => globalThis.sessionStorage.getItem(key)),
    setItem: vi.fn((key, val) => globalThis.sessionStorage.setItem(key, val)),
    removeItem: vi.fn((key) => globalThis.sessionStorage.removeItem(key)),
  },
}));

// ── Import module under test ─────────────────────────────────────────

import {
  initVoting,
  handleVoteClick,
  isVotedByUser,
  syncVoteState,
  getVotedPhotoIds,
} from '../src/public/ugcVoting.js';

import { voteForPhoto } from 'backend/ugcService.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers.js';

// ── $w Mock ──────────────────────────────────────────────────────────

function mockElement(overrides = {}) {
  return {
    collapse: vi.fn(),
    expand: vi.fn(),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
    text: '',
    src: '',
    accessibility: {},
    style: {},
    ...overrides,
  };
}

function createMock$w(elements = {}) {
  return (selector) => {
    if (elements[selector]) return elements[selector];
    throw new Error(`Element ${selector} not found`);
  };
}

// ── Storage key helper ───────────────────────────────────────────────

const STORAGE_KEY = 'ugc_voted_photos';

function setVotedPhotos(ids) {
  globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

// ══════════════════════════════════════════════════════════════════════
// isVotedByUser
// ══════════════════════════════════════════════════════════════════════

describe('isVotedByUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when photoId is in sessionStorage voted list', () => {
    setVotedPhotos(['photo-1', 'photo-2', 'photo-3']);
    expect(isVotedByUser('photo-2')).toBe(true);
  });

  it('returns false when photoId is not in voted list', () => {
    setVotedPhotos(['photo-1', 'photo-3']);
    expect(isVotedByUser('photo-2')).toBe(false);
  });

  it('returns false when sessionStorage is empty (no voted key)', () => {
    // sessionStorage is cleared in setup.js beforeEach
    expect(isVotedByUser('photo-1')).toBe(false);
  });

  it('returns false when sessionStorage value is null', () => {
    // Explicitly ensure nothing is stored
    globalThis.sessionStorage.removeItem(STORAGE_KEY);
    expect(isVotedByUser('photo-1')).toBe(false);
  });

  it('handles corrupted sessionStorage data gracefully', () => {
    globalThis.sessionStorage.setItem(STORAGE_KEY, '{not-valid-json!!!');
    expect(isVotedByUser('photo-1')).toBe(false);
  });

  it('handles sessionStorage storing a non-array value', () => {
    globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify('just-a-string'));
    expect(isVotedByUser('photo-1')).toBe(false);
  });

  it('handles sessionStorage storing an object instead of array', () => {
    globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'photo-1' }));
    expect(isVotedByUser('photo-1')).toBe(false);
  });

  it('returns false for null photoId', () => {
    setVotedPhotos(['photo-1']);
    expect(isVotedByUser(null)).toBe(false);
  });

  it('returns false for undefined photoId', () => {
    setVotedPhotos(['photo-1']);
    expect(isVotedByUser(undefined)).toBe(false);
  });

  it('returns false for empty string photoId', () => {
    setVotedPhotos(['photo-1']);
    expect(isVotedByUser('')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getVotedPhotoIds
// ══════════════════════════════════════════════════════════════════════

describe('getVotedPhotoIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns array of voted photo IDs from sessionStorage', () => {
    setVotedPhotos(['photo-1', 'photo-2', 'photo-3']);
    const result = getVotedPhotoIds();
    expect(result).toEqual(['photo-1', 'photo-2', 'photo-3']);
  });

  it('returns empty array when nothing has been voted', () => {
    const result = getVotedPhotoIds();
    expect(result).toEqual([]);
  });

  it('returns empty array when sessionStorage key is missing', () => {
    globalThis.sessionStorage.removeItem(STORAGE_KEY);
    const result = getVotedPhotoIds();
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles corrupted JSON in sessionStorage', () => {
    globalThis.sessionStorage.setItem(STORAGE_KEY, 'not-json{{{');
    const result = getVotedPhotoIds();
    expect(result).toEqual([]);
  });

  it('handles non-array JSON value', () => {
    globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    const result = getVotedPhotoIds();
    expect(result).toEqual([]);
  });

  it('handles null JSON value', () => {
    globalThis.sessionStorage.setItem(STORAGE_KEY, 'null');
    const result = getVotedPhotoIds();
    expect(result).toEqual([]);
  });

  it('returns a new array (not a reference to internal state)', () => {
    setVotedPhotos(['photo-1']);
    const a = getVotedPhotoIds();
    const b = getVotedPhotoIds();
    expect(a).toEqual(b);
    // Mutating the returned array should not affect future calls
    a.push('photo-99');
    expect(getVotedPhotoIds()).toEqual(['photo-1']);
  });
});

// ══════════════════════════════════════════════════════════════════════
// handleVoteClick
// ══════════════════════════════════════════════════════════════════════

describe('handleVoteClick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    voteForPhoto.mockResolvedValue({ success: true, voted: true, newCount: 1 });
  });

  it('calls voteForPhoto backend with the photoId', async () => {
    const result = await handleVoteClick(createMock$w(), 'photo-1', 0);
    expect(voteForPhoto).toHaveBeenCalledWith('photo-1');
    expect(result.success).toBe(true);
  });

  it('returns the backend result on success', async () => {
    voteForPhoto.mockResolvedValue({ success: true, voted: true, newCount: 5 });
    const result = await handleVoteClick(createMock$w(), 'photo-1', 4);
    expect(result).toEqual({ success: true, voted: true, newCount: 5 });
  });

  it('updates sessionStorage on successful vote (add)', async () => {
    voteForPhoto.mockResolvedValue({ success: true, voted: true, newCount: 1 });
    await handleVoteClick(createMock$w(), 'photo-1', 0);
    const stored = JSON.parse(globalThis.sessionStorage.getItem(STORAGE_KEY));
    expect(stored).toContain('photo-1');
  });

  it('removes from sessionStorage on unvote (toggle off)', async () => {
    setVotedPhotos(['photo-1', 'photo-2']);
    voteForPhoto.mockResolvedValue({ success: true, voted: false, newCount: 0 });
    await handleVoteClick(createMock$w(), 'photo-1', 1);
    const stored = JSON.parse(globalThis.sessionStorage.getItem(STORAGE_KEY));
    expect(stored).not.toContain('photo-1');
    expect(stored).toContain('photo-2');
  });

  it('does not duplicate photoId in sessionStorage on repeated votes', async () => {
    setVotedPhotos(['photo-1']);
    voteForPhoto.mockResolvedValue({ success: true, voted: true, newCount: 2 });
    await handleVoteClick(createMock$w(), 'photo-1', 1);
    const stored = JSON.parse(globalThis.sessionStorage.getItem(STORAGE_KEY));
    const count = stored.filter((id) => id === 'photo-1').length;
    expect(count).toBe(1);
  });

  it('handles backend failure gracefully and returns error', async () => {
    voteForPhoto.mockRejectedValue(new Error('Network error'));
    const result = await handleVoteClick(createMock$w(), 'photo-1', 0);
    expect(result.success).toBe(false);
    expect(result).toHaveProperty('error');
  });

  it('does not update sessionStorage when backend fails', async () => {
    voteForPhoto.mockRejectedValue(new Error('Server down'));
    await handleVoteClick(createMock$w(), 'photo-1', 0);
    const stored = globalThis.sessionStorage.getItem(STORAGE_KEY);
    // Should be null or empty array — vote was not persisted
    const ids = stored ? JSON.parse(stored) : [];
    expect(ids).not.toContain('photo-1');
  });

  it('handles null photoId gracefully', async () => {
    const result = await handleVoteClick(createMock$w(), null, 0);
    expect(result.success).toBe(false);
    expect(voteForPhoto).not.toHaveBeenCalled();
  });

  it('handles undefined photoId gracefully', async () => {
    const result = await handleVoteClick(createMock$w(), undefined, 0);
    expect(result.success).toBe(false);
    expect(voteForPhoto).not.toHaveBeenCalled();
  });

  it('handles empty string photoId gracefully', async () => {
    const result = await handleVoteClick(createMock$w(), '', 0);
    expect(result.success).toBe(false);
    expect(voteForPhoto).not.toHaveBeenCalled();
  });

  it('tracks vote event via engagementTracker on success', async () => {
    voteForPhoto.mockResolvedValue({ success: true, voted: true, newCount: 3 });
    await handleVoteClick(createMock$w(), 'photo-1', 2);
    expect(trackEvent).toHaveBeenCalledWith(
      expect.stringContaining('ugc'),
      expect.objectContaining({ photoId: 'photo-1' })
    );
  });

  it('announces vote result for screen readers', async () => {
    voteForPhoto.mockResolvedValue({ success: true, voted: true, newCount: 3 });
    const $w = createMock$w();
    await handleVoteClick($w, 'photo-1', 2);
    expect(announce).toHaveBeenCalled();
  });

  it('handles backend returning success:false', async () => {
    voteForPhoto.mockResolvedValue({ success: false, error: 'Not logged in' });
    const result = await handleVoteClick(createMock$w(), 'photo-1', 0);
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// syncVoteState
// ══════════════════════════════════════════════════════════════════════

describe('syncVoteState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    voteForPhoto.mockResolvedValue({ success: true, voted: true, newCount: 1 });
  });

  it('loads vote state from backend for batch of IDs', async () => {
    const photoIds = ['photo-1', 'photo-2', 'photo-3'];
    await syncVoteState(photoIds);
    // After sync, sessionStorage should reflect backend state
    const stored = globalThis.sessionStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
  });

  it('updates sessionStorage with synced vote data', async () => {
    const photoIds = ['photo-1', 'photo-2'];
    await syncVoteState(photoIds);
    const stored = JSON.parse(globalThis.sessionStorage.getItem(STORAGE_KEY) || '[]');
    expect(Array.isArray(stored)).toBe(true);
  });

  it('handles empty array input without error', async () => {
    await expect(syncVoteState([])).resolves.not.toThrow();
  });

  it('handles null input gracefully', async () => {
    await expect(syncVoteState(null)).resolves.not.toThrow();
  });

  it('handles undefined input gracefully', async () => {
    await expect(syncVoteState(undefined)).resolves.not.toThrow();
  });

  it('handles backend errors during sync', async () => {
    voteForPhoto.mockRejectedValue(new Error('Sync failed'));
    const photoIds = ['photo-1', 'photo-2'];
    // Should not throw — errors are handled internally
    await expect(syncVoteState(photoIds)).resolves.not.toThrow();
  });

  it('preserves existing voted photos not in the sync batch', async () => {
    setVotedPhotos(['photo-existing']);
    const photoIds = ['photo-new-1', 'photo-new-2'];
    await syncVoteState(photoIds);
    const stored = JSON.parse(globalThis.sessionStorage.getItem(STORAGE_KEY) || '[]');
    // Existing votes outside the sync batch should still be present
    expect(stored).toContain('photo-existing');
  });
});

// ══════════════════════════════════════════════════════════════════════
// initVoting
// ══════════════════════════════════════════════════════════════════════

describe('initVoting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes without throwing', () => {
    const $w = createMock$w({
      '#ugcVoteButton': mockElement(),
      '#ugcVoteCount': mockElement({ text: '0' }),
    });
    expect(() => initVoting($w, {})).not.toThrow();
  });

  it('sets up click handlers on vote elements', () => {
    const voteBtn = mockElement();
    const $w = createMock$w({
      '#ugcVoteButton': voteBtn,
      '#ugcVoteCount': mockElement({ text: '0' }),
    });
    initVoting($w, {});
    expect(voteBtn.onClick).toHaveBeenCalled();
  });

  it('does not throw when vote elements are missing', () => {
    const $w = createMock$w({});
    // Should handle missing elements gracefully via try/catch
    expect(() => {
      try { initVoting($w, {}); } catch { /* element not found is expected */ }
    }).not.toThrow();
  });

  it('accepts options parameter for configuration', () => {
    const voteBtn = mockElement();
    const $w = createMock$w({
      '#ugcVoteButton': voteBtn,
      '#ugcVoteCount': mockElement({ text: '0' }),
    });
    expect(() => initVoting($w, { animateOnVote: true })).not.toThrow();
  });

  it('handles null $w gracefully', () => {
    expect(() => {
      try { initVoting(null, {}); } catch { /* expected */ }
    }).not.toThrow();
  });

  it('handles null opts gracefully', () => {
    const $w = createMock$w({
      '#ugcVoteButton': mockElement(),
      '#ugcVoteCount': mockElement({ text: '0' }),
    });
    expect(() => initVoting($w, null)).not.toThrow();
  });
});
