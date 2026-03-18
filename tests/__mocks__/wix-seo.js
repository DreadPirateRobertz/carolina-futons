// Mock for wix-seo
// Provides SEO title/meta/links setters

let _title = '';
let _metaTags = [];
let _links = [];

export function __reset() {
  _title = '';
  _metaTags = [];
  _links = [];
}

export function __getTitle() { return _title; }
export function __getMetaTags() { return _metaTags; }
export function __getLinks() { return _links; }

export const seo = {
  setTitle(title) { _title = title; },
  setMetaTag(tag) { _metaTags.push(tag); },
  setLinks(links) { _links = links; },
};

export default seo;
