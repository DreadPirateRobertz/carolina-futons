/**
 * pageNavigator.test.ts — S7: usePageNavigator + matchPageName unit tests.
 *
 * Covers:
 *  - matchPageName: exact, prefix, case-insensitive, unknown, empty
 *  - usePageNavigator: null when editor APIs absent
 *  - usePageNavigator: sets detectedPageName from pages.getCurrent()
 *  - usePageNavigator: updates on pageNavigated event
 *  - usePageNavigator: cleans up event listener on unmount
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { matchPageName, usePageNavigator } from '../src/hooks/usePageNavigator.js';

// ── Control knobs for the mocked @wix/editor ────────────────────────────────

const mockGetCurrent = vi.fn();
const mockAddEventListener = vi.fn();

// vi.mock is hoisted — it intercepts the dynamic import('@wix/editor') inside
// getEditorModule() for every test in this file.
vi.mock('@wix/editor', () => ({
  pages: { getCurrent: mockGetCurrent },
  events: { addEventListener: mockAddEventListener },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default: getCurrent resolves with null (page title unknown)
  mockGetCurrent.mockResolvedValue(null);
  // Default: addEventListener resolves with a no-op unsubscribe function
  mockAddEventListener.mockResolvedValue(() => {});
});

// ── matchPageName ───────────────────────────────────────────────────────────

describe('matchPageName — exact match', () => {
  it('matches "Home" exactly', () => {
    expect(matchPageName('Home')).toBe('Home');
  });

  it('is case-insensitive for exact matches', () => {
    expect(matchPageName('home')).toBe('Home');
    expect(matchPageName('HOME')).toBe('Home');
  });

  it('matches a multi-word page name exactly', () => {
    expect(matchPageName('Product Page')).toBe('Product Page');
  });

  it('returns null for an unknown title', () => {
    expect(matchPageName('Completely Unknown Page')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(matchPageName('')).toBeNull();
  });
});

describe('matchPageName — prefix match', () => {
  it('matches when the title starts with a known page name', () => {
    // "Home - Overview" — "Home" is the known prefix
    expect(matchPageName('Home - Overview')).toBe('Home');
  });

  it('prefers exact match over a prefix match', () => {
    // "Product Page" is an exact match and also a prefix of longer titles
    expect(matchPageName('Product Page')).toBe('Product Page');
  });
});

// ── usePageNavigator — no useful data ───────────────────────────────────────

describe('usePageNavigator — editor returns no page info', () => {
  it('returns null detectedPageName when getCurrent returns null', async () => {
    mockGetCurrent.mockResolvedValue(null);

    const { result } = renderHook(() => usePageNavigator());
    await waitFor(() => expect(mockGetCurrent).toHaveBeenCalled());

    expect(result.current.detectedPageName).toBeNull();
  });

  it('returns null when the page title does not match any known page', async () => {
    mockGetCurrent.mockResolvedValue({ title: 'Unknown Editor Page' });

    const { result } = renderHook(() => usePageNavigator());
    await waitFor(() => expect(mockGetCurrent).toHaveBeenCalled());

    expect(result.current.detectedPageName).toBeNull();
  });

  it('returns null without throwing when getCurrent rejects', async () => {
    mockGetCurrent.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => usePageNavigator());
    // Allow the effect to settle — should not throw
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.detectedPageName).toBeNull();
  });
});

// ── usePageNavigator — successful detection ──────────────────────────────────

describe('usePageNavigator — page detection', () => {
  it('sets detectedPageName when getCurrent resolves with a known page', async () => {
    mockGetCurrent.mockResolvedValue({ title: 'Home' });

    const { result } = renderHook(() => usePageNavigator());
    await waitFor(() => {
      expect(result.current.detectedPageName).toBe('Home');
    });
  });

  it('sets detectedPageName for a multi-word page name', async () => {
    mockGetCurrent.mockResolvedValue({ title: 'Product Page' });

    const { result } = renderHook(() => usePageNavigator());
    await waitFor(() => {
      expect(result.current.detectedPageName).toBe('Product Page');
    });
  });

  it('is case-insensitive when matching against PAGES', async () => {
    mockGetCurrent.mockResolvedValue({ title: 'home' });

    const { result } = renderHook(() => usePageNavigator());
    await waitFor(() => {
      expect(result.current.detectedPageName).toBe('Home');
    });
  });
});

// ── usePageNavigator — event listener ───────────────────────────────────────

describe('usePageNavigator — pageNavigated event', () => {
  it('subscribes to "pageNavigated" on mount', async () => {
    mockGetCurrent.mockResolvedValue(null);

    renderHook(() => usePageNavigator());
    await waitFor(() => expect(mockAddEventListener).toHaveBeenCalled());

    expect(mockAddEventListener).toHaveBeenCalledWith('pageNavigated', expect.any(Function));
  });

  it('updates detectedPageName when pageNavigated callback fires', async () => {
    mockGetCurrent
      .mockResolvedValueOnce({ title: 'Home' })           // initial getCurrent
      .mockResolvedValueOnce({ title: 'Product Page' });   // getCurrent after navigation

    let capturedCb: (() => Promise<void>) | null = null;
    mockAddEventListener.mockImplementation(async (_name: string, cb: () => Promise<void>) => {
      capturedCb = cb;
      return () => {};
    });

    const { result } = renderHook(() => usePageNavigator());

    // Wait for initial detection
    await waitFor(() => {
      expect(result.current.detectedPageName).toBe('Home');
    });

    // Simulate page navigation
    await act(async () => {
      if (capturedCb) await capturedCb();
    });

    await waitFor(() => {
      expect(result.current.detectedPageName).toBe('Product Page');
    });
  });

  it('calls the returned unsubscribe function on unmount', async () => {
    const mockOff = vi.fn();
    mockGetCurrent.mockResolvedValue(null);
    mockAddEventListener.mockResolvedValue(mockOff);

    const { unmount } = renderHook(() => usePageNavigator());
    await waitFor(() => expect(mockAddEventListener).toHaveBeenCalled());

    unmount();
    expect(mockOff).toHaveBeenCalledTimes(1);
  });
});
