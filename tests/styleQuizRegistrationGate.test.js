/**
 * styleQuizRegistrationGate.test.js
 * CF-009p — Registration gate after Style Quiz completion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initStyleQuizRegistrationGate } from '../src/public/StyleQuizRegistrationGate.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const MEMBER = { _id: 'mem-quiz-1', contactDetails: { firstName: 'Alex' } };

function makeEl() {
  return {
    text: '',
    expand: vi.fn(),
    collapse: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
  };
}

function make$w() {
  const els = {
    '#quizRegistrationGate': makeEl(),
    '#quizRegCta': makeEl(),
    '#quizRegDismiss': makeEl(),
  };
  return vi.fn((id) => els[id] ?? makeEl());
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('initStyleQuizRegistrationGate', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('skips gate silently for logged-in members', async () => {
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => MEMBER,
    });
    expect($w('#quizRegistrationGate').expand).not.toHaveBeenCalled();
  });

  it('shows gate for non-logged-in visitors', async () => {
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => null,
    });
    expect($w('#quizRegistrationGate').expand).toHaveBeenCalled();
  });

  it('shows gate when getMember throws', async () => {
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => { throw new Error('auth unavailable'); },
    });
    expect($w('#quizRegistrationGate').expand).toHaveBeenCalled();
  });

  it('wires CTA button onClick', async () => {
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => null,
    });
    expect($w('#quizRegCta').onClick).toHaveBeenCalled();
  });

  it('wires dismiss button onClick', async () => {
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => null,
    });
    expect($w('#quizRegDismiss').onClick).toHaveBeenCalled();
  });

  it('dismiss collapses the gate', async () => {
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => null,
    });
    const handler = $w('#quizRegDismiss').onClick.mock.calls[0][0];
    handler();
    expect($w('#quizRegistrationGate').collapse).toHaveBeenCalled();
  });

  it('CTA calls promptLogin', async () => {
    const promptLogin = vi.fn();
    let getMemberCall = 0;
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => {
        getMemberCall++;
        return getMemberCall === 1 ? null : MEMBER; // first call: not logged in, second: logged in
      },
      promptLogin,
    });
    const handler = $w('#quizRegCta').onClick.mock.calls[0][0];
    await handler();
    expect(promptLogin).toHaveBeenCalled();
  });

  it('collapses gate after successful login', async () => {
    let getMemberCall = 0;
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => {
        getMemberCall++;
        return getMemberCall === 1 ? null : MEMBER;
      },
      promptLogin: vi.fn(),
    });
    const handler = $w('#quizRegCta').onClick.mock.calls[0][0];
    await handler();
    expect($w('#quizRegistrationGate').collapse).toHaveBeenCalled();
  });

  it('calls onRegistered callback with memberId after login', async () => {
    const onRegistered = vi.fn();
    let getMemberCall = 0;
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => {
        getMemberCall++;
        return getMemberCall === 1 ? null : MEMBER;
      },
      promptLogin: vi.fn(),
      onRegistered,
    });
    const handler = $w('#quizRegCta').onClick.mock.calls[0][0];
    await handler();
    expect(onRegistered).toHaveBeenCalledWith('mem-quiz-1');
  });

  it('does not collapse gate if login was cancelled (still no member)', async () => {
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => null, // always returns null
      promptLogin: vi.fn(),
    });
    const handler = $w('#quizRegCta').onClick.mock.calls[0][0];
    await handler();
    expect($w('#quizRegistrationGate').collapse).not.toHaveBeenCalled();
  });

  it('does not call onRegistered if login was cancelled', async () => {
    const onRegistered = vi.fn();
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => null,
      promptLogin: vi.fn(),
      onRegistered,
    });
    const handler = $w('#quizRegCta').onClick.mock.calls[0][0];
    await handler();
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it('does not throw when gate element is absent', async () => {
    const empty$w = vi.fn(() => { throw new Error('Element not found'); });
    await expect(
      initStyleQuizRegistrationGate({ $w: empty$w, getMember: async () => null })
    ).resolves.not.toThrow();
  });

  it('sets registration CTA text with bonus points', async () => {
    await initStyleQuizRegistrationGate({
      $w,
      getMember: async () => null,
    });
    expect($w('#quizRegistrationGate').text).toContain('100 bonus points');
  });
});
