// Mock for wix-location-frontend
// Provides location path and query info

let _path = [];
let _query = {};

export function __reset() {
  _path = [];
  _query = {};
}

export function __setPath(path) {
  _path = path;
}

export function __setQuery(query) {
  _query = query;
}

const wixLocationFrontend = {
  get path() { return _path; },
  get query() { return _query; },
  get baseUrl() { return 'https://www.carolinafutons.com'; },
  to(url) {},
};

export default wixLocationFrontend;
