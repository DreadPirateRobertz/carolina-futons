// Mock for wix-fetch
let _handler = null;

export function __reset() {
  _handler = null;
}

// Set a handler: (url, options) => Response-like object
export function __setHandler(fn) {
  _handler = fn;
}

export async function fetch(url, options) {
  if (_handler) {
    return _handler(url, options);
  }

  // Default: return a successful empty response
  return {
    ok: true,
    status: 200,
    async json() { return {}; },
    async text() { return ''; },
  };
}
