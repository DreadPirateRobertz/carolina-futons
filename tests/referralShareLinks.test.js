/**
 * @file referralShareLinks.test.js
 * @description Tests for referral social sharing deep links (cf-ctzo).
 */

import { describe, it, expect } from 'vitest';
import {
  buildReferralUrl,
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
  it('returns all 7 platform links', () => {
    const links = getAllShareLinks(CODE);
    expect(Object.keys(links)).toEqual([
      'copyLink', 'facebook', 'twitter', 'sms', 'email', 'whatsapp', 'pinterest',
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
});
