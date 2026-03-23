/**
 * shippingPrefs.test.js
 *
 * Unit tests for src/public/shippingPrefs.js (cf-63x)
 *
 * Covers:
 *  - ZIP_KEY is the canonical 'cf_shipping_zip'
 *  - getStoredZip: returns stored value from injectable storage
 *  - getStoredZip: returns null when nothing stored
 *  - setStoredZip: writes ZIP to injectable storage
 *  - setStoredZip: does not throw when member save fails
 *  - clearStoredZip: removes the ZIP key from storage
 *  - saveMemberZip: skips when user is not logged in
 *  - saveMemberZip: calls updateCurrentMember with correct extended field when logged in
 *  - saveMemberZip: swallows errors silently
 *  - loadMemberZip: returns null when user is not logged in
 *  - loadMemberZip: returns ZIP from member extended fields when logged in
 *  - loadMemberZip: hydrates local storage after loading from member profile
 *  - loadMemberZip: returns null when getMember throws
 *  - loadMemberZip: skips local-storage hydration when storage=null passed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ZIP_KEY,
  getStoredZip,
  setStoredZip,
  clearStoredZip,
  saveMemberZip,
  loadMemberZip,
} from '../src/public/shippingPrefs.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem:    vi.fn(k => store[k] ?? null),
    setItem:    vi.fn((k, v) => { store[k] = String(v); }),
    removeItem: vi.fn(k => { delete store[k]; }),
    _store: store,
  };
}

// ── Wix module mocks ──────────────────────────────────────────────────────────

const mockUpdateCurrentMember = vi.fn();
const mockGetMember            = vi.fn();
const mockLoggedIn             = vi.fn();

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    updateCurrentMember: mockUpdateCurrentMember,
    getMember:           mockGetMember,
  },
  authentication: {
    loggedIn: mockLoggedIn,
  },
}));

vi.mock('wix-storage-frontend', () => ({
  local: makeStorage(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockLoggedIn.mockResolvedValue(false);
  mockUpdateCurrentMember.mockResolvedValue(undefined);
  mockGetMember.mockResolvedValue(null);
});

// ── ZIP_KEY ───────────────────────────────────────────────────────────────────

describe('ZIP_KEY', () => {
  it("is 'cf_shipping_zip'", () => {
    expect(ZIP_KEY).toBe('cf_shipping_zip');
  });
});

// ── getStoredZip ──────────────────────────────────────────────────────────────

describe('getStoredZip', () => {
  it('returns stored ZIP from injectable storage', async () => {
    const storage = makeStorage({ [ZIP_KEY]: '28792' });
    expect(await getStoredZip(storage)).toBe('28792');
  });

  it('returns null when nothing is stored', async () => {
    const storage = makeStorage();
    expect(await getStoredZip(storage)).toBeNull();
  });
});

// ── setStoredZip ──────────────────────────────────────────────────────────────

describe('setStoredZip', () => {
  it('writes the ZIP to injectable storage under ZIP_KEY', async () => {
    const storage = makeStorage();
    await setStoredZip('28701', storage);
    expect(storage.setItem).toHaveBeenCalledWith(ZIP_KEY, '28701');
  });

  it('does not throw when the member-profile save fails', async () => {
    mockLoggedIn.mockResolvedValue(true);
    mockUpdateCurrentMember.mockRejectedValue(new Error('Wix API error'));
    const storage = makeStorage();
    await expect(setStoredZip('28701', storage)).resolves.toBeUndefined();
  });
});

// ── clearStoredZip ────────────────────────────────────────────────────────────

describe('clearStoredZip', () => {
  it('removes the ZIP key from storage', async () => {
    const storage = makeStorage({ [ZIP_KEY]: '28792' });
    await clearStoredZip(storage);
    expect(storage.removeItem).toHaveBeenCalledWith(ZIP_KEY);
    expect(storage._store[ZIP_KEY]).toBeUndefined();
  });
});

// ── saveMemberZip ─────────────────────────────────────────────────────────────

describe('saveMemberZip', () => {
  it('does nothing when the user is not logged in', async () => {
    mockLoggedIn.mockResolvedValue(false);
    await saveMemberZip('28792');
    expect(mockUpdateCurrentMember).not.toHaveBeenCalled();
  });

  it('calls updateCurrentMember with the correct extended field when logged in', async () => {
    mockLoggedIn.mockResolvedValue(true);
    await saveMemberZip('28792');
    expect(mockUpdateCurrentMember).toHaveBeenCalledWith({
      extendedFields: { 'custom.shippingZip': '28792' },
    });
  });

  it('swallows errors silently', async () => {
    mockLoggedIn.mockRejectedValue(new Error('auth failure'));
    await expect(saveMemberZip('28792')).resolves.toBeUndefined();
  });
});

// ── loadMemberZip ─────────────────────────────────────────────────────────────

describe('loadMemberZip', () => {
  it('returns null when the user is not logged in', async () => {
    mockLoggedIn.mockResolvedValue(false);
    expect(await loadMemberZip()).toBeNull();
  });

  it('returns ZIP from member extendedFields when logged in', async () => {
    mockLoggedIn.mockResolvedValue(true);
    mockGetMember.mockResolvedValue({
      extendedFields: { 'custom.shippingZip': '28792' },
    });
    const storage = makeStorage();
    expect(await loadMemberZip(storage)).toBe('28792');
  });

  it('hydrates local storage after reading from member profile', async () => {
    mockLoggedIn.mockResolvedValue(true);
    mockGetMember.mockResolvedValue({
      extendedFields: { 'custom.shippingZip': '28792' },
    });
    const storage = makeStorage();
    await loadMemberZip(storage);
    expect(storage.setItem).toHaveBeenCalledWith(ZIP_KEY, '28792');
  });

  it('returns null and does not throw when getMember throws', async () => {
    mockLoggedIn.mockResolvedValue(true);
    mockGetMember.mockRejectedValue(new Error('getMember failed'));
    await expect(loadMemberZip()).resolves.toBeNull();
  });

  it('skips local-storage hydration when storage=null is passed', async () => {
    mockLoggedIn.mockResolvedValue(true);
    mockGetMember.mockResolvedValue({
      extendedFields: { 'custom.shippingZip': '28792' },
    });
    // Should not throw despite no storage object
    await expect(loadMemberZip(null)).resolves.toBe('28792');
  });
});
