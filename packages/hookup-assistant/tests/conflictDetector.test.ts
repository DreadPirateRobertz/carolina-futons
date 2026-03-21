/**
 * conflictDetector.test.ts — S11: Conflict Detector unit tests.
 *
 * Tests the pure detectConflict() function and the useConflictDetector hook.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { detectConflict, useConflictDetector } from '../src/hooks/useConflictDetector.js';

// ── detectConflict — pure function ─────────────────────────────────────────

describe('detectConflict — no existing nickname', () => {
  it('returns type=none when currentNickname is null', () => {
    const result = detectConflict(null, 'heroTitle');
    expect(result.type).toBe('none');
  });

  it('returns existingNickname=null when no nickname set', () => {
    const result = detectConflict(null, 'heroTitle');
    expect(result.existingNickname).toBeNull();
  });
});

describe('detectConflict — element already has correct ID', () => {
  it('returns type=already-set when nickname matches target', () => {
    const result = detectConflict('heroTitle', 'heroTitle');
    expect(result.type).toBe('already-set');
  });

  it('returns the existingNickname when already set', () => {
    const result = detectConflict('heroTitle', 'heroTitle');
    expect(result.existingNickname).toBe('heroTitle');
  });

  it('is case-sensitive — different casing is treated as conflict not already-set', () => {
    const result = detectConflict('HeroTitle', 'heroTitle');
    expect(result.type).toBe('conflict');
  });
});

describe('detectConflict — conflicting nickname', () => {
  it('returns type=conflict when element has a different nickname', () => {
    const result = detectConflict('oldId', 'heroTitle');
    expect(result.type).toBe('conflict');
  });

  it('returns the existing nickname in existingNickname field', () => {
    const result = detectConflict('oldId', 'heroTitle');
    expect(result.existingNickname).toBe('oldId');
  });

  it('detects conflict for any non-matching non-null nickname', () => {
    expect(detectConflict('a', 'b').type).toBe('conflict');
    expect(detectConflict('comp-123', 'heroTitle').type).toBe('conflict');
    expect(detectConflict('', 'heroTitle').type).toBe('conflict');
  });

  it('treats empty string existing nickname as a conflict with non-empty target', () => {
    const result = detectConflict('', 'heroTitle');
    expect(result.type).toBe('conflict');
    expect(result.existingNickname).toBe('');
  });
});

describe('detectConflict — target ID variations', () => {
  it('works for any target ID string', () => {
    expect(detectConflict(null, 'section_hero').type).toBe('none');
    expect(detectConflict('section_hero', 'section_hero').type).toBe('already-set');
    expect(detectConflict('other', 'section_hero').type).toBe('conflict');
  });
});

// ── useConflictDetector — hook state ───────────────────────────────────────

describe('useConflictDetector — initial state', () => {
  it('starts with pendingConflict=null', () => {
    const { result } = renderHook(() => useConflictDetector());
    expect(result.current.pendingConflict).toBeNull();
  });
});

describe('useConflictDetector — openConflict', () => {
  it('sets pendingConflict to the provided nickname', () => {
    const { result } = renderHook(() => useConflictDetector());
    act(() => {
      result.current.openConflict('existingId');
    });
    expect(result.current.pendingConflict).toBe('existingId');
  });

  it('overwrites a previous pending conflict', () => {
    const { result } = renderHook(() => useConflictDetector());
    act(() => {
      result.current.openConflict('first');
    });
    act(() => {
      result.current.openConflict('second');
    });
    expect(result.current.pendingConflict).toBe('second');
  });

  it('can be set to an empty string', () => {
    const { result } = renderHook(() => useConflictDetector());
    act(() => {
      result.current.openConflict('');
    });
    expect(result.current.pendingConflict).toBe('');
  });
});

describe('useConflictDetector — clearConflict', () => {
  it('resets pendingConflict to null', () => {
    const { result } = renderHook(() => useConflictDetector());
    act(() => {
      result.current.openConflict('someId');
    });
    act(() => {
      result.current.clearConflict();
    });
    expect(result.current.pendingConflict).toBeNull();
  });

  it('is idempotent — calling clear twice is safe', () => {
    const { result } = renderHook(() => useConflictDetector());
    act(() => {
      result.current.clearConflict();
      result.current.clearConflict();
    });
    expect(result.current.pendingConflict).toBeNull();
  });
});

describe('useConflictDetector — open → clear cycle', () => {
  it('can cycle open/clear multiple times', () => {
    const { result } = renderHook(() => useConflictDetector());

    act(() => { result.current.openConflict('id1'); });
    expect(result.current.pendingConflict).toBe('id1');

    act(() => { result.current.clearConflict(); });
    expect(result.current.pendingConflict).toBeNull();

    act(() => { result.current.openConflict('id2'); });
    expect(result.current.pendingConflict).toBe('id2');

    act(() => { result.current.clearConflict(); });
    expect(result.current.pendingConflict).toBeNull();
  });
});
