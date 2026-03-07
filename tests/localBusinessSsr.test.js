import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests for SSR LocalBusiness structured data injection on Contact and Store Locator pages.
// Validates that JSON-LD FurnitureStore schema is injected via wix-seo-frontend
// head.setStructuredData for crawler indexability (not just client-side HtmlComponent).

// ── Mock wix-seo-frontend ─────────────────────────────────────────

const mockHead = {
  setTitle: vi.fn(),
  setMetaTag: vi.fn(),
  setLinks: vi.fn(),
  setStructuredData: vi.fn(),
};

vi.mock('wix-seo-frontend', () => ({
  head: mockHead,
}));

// ── Mock backend modules ──────────────────────────────────────────

const mockBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'FurnitureStore',
  name: 'Carolina Futons',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '824 Locust St, Ste 200',
    addressLocality: 'Hendersonville',
    addressRegion: 'NC',
    postalCode: '28792',
  },
  telephone: '+18282529449',
};

const mockStoreSchema = {
  '@context': 'https://schema.org',
  '@type': 'FurnitureStore',
  name: 'Carolina Futons Showroom',
  address: { '@type': 'PostalAddress', addressLocality: 'Hendersonville' },
};

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn(() => JSON.stringify(mockBusinessSchema)),
  getPageTitle: vi.fn((type) => `${type} | Carolina Futons`),
  getPageMetaDescription: vi.fn(() => 'Test meta description'),
  getCanonicalUrl: vi.fn((type) => `https://www.carolinafutons.com/${type}`),
}));

vi.mock('backend/storeLocatorService.web', () => ({
  getStoreLocatorSchema: vi.fn(() => JSON.stringify(mockStoreSchema)),
  isShowroomOpen: vi.fn(() => ({ open: true, message: 'Open now' })),
  getNearbyCities: vi.fn(() => []),
  getDirectionsUrl: vi.fn(() => 'https://maps.google.com'),
}));

// ── Import the SSR injection functions ────────────────────────────

import {
  injectContactSeoSsr,
  injectStoreLocatorSeoSsr,
} from '../src/public/localBusinessSeo.js';

// ── Contact Page SSR Tests ────────────────────────────────────────

describe('injectContactSeoSsr — Contact page SSR meta + structured data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets page title via head.setTitle', async () => {
    await injectContactSeoSsr();
    expect(mockHead.setTitle).toHaveBeenCalledWith('contact | Carolina Futons');
  });

  it('sets meta description via head.setMetaTag', async () => {
    await injectContactSeoSsr();
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('description', 'Test meta description');
  });

  it('sets canonical URL via head.setLinks', async () => {
    await injectContactSeoSsr();
    expect(mockHead.setLinks).toHaveBeenCalledWith([
      { rel: 'canonical', href: 'https://www.carolinafutons.com/contact' },
    ]);
  });

  it('injects FurnitureStore structured data via head.setStructuredData', async () => {
    await injectContactSeoSsr();
    expect(mockHead.setStructuredData).toHaveBeenCalled();
    const schemas = mockHead.setStructuredData.mock.calls[0][0];
    const business = schemas.find(s => s['@type'] === 'FurnitureStore');
    expect(business).toBeDefined();
    expect(business.name).toBe('Carolina Futons');
    expect(business.address.addressLocality).toBe('Hendersonville');
  });

  it('includes telephone in structured data', async () => {
    await injectContactSeoSsr();
    const schemas = mockHead.setStructuredData.mock.calls[0][0];
    const business = schemas.find(s => s['@type'] === 'FurnitureStore');
    expect(business.telephone).toBe('+18282529449');
  });

  it('handles backend failure gracefully', async () => {
    const { getBusinessSchema } = await import('backend/seoHelpers.web');
    getBusinessSchema.mockReturnValueOnce(null);
    await expect(injectContactSeoSsr()).resolves.not.toThrow();
  });
});

// ── Store Locator Page SSR Tests ──────────────────────────────────

describe('injectStoreLocatorSeoSsr — Store Locator page SSR structured data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets page title via head.setTitle', async () => {
    await injectStoreLocatorSeoSsr();
    expect(mockHead.setTitle).toHaveBeenCalled();
  });

  it('sets canonical URL via head.setLinks', async () => {
    await injectStoreLocatorSeoSsr();
    expect(mockHead.setLinks).toHaveBeenCalled();
  });

  it('injects FurnitureStore structured data via head.setStructuredData', async () => {
    await injectStoreLocatorSeoSsr();
    expect(mockHead.setStructuredData).toHaveBeenCalled();
    const schemas = mockHead.setStructuredData.mock.calls[0][0];
    const store = schemas.find(s => s['@type'] === 'FurnitureStore');
    expect(store).toBeDefined();
    expect(store.name).toBe('Carolina Futons Showroom');
  });

  it('handles backend failure gracefully', async () => {
    const { getStoreLocatorSchema } = await import('backend/storeLocatorService.web');
    getStoreLocatorSchema.mockReturnValueOnce(null);
    await expect(injectStoreLocatorSeoSsr()).resolves.not.toThrow();
    // Should still set title even if schema fails
    expect(mockHead.setTitle).toHaveBeenCalled();
  });
});
