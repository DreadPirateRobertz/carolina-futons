/**
 * Tests for pwaHelpers.js — PWA service worker and install prompt utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerServiceWorker,
  captureInstallPrompt,
  canShowInstallPrompt,
  showInstallPrompt,
  isInstalledPWA,
  __resetPrompt,
} from '../src/public/pwaHelpers.js';

describe('registerServiceWorker', () => {
  it('returns null when navigator is undefined', async () => {
    const origNav = globalThis.navigator;
    delete globalThis.navigator;
    const result = await registerServiceWorker();
    expect(result).toBeNull();
    globalThis.navigator = origNav;
  });

  it('returns null when serviceWorker not in navigator', async () => {
    const origSW = globalThis.navigator?.serviceWorker;
    if (globalThis.navigator) {
      delete globalThis.navigator.serviceWorker;
    }
    const result = await registerServiceWorker();
    expect(result).toBeNull();
    if (globalThis.navigator && origSW) {
      globalThis.navigator.serviceWorker = origSW;
    }
  });

  it('registers service worker and returns registration', async () => {
    const mockReg = { scope: '/' };
    const origNav = globalThis.navigator;
    globalThis.navigator = {
      ...origNav,
      serviceWorker: {
        register: vi.fn().mockResolvedValue(mockReg),
      },
    };
    const result = await registerServiceWorker();
    expect(result).toBe(mockReg);
    expect(globalThis.navigator.serviceWorker.register).toHaveBeenCalledWith(
      '/_functions/serviceWorker',
      { scope: '/' }
    );
    globalThis.navigator = origNav;
  });

  it('returns null on registration error', async () => {
    const origNav = globalThis.navigator;
    globalThis.navigator = {
      ...origNav,
      serviceWorker: {
        register: vi.fn().mockRejectedValue(new Error('fail')),
      },
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await registerServiceWorker();
    expect(result).toBeNull();
    consoleSpy.mockRestore();
    globalThis.navigator = origNav;
  });
});

describe('captureInstallPrompt', () => {
  beforeEach(() => {
    __resetPrompt();
  });

  it('does not throw when window is undefined', () => {
    const origWindow = globalThis.window;
    delete globalThis.window;
    expect(() => captureInstallPrompt()).not.toThrow();
    globalThis.window = origWindow;
  });

  it('adds beforeinstallprompt event listener', () => {
    globalThis.window = globalThis.window || {};
    globalThis.window.addEventListener = vi.fn();
    captureInstallPrompt();
    expect(globalThis.window.addEventListener).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
  });

  it('captures the event and makes canShowInstallPrompt return true', () => {
    // Simulate the actual event listener behavior
    let capturedHandler;
    globalThis.window = globalThis.window || {};
    globalThis.window.addEventListener = vi.fn((event, handler) => {
      capturedHandler = handler;
    });
    captureInstallPrompt();

    // Simulate the browser firing beforeinstallprompt
    const fakeEvent = { preventDefault: vi.fn(), prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) };
    capturedHandler(fakeEvent);

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(canShowInstallPrompt()).toBe(true);
  });
});

describe('canShowInstallPrompt', () => {
  beforeEach(() => {
    __resetPrompt();
  });

  it('returns false when no prompt captured', () => {
    expect(canShowInstallPrompt()).toBe(false);
  });
});

describe('showInstallPrompt', () => {
  beforeEach(() => {
    __resetPrompt();
  });

  it('returns "dismissed" when no prompt available', async () => {
    const result = await showInstallPrompt();
    expect(result).toBe('dismissed');
  });

  it('returns "accepted" when user accepts the prompt', async () => {
    // Set up the deferred prompt via captureInstallPrompt
    let capturedHandler;
    globalThis.window = globalThis.window || {};
    globalThis.window.addEventListener = vi.fn((event, handler) => {
      capturedHandler = handler;
    });
    captureInstallPrompt();

    const fakeEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };
    capturedHandler(fakeEvent);

    const result = await showInstallPrompt();
    expect(result).toBe('accepted');
    expect(fakeEvent.prompt).toHaveBeenCalled();
    // After showing, prompt should be cleared
    expect(canShowInstallPrompt()).toBe(false);
  });

  it('returns "dismissed" outcome when user dismisses the prompt', async () => {
    let capturedHandler;
    globalThis.window = globalThis.window || {};
    globalThis.window.addEventListener = vi.fn((event, handler) => {
      capturedHandler = handler;
    });
    captureInstallPrompt();

    const fakeEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    };
    capturedHandler(fakeEvent);

    const result = await showInstallPrompt();
    expect(result).toBe('dismissed');
    expect(canShowInstallPrompt()).toBe(false);
  });
});

describe('isInstalledPWA', () => {
  it('returns false when window is undefined', () => {
    const origWindow = globalThis.window;
    delete globalThis.window;
    expect(isInstalledPWA()).toBe(false);
    globalThis.window = origWindow;
  });

  it('returns false when not in standalone mode', () => {
    globalThis.window = globalThis.window || {};
    globalThis.window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    globalThis.window.navigator = { standalone: false };
    expect(isInstalledPWA()).toBe(false);
  });

  it('returns true when in standalone mode', () => {
    globalThis.window = globalThis.window || {};
    globalThis.window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(isInstalledPWA()).toBe(true);
  });

  it('returns true when navigator.standalone is true (iOS Safari)', () => {
    globalThis.window = globalThis.window || {};
    globalThis.window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    globalThis.window.navigator = { standalone: true };
    expect(isInstalledPWA()).toBe(true);
  });
});

describe('__resetPrompt', () => {
  it('clears the deferred prompt', () => {
    __resetPrompt();
    expect(canShowInstallPrompt()).toBe(false);
  });
});
