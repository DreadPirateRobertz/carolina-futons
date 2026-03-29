/**
 * @file referralShareLinks.test.js
 * @description Tests for referral social sharing deep links (cf-ctzo, cf-73zw).
 */

import { describe, it, expect } from 'vitest';
import {
  buildReferralUrl,
  getCanonicalReferralUrl,
  getAppDeepLink,
  getInstagramShareContent,
  getFacebookShareUrl,
  getTwitterShareUrl,
  getSmsShareUrl,
  getEmailShareUrl,
  getWhatsAppShareUrl,
  getPinterestShareUrl,
  getAllShareLinks,
} from '../src/public/referralShareLinks.js';

const CODE = 'ABC123';

// ── buildReferralUrl ────────────────────────────────────────────────

describe('buildReferralUrl', () => {
  it('includes ref code and UTM params', () => {
    const url = buildReferralUrl(CODE, 'facebook');
    expect(url).toContain('ref=ABC123');
    expect(url).toContain('utm_source=facebook');
    expect(url).toContain('utm_medium=social');
    expect(url).toContain('utm_campaign=referral');
    expect(url).toContain('utm_content=ABC123');
  });

  it('defaults to /shop path', () => {
    const url = buildReferralUrl(CODE, 'facebook');
    expect(url).toContain('/shop?');
  });

  it('accepts custom path', () => {
    const url = buildReferralUrl(CODE, 'facebook', '/mattresses');
    expect(url).toContain('/mattresses?');
  });

  it('sets medium=email for email source', () => {
    const url = buildReferralUrl(CODE, 'email');
    expect(url).toContain('utm_medium=email');
  });

  it('sets medium=sms for sms source', () => {
    const url = buildReferralUrl(CODE, 'sms');
    expect(url).toContain('utm_medium=sms');
  });

  it('sanitizes referral code', () => {
    const url = buildReferralUrl('ab-c!1@2#3', 'facebook');
    expect(url).toContain('ref=ABC123');
  });

  it('handles empty referral code', () => {
    const url = buildReferralUrl('', 'facebook');
    expect(url).toBe('https://www.carolinafutons.com/shop');
  });
});

// ── Platform URLs ───────────────────────────────────────────────────

describe('getFacebookShareUrl', () => {
  it('returns Facebook sharer URL with encoded referral link', () => {
    const url = getFacebookShareUrl(CODE);
    expect(url).toContain('facebook.com/sharer/sharer.php');
    expect(url).toContain(encodeURIComponent('ref=ABC123'));
  });
});

describe('getTwitterShareUrl', () => {
  it('returns Twitter intent URL with text and link', () => {
    const url = getTwitterShareUrl(CODE);
    expect(url).toContain('twitter.com/intent/tweet');
    expect(url).toContain('text=');
    expect(url).toContain('url=');
  });

  it('accepts custom message', () => {
    const url = getTwitterShareUrl(CODE, 'My custom message');
    expect(url).toContain(encodeURIComponent('My custom message'));
  });
});

describe('getSmsShareUrl', () => {
  it('returns sms: URI with body', () => {
    const url = getSmsShareUrl(CODE);
    expect(url).toMatch(/^sms:\?/);
    expect(url).toContain('body=');
    expect(url).toContain(encodeURIComponent('ref=ABC123'));
  });
});

describe('getEmailShareUrl', () => {
  it('returns mailto: URI with subject and body', () => {
    const url = getEmailShareUrl(CODE);
    expect(url).toMatch(/^mailto:\?/);
    expect(url).toContain('subject=');
    expect(url).toContain('body=');
    expect(url).toContain(encodeURIComponent('ref=ABC123'));
  });
});

describe('getWhatsAppShareUrl', () => {
  it('returns WhatsApp API URL with text', () => {
    const url = getWhatsAppShareUrl(CODE);
    expect(url).toContain('api.whatsapp.com/send');
    expect(url).toContain('text=');
    expect(url).toContain(encodeURIComponent('ref=ABC123'));
  });
});

describe('getPinterestShareUrl', () => {
  it('returns Pinterest pin URL with description', () => {
    const url = getPinterestShareUrl(CODE);
    expect(url).toContain('pinterest.com/pin/create/button');
    expect(url).toContain('description=');
  });

  it('includes image URL when provided', () => {
    const url = getPinterestShareUrl(CODE, 'https://example.com/img.jpg');
    expect(url).toContain('media=');
  });
});

// ── getAllShareLinks ────────────────────────────────────────────────

describe('getAllShareLinks', () => {
  it('returns all 10 platform links', () => {
    const links = getAllShareLinks(CODE);
    expect(Object.keys(links)).toEqual([
      'copyLink', 'canonical', 'deepLink', 'facebook', 'twitter', 'sms', 'email', 'whatsapp', 'pinterest', 'instagram',
    ]);
  });

  it('all links contain the referral code', () => {
    const links = getAllShareLinks(CODE);
    for (const [platform, url] of Object.entries(links)) {
      expect(url, `${platform} should contain ref code`).toContain('ABC123');
    }
  });

  it('passes options through', () => {
    const links = getAllShareLinks(CODE, { path: '/mattresses' });
    expect(links.copyLink).toContain('/mattresses');
  });

  it('canonical uses /referral path not /shop', () => {
    const links = getAllShareLinks(CODE);
    expect(links.canonical).toContain('/referral');
    expect(links.canonical).not.toContain('/shop');
  });

  it('deepLink uses app scheme', () => {
    const links = getAllShareLinks(CODE);
    expect(links.deepLink).toMatch(/^carolinafutons:\/\//);
  });

  it('instagram is the canonical URL', () => {
    const links = getAllShareLinks(CODE);
    expect(links.instagram).toContain('/referral');
    expect(links.instagram).toContain('ABC123');
  });
});

// ── getCanonicalReferralUrl ────────────────────────────────────────

describe('getCanonicalReferralUrl', () => {
  it('returns /referral?ref=CODE', () => {
    const url = getCanonicalReferralUrl(CODE);
    expect(url).toBe('https://www.carolinafutons.com/referral?ref=ABC123');
  });

  it('sanitizes code to uppercase alphanumeric', () => {
    const url = getCanonicalReferralUrl('ab-c1!2');
    expect(url).toContain('ref=ABC12');
  });

  it('returns base referral URL for empty code', () => {
    const url = getCanonicalReferralUrl('');
    expect(url).toBe('https://www.carolinafutons.com/referral');
  });

  it('returns base referral URL for null', () => {
    const url = getCanonicalReferralUrl(null);
    expect(url).toBe('https://www.carolinafutons.com/referral');
  });
});

// ── getAppDeepLink ─────────────────────────────────────────────────

describe('getAppDeepLink', () => {
  it('returns carolinafutons:// scheme', () => {
    const link = getAppDeepLink(CODE);
    expect(link).toBe('carolinafutons://referral?code=ABC123');
  });

  it('sanitizes code', () => {
    const link = getAppDeepLink('ab-c1!2');
    expect(link).toContain('code=ABC12');
  });

  it('returns empty string for empty code', () => {
    expect(getAppDeepLink('')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(getAppDeepLink(null)).toBe('');
  });
});

// ── getInstagramShareContent ───────────────────────────────────────

describe('getInstagramShareContent', () => {
  it('returns url and message', () => {
    const content = getInstagramShareContent(CODE);
    expect(content).toHaveProperty('url');
    expect(content).toHaveProperty('message');
  });

  it('url is the canonical referral URL', () => {
    const content = getInstagramShareContent(CODE);
    expect(content.url).toBe('https://www.carolinafutons.com/referral?ref=ABC123');
  });

  it('message contains the url', () => {
    const content = getInstagramShareContent(CODE);
    expect(content.message).toContain(content.url);
  });

  it('handles empty code gracefully', () => {
    const content = getInstagramShareContent('');
    expect(content.url).toBe('https://www.carolinafutons.com/referral');
  });
});
