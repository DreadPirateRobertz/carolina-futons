/**
 * @file referralActivation.test.js
 * @description Tests for referral program full activation (CF-heou).
 * Covers: Twitter share link generation, email template registration,
 * post-purchase sequence step count.
 */
import { describe, it, expect } from 'vitest';
import { getSocialShareLinks, formatReferralLink } from '../src/public/referralPageHelpers.js';

describe('getSocialShareLinks — Twitter support (CF-heou)', () => {
  it('generates a Twitter share URL', () => {
    const links = getSocialShareLinks('ABC123');
    expect(links.twitter).toBeDefined();
    expect(links.twitter).toContain('twitter.com/intent/tweet');
  });

  it('includes referral URL in Twitter text', () => {
    const links = getSocialShareLinks('XYZ789');
    expect(links.twitter).toContain(encodeURIComponent('https://www.carolinafutons.com?ref=XYZ789'));
  });

  it('includes @CarolinaFutons mention in Twitter text', () => {
    const links = getSocialShareLinks('ABC123');
    expect(links.twitter).toContain(encodeURIComponent('@CarolinaFutons'));
  });

  it('still generates email, sms, and facebook links', () => {
    const links = getSocialShareLinks('ABC123');
    expect(links.email).toBeDefined();
    expect(links.sms).toBeDefined();
    expect(links.facebook).toBeDefined();
  });

  it('returns empty object for empty code', () => {
    const links = getSocialShareLinks('');
    expect(links).toEqual({});
  });
});

describe('formatReferralLink', () => {
  it('generates a full URL with ref parameter', () => {
    expect(formatReferralLink('ABC123')).toBe('https://www.carolinafutons.com?ref=ABC123');
  });

  it('uppercases the code', () => {
    expect(formatReferralLink('abc123')).toContain('ref=ABC123');
  });

  it('returns base URL for empty code', () => {
    expect(formatReferralLink('')).toBe('https://www.carolinafutons.com');
  });
});

describe('post_purchase_referral email template', () => {
  it('is registered in email templates', async () => {
    const { _SEQUENCES } = await import('../src/backend/emailAutomation.web.js');
    const steps = _SEQUENCES.post_purchase.steps;
    const referralStep = steps.find(s => s.templateId === 'post_purchase_referral');
    expect(referralStep).toBeDefined();
    expect(referralStep.step).toBe(5);
    expect(referralStep.delayHours).toBe(336); // Day 14
  });

  it('post_purchase sequence has 5 steps total', async () => {
    const { _SEQUENCES } = await import('../src/backend/emailAutomation.web.js');
    expect(_SEQUENCES.post_purchase.steps).toHaveLength(5);
  });
});
