// Mock wix-window-frontend for vitest
import { vi } from 'vitest';

const wixWindowFrontend = {
  openLightbox: vi.fn(() => Promise.resolve()),
  scrollTo: vi.fn(() => Promise.resolve()),
  trackEvent: vi.fn(),
  copyToClipboard: vi.fn(() => Promise.resolve()),
  getBoundingRect: vi.fn(() => Promise.resolve({ window: { width: 1024, height: 768 } })),
  formFactor: 'Desktop',
  viewMode: 'Site',
  rendering: { env: 'browser' },
  locale: 'en',
};

export default wixWindowFrontend;
