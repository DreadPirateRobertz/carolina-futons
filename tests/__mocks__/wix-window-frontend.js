// Mock for wix-window-frontend
export function openUrl() { return Promise.resolve(); }
export function scrollTo() { return Promise.resolve(); }
export function onScroll() {}
export const lightbox = { getContext: () => null };
export const formFactor = 'Desktop';

export default {
  openUrl,
  scrollTo,
  onScroll,
  lightbox,
  formFactor,
};

export function __reset() {}
