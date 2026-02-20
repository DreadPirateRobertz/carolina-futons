// Mock for wix-location (dynamic import target)
// Used by page code: import('wix-location').then(({ to }) => to(path))

let _lastNavigation = null;

export function __reset() {
  _lastNavigation = null;
}

export function __getLastNavigation() {
  return _lastNavigation;
}

export function to(url) {
  _lastNavigation = url;
}
