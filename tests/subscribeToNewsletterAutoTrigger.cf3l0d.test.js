/**
 * @file subscribeToNewsletterAutoTrigger.cf3l0d.test.js
 * @description cf-3l0d (Option B) — subscribeToNewsletter auto-triggers the
 * welcome series. Pre-staged for merge as soon as cf-xdji ships
 * resolveContactId at backend/contacts/contactResolver.web.
 *
 * Verifies:
 *   - subscribeToNewsletter calls resolveContactId then triggerWelcomeSequence
 *   - The trigger is non-blocking — a welcome failure does NOT fail subscribe
 *   - Repeat subscribe does not double-queue (dedup belongs to
 *     triggerWelcomeSequence; this test asserts it's still consulted)
 *   - resolveContactId returning empty/falsy short-circuits the trigger
 *     without raising
 *   - Existing subscriber path (silent dedup) does NOT fire a welcome trigger
 *     (already returns success without inserting a new subscriber row)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cf-xdji helper that doesn't exist on main yet — this branch is
// pre-staged. When cf-xdji merges, the dynamic import in
// _triggerWelcomeFlowInternal will resolve against the real file; tests use
// these mocks regardless.
vi.mock('backend/contacts/contactResolver.web', () => ({
  resolveContactId: vi.fn(),
}));

// Mock triggerWelcomeSequence so we can assert it was/wasn't called and
// inspect its argument shape without exercising the full queue insertion path.
vi.mock('backend/emailAutomation.web', () => ({
  triggerWelcomeSequence: vi.fn().mockResolvedValue({ success: true, queued: 3 }),
}));

import { __reset as resetData } from './__mocks__/wix-data.js';
import { __reset as resetCrm } from './__mocks__/wix-crm-backend.js';
import { __reset as resetMarketing } from './__mocks__/wix-marketing-backend.js';
import { __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetFetch } from './__mocks__/wix-fetch.js';
import { __reset as resetMember, __setMember } from './__mocks__/wix-members-backend.js';

import { subscribeToNewsletter } from '../src/backend/newsletterService.web.js';
import { resolveContactId } from 'backend/contacts/contactResolver.web';
import { triggerWelcomeSequence } from 'backend/emailAutomation.web';

beforeEach(() => {
  resetData();
  resetCrm();
  resetMarketing();
  resetSecrets();
  resetFetch();
  resetMember();
  __setMember({ loginEmail: 'user@example.com' });
  vi.mocked(resolveContactId).mockReset();
  vi.mocked(triggerWelcomeSequence).mockReset();
  vi.mocked(triggerWelcomeSequence).mockResolvedValue({ success: true, queued: 3 });
});

// Drain the .catch microtask queue that swallows non-blocking trigger errors,
// so test assertions see the resulting state.
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('cf-3l0d · subscribeToNewsletter auto-triggers welcome series', () => {
  it('resolves a contactId and calls triggerWelcomeSequence on success', async () => {
    vi.mocked(resolveContactId).mockResolvedValue('contact-abc');

    const result = await subscribeToNewsletter('shopper@example.com', { source: 'footer' });
    await flushMicrotasks();

    expect(result.success).toBe(true);
    expect(vi.mocked(resolveContactId)).toHaveBeenCalledWith('shopper@example.com', '');
    expect(vi.mocked(triggerWelcomeSequence)).toHaveBeenCalledWith('contact-abc', 'shopper@example.com', '');
  });

  it('does not fire the welcome trigger for an already-subscribed email (silent dedup branch)', async () => {
    // Seed an existing subscriber by calling once, then assert second call
    // takes the dedup branch and does not re-trigger.
    vi.mocked(resolveContactId).mockResolvedValue('contact-abc');

    await subscribeToNewsletter('dupe@example.com');
    await flushMicrotasks();
    vi.mocked(triggerWelcomeSequence).mockClear();
    vi.mocked(resolveContactId).mockClear();

    const second = await subscribeToNewsletter('dupe@example.com');
    await flushMicrotasks();

    expect(second.success).toBe(true);
    expect(vi.mocked(resolveContactId)).not.toHaveBeenCalled();
    expect(vi.mocked(triggerWelcomeSequence)).not.toHaveBeenCalled();
  });

  it('still returns success when resolveContactId throws (non-blocking)', async () => {
    vi.mocked(resolveContactId).mockRejectedValue(new Error('CRM unavailable'));
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await subscribeToNewsletter('shopper@example.com');
    await flushMicrotasks();

    expect(result.success).toBe(true);
    expect(vi.mocked(triggerWelcomeSequence)).not.toHaveBeenCalled();
    // Warning is logged so silent-failure-hunter sees it.
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('welcome auto-trigger failed'),
      expect.any(String),
    );
    consoleWarn.mockRestore();
  });

  it('still returns success when triggerWelcomeSequence throws (non-blocking)', async () => {
    vi.mocked(resolveContactId).mockResolvedValue('contact-abc');
    vi.mocked(triggerWelcomeSequence).mockRejectedValue(new Error('queue insert failed'));
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await subscribeToNewsletter('shopper@example.com');
    await flushMicrotasks();

    expect(result.success).toBe(true);
    consoleWarn.mockRestore();
  });

  it('skips triggerWelcomeSequence when resolveContactId returns empty', async () => {
    // resolveContactId returns '' — defensive branch in the helper warns and
    // exits without invoking the welcome trigger.
    vi.mocked(resolveContactId).mockResolvedValue('');
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await subscribeToNewsletter('shopper@example.com');
    await flushMicrotasks();

    expect(result.success).toBe(true);
    expect(vi.mocked(triggerWelcomeSequence)).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('welcome auto-trigger skipped'),
      expect.any(Object),
    );
    consoleWarn.mockRestore();
  });
});
