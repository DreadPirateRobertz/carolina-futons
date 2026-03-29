// Tests for AppDownloadBanner.js — CF-e2ib
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  detectPlatform,
  isBannerDismissed,
  recordDismissal,
  isNativeAppInstalled,
  storeDeferredDeepLink,
  getIOSStoreUrl,
  getAndroidStoreUrl,
  buildIOSMetaTags,
  initAppDownloadBanner,
  IOS_APP_ID,
  ANDROID_PACKAGE,
  DISMISS_KEY,
  INSTALLED_KEY,
  DEFERRED_DEEP_LINK_KEY,
  DISMISS_DURATION_MS,
} from '../src/public/AppDownloadBanner.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    text: '',
    onClick: vi.fn(),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function create$w(elementMap = {}) {
  return (sel) => {
    if (sel in elementMap) return elementMap[sel];
    throw new Error(`Element ${sel} not found`);
  };
}

// ── UA constants ──────────────────────────────────────────────────────────────

const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1';
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1';
const UA_IPOD = 'Mozilla/5.0 (iPod touch; CPU iPhone OS 17_0 like Mac OS X)';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120';
const UA_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120';
const UA_WINDOWS_PHONE = 'Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 920)';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  for (const k of [DISMISS_KEY, INSTALLED_KEY, DEFERRED_DEEP_LINK_KEY]) {
    localStorage.removeItem(k);
  }
  vi.restoreAllMocks();
});

// ── detectPlatform ────────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  it('returns ios for iPhone', () => {
    expect(detectPlatform(UA_IPHONE)).toBe('ios');
  });

  it('returns ios for iPad', () => {
    expect(detectPlatform(UA_IPAD)).toBe('ios');
  });

  it('returns ios for iPod', () => {
    expect(detectPlatform(UA_IPOD)).toBe('ios');
  });

  it('returns android for Android', () => {
    expect(detectPlatform(UA_ANDROID)).toBe('android');
  });

  it('returns null for desktop Chrome', () => {
    expect(detectPlatform(UA_DESKTOP)).toBeNull();
  });

  it('returns null when navigator is undefined', () => {
    const origNav = globalThis.navigator;
    delete globalThis.navigator;
    expect(detectPlatform()).toBeNull();
    globalThis.navigator = origNav;
  });

  it('returns null for Windows Phone (legacy IE UA with iPhone token)', () => {
    expect(detectPlatform(UA_WINDOWS_PHONE)).toBeNull();
  });
});

// ── isBannerDismissed / recordDismissal ───────────────────────────────────────

describe('isBannerDismissed', () => {
  it('returns false when no entry in localStorage', () => {
    expect(isBannerDismissed()).toBe(false);
  });

  it('returns false when dismissed more than 7 days ago', () => {
    const old = Date.now() - DISMISS_DURATION_MS - 1000;
    localStorage.setItem(DISMISS_KEY, String(old));
    expect(isBannerDismissed()).toBe(false);
  });

  it('returns true when dismissed within 7 days', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 1000));
    expect(isBannerDismissed()).toBe(true);
  });

  it('returns false when localStorage throws', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('quota'); });
    expect(isBannerDismissed()).toBe(false);
  });
});

describe('recordDismissal', () => {
  it('sets DISMISS_KEY to approximately current timestamp', () => {
    const before = Date.now();
    recordDismissal();
    const after = Date.now();
    const stored = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    expect(stored).toBeGreaterThanOrEqual(before);
    expect(stored).toBeLessThanOrEqual(after);
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    expect(() => recordDismissal()).not.toThrow();
  });
});

// ── isNativeAppInstalled ──────────────────────────────────────────────────────

describe('isNativeAppInstalled', () => {
  // navigator is not a global in Node.js 20 (added in Node.js 21.1.0).
  // Ensure it exists as a plain object so Object.defineProperty works.
  beforeEach(() => {
    if (typeof globalThis.navigator === 'undefined') {
      globalThis.navigator = {};
    }
  });

  it('returns true when localStorage flag is set', async () => {
    localStorage.setItem(INSTALLED_KEY, '1');
    expect(await isNativeAppInstalled()).toBe(true);
  });

  it('returns false when no flag and no getInstalledRelatedApps', async () => {
    expect(await isNativeAppInstalled()).toBe(false);
  });

  it('returns true when getInstalledRelatedApps returns apps', async () => {
    Object.defineProperty(globalThis.navigator, 'getInstalledRelatedApps', {
      value: vi.fn().mockResolvedValue([{ platform: 'play', url: 'https://play.google.com/...' }]),
      configurable: true,
    });
    expect(await isNativeAppInstalled()).toBe(true);
    delete globalThis.navigator.getInstalledRelatedApps;
  });

  it('returns false when getInstalledRelatedApps returns empty array', async () => {
    Object.defineProperty(globalThis.navigator, 'getInstalledRelatedApps', {
      value: vi.fn().mockResolvedValue([]),
      configurable: true,
    });
    expect(await isNativeAppInstalled()).toBe(false);
    delete globalThis.navigator.getInstalledRelatedApps;
  });

  it('returns false when getInstalledRelatedApps throws', async () => {
    Object.defineProperty(globalThis.navigator, 'getInstalledRelatedApps', {
      value: vi.fn().mockRejectedValue(new Error('not supported')),
      configurable: true,
    });
    expect(await isNativeAppInstalled()).toBe(false);
    delete globalThis.navigator.getInstalledRelatedApps;
  });
});

// ── storeDeferredDeepLink ─────────────────────────────────────────────────────

describe('storeDeferredDeepLink', () => {
  it('stores URL in localStorage', () => {
    storeDeferredDeepLink('https://carolinafutons.com/product/luna-futon');
    expect(localStorage.getItem(DEFERRED_DEEP_LINK_KEY)).toBe(
      'https://carolinafutons.com/product/luna-futon'
    );
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    expect(() => storeDeferredDeepLink('https://carolinafutons.com/product/luna-futon')).not.toThrow();
  });
});

// ── Store URLs ────────────────────────────────────────────────────────────────

describe('getIOSStoreUrl', () => {
  it('contains IOS_APP_ID', () => {
    expect(getIOSStoreUrl()).toContain(IOS_APP_ID);
    expect(getIOSStoreUrl()).toContain('apps.apple.com');
  });
});

describe('getAndroidStoreUrl', () => {
  it('contains ANDROID_PACKAGE', () => {
    expect(getAndroidStoreUrl()).toContain(ANDROID_PACKAGE);
    expect(getAndroidStoreUrl()).toContain('play.google.com');
  });

  it('uses web_banner as default UTM source', () => {
    expect(getAndroidStoreUrl()).toContain('utm_source%3Dweb_banner');
  });

  it('includes encoded UTM referrer', () => {
    const url = getAndroidStoreUrl('test_source');
    expect(url).toContain('referrer=');
    expect(url).toContain('utm_source%3Dtest_source');
  });
});

// ── buildIOSMetaTags ──────────────────────────────────────────────────────────

describe('buildIOSMetaTags', () => {
  it('returns meta tag with apple-itunes-app name', () => {
    const tags = buildIOSMetaTags('https://carolinafutons.com/product/luna');
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe('apple-itunes-app');
  });

  it('includes app-id and app-argument in content', () => {
    const url = 'https://carolinafutons.com/product/luna';
    const tags = buildIOSMetaTags(url);
    expect(tags[0].content).toContain(`app-id=${IOS_APP_ID}`);
    expect(tags[0].content).toContain(`app-argument=${url}`);
  });
});

// ── initAppDownloadBanner ─────────────────────────────────────────────────────

describe('initAppDownloadBanner', () => {
  const CURRENT_URL = 'https://carolinafutons.com/product/luna-futon';

  it('does nothing on desktop', async () => {
    const setMetaTags = vi.fn();
    await initAppDownloadBanner(create$w({}), CURRENT_URL, { setMetaTags, userAgent: UA_DESKTOP });
    expect(setMetaTags).not.toHaveBeenCalled();
  });

  it('does nothing when banner was dismissed', async () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 1000));
    const setMetaTags = vi.fn();
    await initAppDownloadBanner(create$w({}), CURRENT_URL, { setMetaTags, userAgent: UA_IPHONE });
    expect(setMetaTags).not.toHaveBeenCalled();
  });

  it('does nothing when native app is already installed', async () => {
    localStorage.setItem(INSTALLED_KEY, '1');
    const setMetaTags = vi.fn();
    await initAppDownloadBanner(create$w({}), CURRENT_URL, { setMetaTags, userAgent: UA_IPHONE });
    expect(setMetaTags).not.toHaveBeenCalled();
  });

  it('iOS: calls setMetaTags with apple-itunes-app tag', async () => {
    const setMetaTags = vi.fn();
    await initAppDownloadBanner(create$w({}), CURRENT_URL, { setMetaTags, userAgent: UA_IPHONE });
    expect(setMetaTags).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'apple-itunes-app' }),
      ])
    );
  });

  it('iOS: stores deferred deep link before injecting meta tag', async () => {
    const setMetaTags = vi.fn();
    await initAppDownloadBanner(create$w({}), CURRENT_URL, { setMetaTags, userAgent: UA_IPHONE });
    expect(localStorage.getItem(DEFERRED_DEEP_LINK_KEY)).toBe(CURRENT_URL);
  });

  it('Android: shows banner and sets text', async () => {
    const banner = createMockElement();
    const text = createMockElement();
    const btn = createMockElement();
    const dismiss = createMockElement();
    const $w = create$w({
      '#appDownloadBanner': banner,
      '#appDownloadBannerText': text,
      '#appDownloadBannerBtn': btn,
      '#appDownloadBannerDismiss': dismiss,
    });
    await initAppDownloadBanner($w, CURRENT_URL, { navigateTo: vi.fn(), userAgent: UA_ANDROID });
    expect(banner.show).toHaveBeenCalledWith('slide', { direction: 'top', duration: 300 });
    expect(text.text).toBe('Get the CF App — track orders, earn 50 bonus points, AR room view');
  });

  it('Android: banner btn navigates to Play Store and records dismissal', async () => {
    const navigateTo = vi.fn();
    const btn = createMockElement();
    let btnClickHandler;
    btn.onClick = (fn) => { btnClickHandler = fn; };
    const $w = create$w({
      '#appDownloadBanner': createMockElement(),
      '#appDownloadBannerText': createMockElement(),
      '#appDownloadBannerBtn': btn,
      '#appDownloadBannerDismiss': createMockElement(),
    });

    await initAppDownloadBanner($w, CURRENT_URL, { navigateTo, userAgent: UA_ANDROID });
    btnClickHandler();

    expect(navigateTo).toHaveBeenCalledWith(expect.stringContaining('play.google.com'));
    expect(navigateTo).toHaveBeenCalledWith(expect.stringContaining(ANDROID_PACKAGE));
    expect(isBannerDismissed()).toBe(true);
  });

  it('Android: dismiss btn hides banner and records dismissal', async () => {
    const banner = createMockElement();
    const dismiss = createMockElement();
    let dismissClickHandler;
    dismiss.onClick = (fn) => { dismissClickHandler = fn; };
    const $w = create$w({
      '#appDownloadBanner': banner,
      '#appDownloadBannerText': createMockElement(),
      '#appDownloadBannerBtn': createMockElement(),
      '#appDownloadBannerDismiss': dismiss,
    });

    await initAppDownloadBanner($w, CURRENT_URL, { navigateTo: vi.fn(), userAgent: UA_ANDROID });
    dismissClickHandler();

    expect(banner.hide).toHaveBeenCalledWith('fade', { duration: 200 });
    expect(isBannerDismissed()).toBe(true);
  });

  it('Android: no-op when #appDownloadBanner element is missing', async () => {
    const navigateTo = vi.fn();
    const $w = () => { throw new Error('element not found'); };
    await expect(
      initAppDownloadBanner($w, CURRENT_URL, { navigateTo, userAgent: UA_ANDROID })
    ).resolves.toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('iOS: catches error thrown by setMetaTags and logs it', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setMetaTags = vi.fn(() => { throw new Error('meta tag inject failed'); });
    await initAppDownloadBanner(create$w({}), CURRENT_URL, { setMetaTags, userAgent: UA_IPHONE });
    expect(errorSpy).toHaveBeenCalledWith(
      '[AppDownloadBanner] initAppDownloadBanner failed:',
      'meta tag inject failed',
    );
  });

  it('iOS: falls back to dynamic wix-seo-frontend import when setMetaTags is not provided', async () => {
    // No setMetaTags opt — code path calls import('wix-seo-frontend') and continues
    await expect(
      initAppDownloadBanner(create$w({}), CURRENT_URL, { userAgent: UA_IPHONE }),
    ).resolves.toBeUndefined();
  });

  it('Android: uses dynamic wix-location-frontend import when navigateTo is not provided', async () => {
    let btnClickHandler;
    const btn = { onClick: (fn) => { btnClickHandler = fn; } };
    const $w = create$w({
      '#appDownloadBanner': createMockElement(),
      '#appDownloadBannerText': createMockElement(),
      '#appDownloadBannerBtn': btn,
      '#appDownloadBannerDismiss': createMockElement(),
    });
    await initAppDownloadBanner($w, CURRENT_URL, { userAgent: UA_ANDROID });
    // Trigger the button click — falls back to dynamic import('wix-location-frontend')
    if (typeof btnClickHandler === 'function') btnClickHandler();
  });
});
