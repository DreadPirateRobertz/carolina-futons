// PWA helper utilities for service worker registration and install prompt
// Used by masterPage.js to enable Progressive Web App features

let _deferredPrompt = null;

/**
 * Register the service worker.
 * Should be called once from masterPage onReady.
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register(
      '/_functions/serviceWorker',
      { scope: '/' }
    );
    return registration;
  } catch (err) {
    console.error('SW registration failed:', err);
    return null;
  }
}

/**
 * Listen for the beforeinstallprompt event and stash it.
 * Call this early (before DOMContentLoaded) so the event is captured.
 */
export function captureInstallPrompt() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
  });
}

/**
 * Check if the PWA install prompt is available.
 * @returns {boolean}
 */
export function canShowInstallPrompt() {
  return _deferredPrompt !== null;
}

/**
 * Trigger the PWA install prompt.
 * @returns {Promise<string>} 'accepted' or 'dismissed'
 */
export async function showInstallPrompt() {
  if (!_deferredPrompt) return 'dismissed';
  _deferredPrompt.prompt();
  const { outcome } = await _deferredPrompt.userChoice;
  _deferredPrompt = null;
  return outcome;
}

/**
 * Check if the app is already installed (running in standalone mode).
 * @returns {boolean}
 */
export function isInstalledPWA() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

/**
 * Reset internal state (for testing).
 */
export function __resetPrompt() {
  _deferredPrompt = null;
}
