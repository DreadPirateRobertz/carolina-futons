/**
 * @file exitIntentLightbox.test.js
 * @description Tests for openExitIntentLightbox (CF-4mof T8).
 *
 * openExitIntentLightbox: calls wix-window-frontend openLightbox with
 * 'exitIntentLightbox' as the lightbox name. Uses dynamic import so the
 * module stays testable without Wix DOM.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { openExitIntentLightbox } from '../src/public/exitIntentCapture.js';

// The wix-window-frontend mock is auto-resolved by vitest.config.js
// It provides openLightbox as vi.fn()

// ─── helpers ───────────────────────────────────────────────────────

async function getOpenLightboxMock() {
  const mod = await import('wix-window-frontend');
  return mod.openLightbox;
}

// ═══════════════════════════════════════════════════════════════════
// openExitIntentLightbox — basic behavior
// ═══════════════════════════════════════════════════════════════════

describe('openExitIntentLightbox', () => {
  beforeEach(async () => {
    const openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  it('calls openLightbox with "exitIntentLightbox"', async () => {
    await openExitIntentLightbox({});
    const openLightbox = await getOpenLightboxMock();
    expect(openLightbox).toHaveBeenCalledWith('exitIntentLightbox', expect.anything());
  });

  it('passes data object to openLightbox', async () => {
    const data = { offer: '10% off', source: 'cursor_leave' };
    await openExitIntentLightbox(data);
    const openLightbox = await getOpenLightboxMock();
    expect(openLightbox).toHaveBeenCalledWith('exitIntentLightbox', data);
  });

  it('passes empty object when data is not provided', async () => {
    await openExitIntentLightbox();
    const openLightbox = await getOpenLightboxMock();
    expect(openLightbox).toHaveBeenCalledWith('exitIntentLightbox', {});
  });

  it('passes empty object when data is undefined', async () => {
    await openExitIntentLightbox(undefined);
    const openLightbox = await getOpenLightboxMock();
    expect(openLightbox).toHaveBeenCalledWith('exitIntentLightbox', {});
  });

  it('passes empty object when data is null', async () => {
    await openExitIntentLightbox(null);
    const openLightbox = await getOpenLightboxMock();
    expect(openLightbox).toHaveBeenCalledWith('exitIntentLightbox', {});
  });

  it('resolves without throwing on success', async () => {
    await expect(openExitIntentLightbox({})).resolves.not.toThrow();
  });

  it('called exactly once per invocation', async () => {
    await openExitIntentLightbox({});
    const openLightbox = await getOpenLightboxMock();
    expect(openLightbox).toHaveBeenCalledTimes(1);
  });

  it('supports calling multiple times independently', async () => {
    await openExitIntentLightbox({ round: 1 });
    await openExitIntentLightbox({ round: 2 });
    const openLightbox = await getOpenLightboxMock();
    expect(openLightbox).toHaveBeenCalledTimes(2);
    expect(openLightbox).toHaveBeenNthCalledWith(1, 'exitIntentLightbox', { round: 1 });
    expect(openLightbox).toHaveBeenNthCalledWith(2, 'exitIntentLightbox', { round: 2 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// openExitIntentLightbox — error resilience
// ═══════════════════════════════════════════════════════════════════

describe('openExitIntentLightbox — error resilience', () => {
  it('does not throw when openLightbox rejects', async () => {
    const openLightbox = await getOpenLightboxMock();
    openLightbox.mockRejectedValueOnce(new Error('Lightbox element not found'));
    await expect(openExitIntentLightbox({})).resolves.not.toThrow();
  });

  it('does not throw when openLightbox throws synchronously', async () => {
    const openLightbox = await getOpenLightboxMock();
    openLightbox.mockImplementationOnce(() => { throw new Error('sync error'); });
    await expect(openExitIntentLightbox({})).resolves.not.toThrow();
  });
});
