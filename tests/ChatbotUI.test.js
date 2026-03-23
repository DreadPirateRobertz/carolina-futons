/**
 * @file ChatbotUI.test.js
 * @description TDD tests for ChatbotUI.js — pure frontend helper functions.
 *
 * Covers:
 *  - formatThread: builds display string from sessionHistory array
 *  - formatLimitDisplay: "N messages remaining today" text
 *  - buildComingSoonState: returns state object for disabled flag
 *  - buildLimitReachedState: returns state object when daily limit hit
 *  - buildErrorState: returns state object for various error codes
 *  - buildLoadingState / buildReadyState: UI state toggles
 *  - shouldSkipAnimation: returns true when reduced motion
 */
import { describe, it, expect } from 'vitest';
import {
  formatThread,
  formatLimitDisplay,
  buildComingSoonState,
  buildLimitReachedState,
  buildErrorState,
  buildLoadingState,
  buildReadyState,
  shouldSkipAnimation,
} from '../src/public/ChatbotUI.js';

// ═══════════════════════════════════════════════════════════════════════
// formatThread
// ═══════════════════════════════════════════════════════════════════════

describe('formatThread', () => {
  it('returns empty string for empty history', () => {
    expect(formatThread([])).toBe('');
  });

  it('formats user turn with role marker', () => {
    const result = formatThread([{ role: 'user', content: 'hello' }]);
    expect(result).toContain('hello');
    expect(result).toContain('user');
  });

  it('formats assistant turn with role marker', () => {
    const result = formatThread([{ role: 'assistant', content: 'hi there' }]);
    expect(result).toContain('hi there');
    expect(result).toContain('assistant');
  });

  it('handles multi-turn history in order', () => {
    const result = formatThread([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ]);
    expect(result).toContain('q1');
    expect(result).toContain('a1');
    expect(result).toContain('q2');
    expect(result.indexOf('q1')).toBeLessThan(result.indexOf('a1'));
    expect(result.indexOf('a1')).toBeLessThan(result.indexOf('q2'));
  });

  it('handles null gracefully', () => {
    expect(formatThread(null)).toBe('');
  });

  it('handles undefined gracefully', () => {
    expect(formatThread(undefined)).toBe('');
  });

  it('handles turns with empty content', () => {
    const result = formatThread([{ role: 'user', content: '' }]);
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatLimitDisplay
// ═══════════════════════════════════════════════════════════════════════

describe('formatLimitDisplay', () => {
  it('returns correct plural for N > 1', () => {
    expect(formatLimitDisplay(5)).toBe('5 messages remaining today');
  });

  it('returns correct plural for 0', () => {
    expect(formatLimitDisplay(0)).toBe('0 messages remaining today');
  });

  it('returns singular "message" for 1', () => {
    expect(formatLimitDisplay(1)).toBe('1 message remaining today');
  });

  it('clamps negative input to 0', () => {
    expect(formatLimitDisplay(-1)).toBe('0 messages remaining today');
  });

  it('clamps large negative input to 0', () => {
    expect(formatLimitDisplay(-100)).toBe('0 messages remaining today');
  });

  it('floors fractional input', () => {
    expect(formatLimitDisplay(2.9)).toBe('2 messages remaining today');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// buildComingSoonState
// ═══════════════════════════════════════════════════════════════════════

describe('buildComingSoonState', () => {
  it('hides chatbotPanel and shows chatbotComingSoon', () => {
    const state = buildComingSoonState();
    expect(state.chatbotPanel).toBe('hidden');
    expect(state.chatbotComingSoon).toBe('visible');
  });

  it('disables input', () => {
    expect(buildComingSoonState().inputDisabled).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// buildLimitReachedState
// ═══════════════════════════════════════════════════════════════════════

describe('buildLimitReachedState', () => {
  it('disables input and send for messages limit', () => {
    const state = buildLimitReachedState('messages');
    expect(state.inputDisabled).toBe(true);
    expect(state.sendDisabled).toBe(true);
  });

  it('includes "Daily limit reached" and "midnight" in limitText', () => {
    const state = buildLimitReachedState('messages');
    expect(state.limitText).toContain('Daily limit reached');
    expect(state.limitText).toContain('midnight');
  });

  it('works for token limit variant', () => {
    const state = buildLimitReachedState('tokens');
    expect(state.inputDisabled).toBe(true);
    expect(state.sendDisabled).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// buildErrorState
// ═══════════════════════════════════════════════════════════════════════

describe('buildErrorState', () => {
  it('auth_required → contains "Sign in"', () => {
    expect(buildErrorState('auth_required').errorText).toContain('Sign in');
  });

  it('assistant_unavailable → contains "temporarily unavailable"', () => {
    expect(buildErrorState('assistant_unavailable').errorText).toContain('temporarily unavailable');
  });

  it('rate_limit_exceeded → contains "Too many requests"', () => {
    expect(buildErrorState('rate_limit_exceeded').errorText).toContain('Too many requests');
  });

  it('invalid_input → contains "enter a message"', () => {
    expect(buildErrorState('invalid_input').errorText).toContain('enter a message');
  });

  it('unknown code → returns a non-empty string', () => {
    const state = buildErrorState('totally_unknown');
    expect(typeof state.errorText).toBe('string');
    expect(state.errorText.length).toBeGreaterThan(0);
  });

  it('always returns sendDisabled false so user can retry', () => {
    expect(buildErrorState('assistant_unavailable').sendDisabled).toBe(false);
    expect(buildErrorState('rate_limit_exceeded').sendDisabled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// buildLoadingState
// ═══════════════════════════════════════════════════════════════════════

describe('buildLoadingState', () => {
  it('disables send and shows loading indicator', () => {
    const state = buildLoadingState();
    expect(state.sendDisabled).toBe(true);
    expect(state.loadingVisible).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// buildReadyState
// ═══════════════════════════════════════════════════════════════════════

describe('buildReadyState', () => {
  it('enables send and hides loading indicator', () => {
    const state = buildReadyState();
    expect(state.sendDisabled).toBe(false);
    expect(state.loadingVisible).toBe(false);
  });

  it('includes limitDisplay when provided', () => {
    const state = buildReadyState('3 messages remaining today');
    expect(state.limitDisplay).toBe('3 messages remaining today');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// shouldSkipAnimation
// ═══════════════════════════════════════════════════════════════════════

describe('shouldSkipAnimation', () => {
  it('returns true when prefersReducedMotion is true', () => {
    expect(shouldSkipAnimation(true)).toBe(true);
  });

  it('returns false when prefersReducedMotion is false', () => {
    expect(shouldSkipAnimation(false)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(shouldSkipAnimation(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(shouldSkipAnimation(null)).toBe(false);
  });
});
