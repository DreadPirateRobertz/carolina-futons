import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatCountdown,
  getUrgencyLevel,
  getUrgencyMessage,
  formatDealBanner,
  buildAnnouncementMessage,
} from '../../src/public/flashSaleHelpers.js';

const now = Date.now();
const HOUR = 3600000;
const DAY = 86400000;

// ── formatCountdown ─────────────────────────────────────────────────

describe('formatCountdown', () => {
  it('returns days, hours, mins, secs for a future endDate', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const endDate = new Date(now + 2 * DAY + 3 * HOUR + 15 * 60000 + 42000);
    const result = formatCountdown(endDate);
    expect(result.days).toBe(2);
    expect(result.hours).toBe(3);
    expect(result.mins).toBe(15);
    expect(result.secs).toBe(42);
    expect(result.expired).toBe(false);
    vi.restoreAllMocks();
  });

  it('returns expired=true when endDate is in the past', () => {
    const endDate = new Date(now - 1000);
    const result = formatCountdown(endDate);
    expect(result.expired).toBe(true);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.mins).toBe(0);
    expect(result.secs).toBe(0);
  });

  it('returns expired=true when endDate equals now', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const result = formatCountdown(new Date(now));
    expect(result.expired).toBe(true);
    vi.restoreAllMocks();
  });

  it('handles endDate as ISO string', () => {
    const endDate = new Date(now + 5 * HOUR).toISOString();
    const result = formatCountdown(endDate);
    expect(result.expired).toBe(false);
    expect(result.hours).toBeGreaterThanOrEqual(4);
  });

  it('handles endDate as timestamp number', () => {
    const result = formatCountdown(now + DAY);
    expect(result.expired).toBe(false);
    expect(result.days).toBeGreaterThanOrEqual(0);
  });

  it('returns expired for null endDate', () => {
    const result = formatCountdown(null);
    expect(result.expired).toBe(true);
  });

  it('returns expired for undefined endDate', () => {
    const result = formatCountdown(undefined);
    expect(result.expired).toBe(true);
  });

  it('returns expired for invalid date string', () => {
    const result = formatCountdown('not-a-date');
    expect(result.expired).toBe(true);
  });

  it('returns correct totalMs', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const endDate = new Date(now + 10000);
    const result = formatCountdown(endDate);
    expect(result.totalMs).toBe(10000);
    vi.restoreAllMocks();
  });

  it('returns formatted string DD:HH:MM:SS', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const endDate = new Date(now + 1 * DAY + 2 * HOUR + 3 * 60000 + 4000);
    const result = formatCountdown(endDate);
    expect(result.formatted).toBe('01:02:03:04');
    vi.restoreAllMocks();
  });

  it('pads single digits with leading zeros', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const endDate = new Date(now + 5000); // 5 seconds
    const result = formatCountdown(endDate);
    expect(result.formatted).toBe('00:00:00:05');
    vi.restoreAllMocks();
  });
});

// ── getUrgencyLevel ─────────────────────────────────────────────────

describe('getUrgencyLevel', () => {
  it('returns "critical" when less than 2 hours remain', () => {
    const endDate = new Date(now + 1 * HOUR);
    expect(getUrgencyLevel(endDate)).toBe('critical');
  });

  it('returns "urgent" when 2-24 hours remain', () => {
    const endDate = new Date(now + 12 * HOUR);
    expect(getUrgencyLevel(endDate)).toBe('urgent');
  });

  it('returns "active" when more than 24 hours remain', () => {
    const endDate = new Date(now + 3 * DAY);
    expect(getUrgencyLevel(endDate)).toBe('active');
  });

  it('returns "expired" when endDate is past', () => {
    const endDate = new Date(now - 1000);
    expect(getUrgencyLevel(endDate)).toBe('expired');
  });

  it('respects custom urgencyThresholdHours for critical', () => {
    const endDate = new Date(now + 3 * HOUR);
    expect(getUrgencyLevel(endDate, { criticalHours: 4 })).toBe('critical');
  });

  it('respects custom urgencyThresholdHours for urgent', () => {
    const endDate = new Date(now + 30 * HOUR);
    expect(getUrgencyLevel(endDate, { urgentHours: 48 })).toBe('urgent');
  });

  it('returns "expired" for null endDate', () => {
    expect(getUrgencyLevel(null)).toBe('expired');
  });

  it('returns "expired" for undefined endDate', () => {
    expect(getUrgencyLevel(undefined)).toBe('expired');
  });

  it('returns "expired" for invalid date', () => {
    expect(getUrgencyLevel('garbage')).toBe('expired');
  });

  it('returns "critical" at exactly 2 hours (boundary)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const endDate = new Date(now + 2 * HOUR);
    expect(getUrgencyLevel(endDate)).toBe('critical');
    vi.restoreAllMocks();
  });
});

// ── getUrgencyMessage ───────────────────────────────────────────────

describe('getUrgencyMessage', () => {
  it('returns critical message with time remaining', () => {
    const deal = {
      endDate: new Date(now + 1 * HOUR),
      discountPercent: 25,
      discountCode: 'FLASH25',
    };
    const msg = getUrgencyMessage(deal);
    expect(msg).toContain('Ending Soon');
    expect(msg).toContain('25%');
  });

  it('returns urgent message with discount info', () => {
    const deal = {
      endDate: new Date(now + 12 * HOUR),
      discountPercent: 20,
      discountCode: 'SALE20',
    };
    const msg = getUrgencyMessage(deal);
    expect(msg).toContain('20%');
  });

  it('returns active message for deals with plenty of time', () => {
    const deal = {
      endDate: new Date(now + 5 * DAY),
      discountPercent: 15,
      discountCode: 'SAVE15',
    };
    const msg = getUrgencyMessage(deal);
    expect(msg).toContain('15%');
  });

  it('returns empty string for expired deal', () => {
    const deal = {
      endDate: new Date(now - 1000),
      discountPercent: 10,
    };
    expect(getUrgencyMessage(deal)).toBe('');
  });

  it('handles missing discountPercent gracefully', () => {
    const deal = {
      endDate: new Date(now + 1 * HOUR),
    };
    const msg = getUrgencyMessage(deal);
    expect(typeof msg).toBe('string');
  });

  it('handles missing discountCode gracefully', () => {
    const deal = {
      endDate: new Date(now + 12 * HOUR),
      discountPercent: 20,
    };
    const msg = getUrgencyMessage(deal);
    expect(msg).not.toContain('undefined');
  });

  it('handles null deal gracefully', () => {
    expect(getUrgencyMessage(null)).toBe('');
  });

  it('handles deal with no endDate', () => {
    expect(getUrgencyMessage({ discountPercent: 10 })).toBe('');
  });
});

// ── formatDealBanner ────────────────────────────────────────────────

describe('formatDealBanner', () => {
  it('returns banner data with all fields', () => {
    const deal = {
      _id: 'deal-1',
      title: 'Flash Sale',
      subtitle: '24-Hour Blowout',
      endDate: new Date(now + DAY),
      discountPercent: 30,
      discountCode: 'FLASH30',
      bannerMessage: 'Limited time only!',
    };
    const banner = formatDealBanner(deal);
    expect(banner.title).toBe('Flash Sale');
    expect(banner.subtitle).toBe('24-Hour Blowout');
    expect(banner.discountText).toContain('30%');
    expect(banner.codeText).toContain('FLASH30');
    expect(banner.urgencyLevel).toBe('urgent');
    expect(banner.countdown).toBeDefined();
    expect(banner.countdown.expired).toBe(false);
  });

  it('returns null for expired deal', () => {
    const deal = {
      endDate: new Date(now - 1000),
      discountPercent: 10,
    };
    expect(formatDealBanner(deal)).toBeNull();
  });

  it('returns null for null deal', () => {
    expect(formatDealBanner(null)).toBeNull();
  });

  it('returns null for deal without endDate', () => {
    expect(formatDealBanner({ title: 'No End' })).toBeNull();
  });

  it('uses bannerMessage when provided', () => {
    const deal = {
      endDate: new Date(now + DAY),
      discountPercent: 20,
      bannerMessage: 'Custom banner text!',
    };
    const banner = formatDealBanner(deal);
    expect(banner.message).toBe('Custom banner text!');
  });

  it('generates default message when no bannerMessage', () => {
    const deal = {
      endDate: new Date(now + DAY),
      discountPercent: 20,
      title: 'Weekend Sale',
    };
    const banner = formatDealBanner(deal);
    expect(banner.message).toContain('20%');
  });

  it('handles zero discountPercent', () => {
    const deal = {
      endDate: new Date(now + DAY),
      discountPercent: 0,
      title: 'Free Shipping Event',
    };
    const banner = formatDealBanner(deal);
    expect(banner).not.toBeNull();
  });
});

// ── buildAnnouncementMessage ────────────────────────────────────────

describe('buildAnnouncementMessage', () => {
  it('builds a concise announcement from deal data', () => {
    const deal = {
      title: 'Flash Sale',
      discountPercent: 25,
      discountCode: 'FLASH25',
      endDate: new Date(now + 6 * HOUR),
    };
    const msg = buildAnnouncementMessage(deal);
    expect(msg).toContain('25%');
    expect(msg).toContain('FLASH25');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeLessThan(200);
  });

  it('returns empty string for null deal', () => {
    expect(buildAnnouncementMessage(null)).toBe('');
  });

  it('returns empty string for expired deal', () => {
    const deal = {
      endDate: new Date(now - 1000),
      discountPercent: 10,
    };
    expect(buildAnnouncementMessage(deal)).toBe('');
  });

  it('handles deal without discountCode', () => {
    const deal = {
      title: 'Sale',
      discountPercent: 15,
      endDate: new Date(now + DAY),
    };
    const msg = buildAnnouncementMessage(deal);
    expect(msg).not.toContain('undefined');
    expect(msg).toContain('15%');
  });

  it('handles deal without discountPercent', () => {
    const deal = {
      title: 'Special Offer',
      endDate: new Date(now + DAY),
    };
    const msg = buildAnnouncementMessage(deal);
    expect(msg).toContain('Special Offer');
  });

  it('includes time context for critical urgency', () => {
    const deal = {
      title: 'Flash Sale',
      discountPercent: 30,
      discountCode: 'FAST30',
      endDate: new Date(now + 1 * HOUR),
    };
    const msg = buildAnnouncementMessage(deal);
    expect(msg.toLowerCase()).toMatch(/ending soon|hour|last chance/);
  });
});
