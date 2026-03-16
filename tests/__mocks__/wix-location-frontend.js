// Mock for wix-location-frontend
// Provides location path and query info

let _path = [];
let _query = {};

export function __reset() {
  _path = [];
  _query = {};
  _toCallLog = [];
}

export function __setPath(path) {
  _path = path;
}

export function __setQuery(query) {
  _query = query;
}

let _toCallLog = [];

const wixLocationFrontend = {
  get path() { return _path; },
  get query() { return _query; },
  get baseUrl() { return 'https://www.carolinafutons.com'; },
  to(url) { _toCallLog.push(url); },
};

export function __getToCallLog() { return _toCallLog; }

export function __resetToCallLog() { _toCallLog = []; }

// Named export so `import('wix-location-frontend').then(({ to }) => ...)` works
export const to = wixLocationFrontend.to.bind(wixLocationFrontend);

export default wixLocationFrontend;
