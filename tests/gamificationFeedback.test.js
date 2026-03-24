/**
 * @file gamificationFeedback.test.js
 * @description TDD tests for gamificationFeedback module.
 *
 * Covers:
 *  - buildFeedbackText: priority order (milestone > tier > badge > pts), null guards
 *  - showGamificationFeedback: DOM wiring, reducedMotion, auto-dismiss, no-op guards
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFeedbackText, showGamificationFeedback } from '../src/public/gamificationFeedback.js';

// ── buildFeedbackText ─────────────────────────────────────────────────────────

describe('buildFeedbackText', () => {
  it('returns null for null result', () => {
    expect(buildFeedbackText(null)).toBeNull();
  });

  it('returns null when result.success is false', () => {
    expect(buildFeedbackText({ success: false, pointsEarned: 5 })).toBeNull();
  });

  it('returns null when success true but zero points and no special events', () => {
    expect(buildFeedbackText({ success: true, pointsEarned: 0 })).toBeNull();
  });

  it('returns null when success true with undefined pointsEarned and no events', () => {
    expect(buildFeedbackText({ success: true })).toBeNull();
  });

  it('shows +pts · Milestone when milestoneUnlocked and pointsEarned > 0', () => {
    const text = buildFeedbackText({ success: true, milestoneUnlocked: true, pointsEarned: 105 });
    expect(text).toContain('+105 pts');
    expect(text).toContain('Milestone');
  });

  it('shows Milestone without pts prefix when pointsEarned is 0', () => {
    const text = buildFeedbackText({ success: true, milestoneUnlocked: true, pointsEarned: 0 });
    expect(text).toContain('Milestone');
    expect(text).not.toMatch(/\+0/);
  });

  it('milestoneUnlocked beats tierChanged', () => {
    const text = buildFeedbackText({
      success: true, milestoneUnlocked: true,
      tierChanged: true, newTier: 'Mountain Guide', pointsEarned: 10,
    });
    expect(text).toContain('Milestone');
    expect(text).not.toContain('Tier up');
  });

  it('milestoneUnlocked beats badgeUnlocked', () => {
    const text = buildFeedbackText({
      success: true, milestoneUnlocked: true,
      badgeUnlocked: 'week_wanderer', pointsEarned: 10,
    });
    expect(text).toContain('Milestone');
    expect(text).not.toContain('badge');
  });

  it('shows tier change when tierChanged and no milestone', () => {
    const text = buildFeedbackText({ success: true, tierChanged: true, newTier: 'Mountain Guide' });
    expect(text).toContain('Mountain Guide');
    expect(text).toContain('Tier up');
  });

  it('shows +pts · badge unlock when badgeUnlocked and pointsEarned > 0', () => {
    const text = buildFeedbackText({ success: true, badgeUnlocked: 'week_wanderer', pointsEarned: 50 });
    expect(text).toContain('+50 pts');
    expect(text).toContain('badge');
  });

  it('shows badge unlock without pts prefix when pointsEarned is 0', () => {
    const text = buildFeedbackText({ success: true, badgeUnlocked: 'week_wanderer', pointsEarned: 0 });
    expect(text).toContain('badge');
    expect(text).not.toMatch(/\+0/);
  });

  it('shows simple pts message when only pointsEarned > 0', () => {
    expect(buildFeedbackText({ success: true, pointsEarned: 5 })).toBe('+5 pts earned');
  });
});

// ── showGamificationFeedback ──────────────────────────────────────────────────

describe('showGamificationFeedback', () => {
  function makeWix({ hasToast = true, hasText = true } = {}) {
    const toastEl = { text: '', show: vi.fn(), hide: vi.fn() };
    const textEl = { text: '' };
    const mock$w = (sel) => {
      if (sel === '#gamificationToast') return hasToast ? toastEl : null;
      if (sel === '#gamificationToastText') return hasText ? textEl : null;
      return null;
    };
    return { mock$w, toastEl, textEl };
  }

  const validResult = { success: true, pointsEarned: 5 };

  it('does not throw when $w is null', () => {
    expect(() => showGamificationFeedback(null, validResult)).not.toThrow();
  });

  it('does not throw when result is null', () => {
    const { mock$w } = makeWix();
    expect(() => showGamificationFeedback(mock$w, null)).not.toThrow();
  });

  it('does not throw when result.success is false', () => {
    const { mock$w } = makeWix();
    expect(() => showGamificationFeedback(mock$w, { success: false })).not.toThrow();
  });

  it('does not throw when toast element is missing', () => {
    const { mock$w } = makeWix({ hasToast: false });
    expect(() => showGamificationFeedback(mock$w, validResult)).not.toThrow();
  });

  it('does not throw when toast text element is missing', () => {
    const { mock$w } = makeWix({ hasText: false });
    expect(() => showGamificationFeedback(mock$w, validResult)).not.toThrow();
  });

  it('sets text and calls show for valid result', () => {
    const { mock$w, toastEl, textEl } = makeWix();
    showGamificationFeedback(mock$w, validResult);
    expect(textEl.text).toBe('+5 pts earned');
    expect(toastEl.show).toHaveBeenCalled();
  });

  it('calls show with slide animation by default (reducedMotion false)', () => {
    const { mock$w, toastEl } = makeWix();
    showGamificationFeedback(mock$w, validResult);
    expect(toastEl.show).toHaveBeenCalledWith('slide', { duration: 300, direction: 'bottom' });
  });

  it('calls show without animation args when reducedMotion is true', () => {
    const { mock$w, toastEl } = makeWix();
    showGamificationFeedback(mock$w, validResult, { reducedMotion: true });
    expect(toastEl.show).toHaveBeenCalledWith();
  });

  it('is a no-op when no displayable event (zero pts, no tier/badge/milestone)', () => {
    const { mock$w, toastEl } = makeWix();
    showGamificationFeedback(mock$w, { success: true, pointsEarned: 0 });
    expect(toastEl.show).not.toHaveBeenCalled();
  });

  it('accepts custom toastId + toastTextId from options', () => {
    const customToastEl = { text: '', show: vi.fn(), hide: vi.fn() };
    const customTextEl = { text: '' };
    const mock$w = (sel) => {
      if (sel === '#myToast') return customToastEl;
      if (sel === '#myToastText') return customTextEl;
      return null;
    };
    showGamificationFeedback(mock$w, validResult, {
      toastId: '#myToast',
      toastTextId: '#myToastText',
    });
    expect(customToastEl.show).toHaveBeenCalled();
    expect(customTextEl.text).toBe('+5 pts earned');
  });

  it('auto-dismisses after 3s for non-milestone', () => {
    vi.useFakeTimers();
    const { mock$w, toastEl } = makeWix();
    showGamificationFeedback(mock$w, validResult);
    expect(toastEl.hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(toastEl.hide).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('auto-dismisses after 5s for milestone result', () => {
    vi.useFakeTimers();
    const { mock$w, toastEl } = makeWix();
    showGamificationFeedback(mock$w, { success: true, milestoneUnlocked: true, pointsEarned: 100 });
    vi.advanceTimersByTime(3000);
    expect(toastEl.hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(toastEl.hide).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
