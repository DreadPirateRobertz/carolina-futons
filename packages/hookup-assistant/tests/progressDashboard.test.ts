/**
 * progressDashboard.test.ts — useProgressDashboard hook unit tests.
 *
 * S8: Tests for global progress reading, session delta, and reset functions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProgressDashboard } from '../src/hooks/useProgressDashboard.js';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// ── Initial state ─────────────────────────────────────────────────────────────

describe('useProgressDashboard — initial state', () => {
  it('returns a pages array with at least one entry', () => {
    const { result } = renderHook(() => useProgressDashboard());
    expect(result.current.pages.length).toBeGreaterThan(0);
  });

  it('each page has name, priority, total, hooked, skipped', () => {
    const { result } = renderHook(() => useProgressDashboard());
    const page = result.current.pages[0];
    expect(page).toHaveProperty('name');
    expect(page).toHaveProperty('priority');
    expect(page).toHaveProperty('total');
    expect(typeof page.hooked).toBe('number');
    expect(typeof page.skipped).toBe('number');
  });

  it('totalHooked is 0 when localStorage is empty', () => {
    const { result } = renderHook(() => useProgressDashboard());
    expect(result.current.totalHooked).toBe(0);
  });

  it('totalElements is > 0', () => {
    const { result } = renderHook(() => useProgressDashboard());
    expect(result.current.totalElements).toBeGreaterThan(0);
  });

  it('sessionHooked is 0 at mount with empty localStorage', () => {
    const { result } = renderHook(() => useProgressDashboard());
    expect(result.current.sessionHooked).toBe(0);
  });
});

// ── resetPage ─────────────────────────────────────────────────────────────────

describe('useProgressDashboard — resetPage', () => {
  it('clears hooked and skipped for the target page', () => {
    // Seed localStorage for Home
    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle', 'heroCTA']);
    store['cf-hookup-home-skipped'] = JSON.stringify(['heroBg']);

    const { result } = renderHook(() => useProgressDashboard());
    const homeBefore = result.current.pages.find((p) => p.name === 'Home')!;
    expect(homeBefore.hooked).toBe(2);
    expect(homeBefore.skipped).toBe(1);

    act(() => result.current.resetPage('Home'));

    const homeAfter = result.current.pages.find((p) => p.name === 'Home')!;
    expect(homeAfter.hooked).toBe(0);
    expect(homeAfter.skipped).toBe(0);
  });

  it('writes empty arrays to localStorage after reset', () => {
    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle']);
    const { result } = renderHook(() => useProgressDashboard());

    act(() => result.current.resetPage('Home'));

    const saved = localStorageMock.getItem('cf-hookup-home-hooked');
    expect(JSON.parse(saved!)).toEqual([]);
  });

  it('does not affect other pages', () => {
    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle']);
    store['cf-hookup-product-page-hooked'] = JSON.stringify(['productTitle', 'addToCart']);

    const { result } = renderHook(() => useProgressDashboard());
    act(() => result.current.resetPage('Home'));

    const product = result.current.pages.find((p) => p.name === 'Product Page')!;
    expect(product.hooked).toBe(2);
  });

  it('updates totalHooked after reset', () => {
    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle', 'heroCTA']);
    const { result } = renderHook(() => useProgressDashboard());
    expect(result.current.totalHooked).toBe(2);

    act(() => result.current.resetPage('Home'));
    expect(result.current.totalHooked).toBe(0);
  });
});

// ── resetAll ──────────────────────────────────────────────────────────────────

describe('useProgressDashboard — resetAll', () => {
  it('clears all pages', () => {
    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle']);
    store['cf-hookup-product-page-hooked'] = JSON.stringify(['productTitle']);

    const { result } = renderHook(() => useProgressDashboard());
    expect(result.current.totalHooked).toBe(2);

    act(() => result.current.resetAll());
    expect(result.current.totalHooked).toBe(0);
  });

  it('sets totalHooked to 0 after resetAll', () => {
    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle', 'heroCTA', 'heroBg']);
    const { result } = renderHook(() => useProgressDashboard());

    act(() => result.current.resetAll());
    expect(result.current.totalHooked).toBe(0);
  });
});

// ── sessionHooked ─────────────────────────────────────────────────────────────

describe('useProgressDashboard — sessionHooked', () => {
  it('reflects elements added after mount via refresh', () => {
    const { result } = renderHook(() => useProgressDashboard());
    // Baseline: 0 hooked at mount

    // Simulate external progress (e.g., markHooked in another hook instance)
    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle', 'heroCTA']);

    act(() => result.current.refresh());
    expect(result.current.sessionHooked).toBe(2);
  });

  it('sessionHooked is 0 when nothing new is added after mount', () => {
    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle']);
    const { result } = renderHook(() => useProgressDashboard());
    // Baseline captured with 1 hooked
    expect(result.current.sessionHooked).toBe(0);
  });

  it('does not go negative when progress is reset', () => {
    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle', 'heroCTA']);
    const { result } = renderHook(() => useProgressDashboard());
    // Baseline: 2 hooked

    act(() => result.current.resetPage('Home'));
    // After reset: hooked = 0, baseline = 2 → delta = max(0, 0-2) = 0
    expect(result.current.sessionHooked).toBe(0);
  });
});

// ── refresh ───────────────────────────────────────────────────────────────────

describe('useProgressDashboard — refresh', () => {
  it('re-reads pages from localStorage after external changes', () => {
    const { result } = renderHook(() => useProgressDashboard());
    expect(result.current.totalHooked).toBe(0);

    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle']);
    act(() => result.current.refresh());

    expect(result.current.totalHooked).toBe(1);
  });
});
