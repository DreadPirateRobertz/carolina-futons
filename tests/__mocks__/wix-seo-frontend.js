// Mock for wix-seo-frontend (dynamic import target in AppDownloadBanner._injectIOSBanner)

let _metaTags = [];

export function __reset() {
  _metaTags = [];
}

export function __getMetaTags() { return _metaTags; }

export const head = {
  setMetaTags(tags) { _metaTags.push(...tags); },
};

export default { head };
