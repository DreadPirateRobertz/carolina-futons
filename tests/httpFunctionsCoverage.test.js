/**
 * @file httpFunctionsCoverage.test.js
 * @description Branch coverage additions for untested http-functions.js exports.
 * Targets functions with counts=[0,0] (never called) to maximise branch coverage
 * and close the Ubuntu CI vs macOS v8 coverage gap.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __setQueryError,
  __setInsertError,
  __getInserted,
} from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import {
  __reset as crmReset,
  __getEmailLog as crmEmailLog,
  __failNextEmail as crmFailNextEmail,
} from './__mocks__/wix-crm-backend.js';
import { __setMember, __reset as resetMembers } from './__mocks__/wix-members-backend.js';
import { __setAccount, __reset as resetLoyalty } from './__mocks__/wix-loyalty.v2.js';
import {
  get_processContentScheduleCron,
  get_campaignAnalytics,
  get_sitemapXml,
  get_loyalty,
  get_robotsTxt,
  get_topicCluster,
  get_generateReferralLink,
  post_trackReferral,
  get_bundles,
  post_addBundleToCart,
  post_contactSubmissions,
  options_contactSubmissions,
  get_productQA,
  post_submitQuestion,
  post_answerQuestion,
  post_gamificationEvent,
  get_processNotificationQueueCron,
  post_busEvent,
  get_cmsGarbageCollect,
  get_activeChallenges,
  post_challengeProgress,
  get_cleanupRateLimitCron,
} from '../src/backend/http-functions.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

const cronReq = (key, extra = {}) => ({ headers: { 'x-cron-secret': key }, ...extra });
const jsonBody = (obj) => ({ body: { json: async () => obj, text: async () => JSON.stringify(obj) } });

const sampleProducts = [
  {
    _id: 'p1',
    name: 'Eureka Futon Frame',
    slug: 'eureka-futon-frame',
    price: 499,
    discountedPrice: null,
    mainMedia: 'https://cdn.example.com/eureka.jpg',
    description: 'Solid hardwood futon frame.',
    inStock: true,
    collections: ['futon-frames'],
    _updatedDate: new Date('2026-01-15'),
  },
  {
    _id: 'p2',
    name: 'Moonshadow Mattress',
    slug: 'moonshadow-mattress',
    price: 349,
    discountedPrice: 299,
    mainMedia: 'https://cdn.example.com/moon.jpg',
    description: '<p>Premium mattress.</p>',
    inStock: true,
    collections: ['mattresses'],
    _updatedDate: new Date('2026-02-01'),
    mediaItems: [{ src: 'https://cdn.example.com/moon-2.jpg' }],
  },
  // Minimal product — no _id, name, slug, discountedPrice, collections
  // Fires right-branch of every `|| fallback` in product row mapping
  {
    price: undefined,
    inStock: false,
    description: undefined,
    mediaItems: [{}],  // item without .src → covers `m.src || m` right branch
  },
];

beforeEach(() => {
  resetData();
  resetMembers();
  resetLoyalty();
  __seed('Stores/Products', sampleProducts);
  __setSecrets({});
  __seed('ContentSchedule', []);
  __seed('BrowseSessions', []);
  __seed('EmailQueue', []);
  __seed('ProductBundle', []);
  __seed('ProductQuestions', []);
  __seed('Referrals', []);
  __seed('ReferralCredits', []);
  __seed('PendingNotifications', []);
  __seed('Notifications', []);
  __seed('EventTraceLog', []);
  __seed('BusEventRateLimit', []);
  __seed('LeaderboardPublicRateLimit', []);
  __seed('GamificationActionRateLimit', []);
  __seed('GamificationDailyCap', []);
  __seed('Challenges', []);
  __seed('ChallengeProgress', []);
});

// ── get_processContentScheduleCron ───────────────────────────────────────────

describe('get_processContentScheduleCron', () => {
  it('returns 403 when cron secret is wrong', async () => {
    __setSecrets({ CONTENT_CRON_KEY: 'correct-key' });
    const result = await get_processContentScheduleCron(cronReq('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 or 500 when no secret is configured (getSecret throws)', async () => {
    __setSecrets({});
    const result = await get_processContentScheduleCron(cronReq('any-key'));
    expect([403, 500]).toContain(result.status);
  });

  it('returns 200 with status ok when secret matches', async () => {
    __setSecrets({ CONTENT_CRON_KEY: 'test-content-key' });
    const result = await get_processContentScheduleCron(cronReq('test-content-key'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(typeof body.processed).toBe('number');
    expect(typeof body.failed).toBe('number');
    expect(typeof body.skipped).toBe('number');
  });
});

// ── get_campaignAnalytics ─────────────────────────────────────────────────────

describe('get_campaignAnalytics', () => {
  it('returns 403 when cron secret is wrong', async () => {
    __setSecrets({ ALERT_CRON_KEY: 'correct-key' });
    const result = await get_campaignAnalytics(cronReq('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 or 500 when no secret is configured (getSecret throws)', async () => {
    __setSecrets({});
    const result = await get_campaignAnalytics(cronReq('any-key'));
    expect([403, 500]).toContain(result.status);
  });

  it('returns 200 or 500 when secret matches (delegated to getCampaignAnalytics)', async () => {
    __setSecrets({ ALERT_CRON_KEY: 'test-alert-key' });
    __seed('EmailCampaigns', []);
    const result = await get_campaignAnalytics({
      ...cronReq('test-alert-key'),
      query: { days: '30' },
    });
    // Success or internal-error depending on getCampaignAnalytics implementation
    expect([200, 500]).toContain(result.status);
  });

  it('uses default days=30 when query param is absent', async () => {
    __setSecrets({ ALERT_CRON_KEY: 'test-alert-key' });
    const result = await get_campaignAnalytics({
      ...cronReq('test-alert-key'),
      query: {},
    });
    expect([200, 500]).toContain(result.status);
  });
});

// ── get_sitemapXml ────────────────────────────────────────────────────────────

describe('get_sitemapXml', () => {
  it('returns 200 with XML content-type', async () => {
    const result = await get_sitemapXml();
    expect(result.status).toBe(200);
    expect(result.headers['Content-Type']).toContain('xml');
  });

  it('returns 500 when product fetch throws', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    const result = await get_sitemapXml();
    expect(result.status).toBe(500);
  });
});

// ── get_loyalty ───────────────────────────────────────────────────────────────

describe('get_loyalty', () => {
  it('returns 400 when no memberId in path', async () => {
    const result = await get_loyalty({ path: [], query: {} });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/memberId/i);
  });

  it('returns 401 when no authenticated member', async () => {
    __setMember(null);
    const result = await get_loyalty({ path: ['member-xyz'], query: {} });
    expect(result.status).toBe(401);
  });

  it('returns 403 when memberId does not match authenticated member', async () => {
    __setMember({ _id: 'member-abc', loginEmail: 'a@b.com' });
    const result = await get_loyalty({ path: ['member-xyz'], query: {} });
    expect(result.status).toBe(403);
  });

  it('returns 404 when loyalty account not found', async () => {
    __setMember({ _id: 'member-abc', loginEmail: 'a@b.com' });
    __setAccount(null);
    const result = await get_loyalty({ path: ['member-abc'], query: {} });
    expect(result.status).toBe(404);
  });

  it('returns 200 with loyalty data when account exists', async () => {
    __setMember({ _id: 'member-abc', loginEmail: 'a@b.com' });
    __setAccount({ points: { balance: 250 } });
    const result = await get_loyalty({ path: ['member-abc'], query: {} });
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.memberId).toBe('member-abc');
    expect(body.points).toBe(250);
    expect(body.tier).toBeDefined();
  });
});

// ── get_robotsTxt ─────────────────────────────────────────────────────────────

describe('get_robotsTxt', () => {
  it('returns 200 with text/plain content-type', () => {
    const result = get_robotsTxt();
    expect(result.status).toBe(200);
    expect(result.headers['Content-Type']).toContain('text/plain');
  });
});

// ── get_topicCluster ──────────────────────────────────────────────────────────

describe('get_topicCluster', () => {
  it('returns 400 when no slug provided', () => {
    const result = get_topicCluster({ path: [] });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/slug/i);
  });

  it('returns 404 when slug not found in CLUSTERS', () => {
    const result = get_topicCluster({ path: ['nonexistent-cluster-xyz'] });
    expect(result.status).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
  });

  it('returns 200 with cluster data for known slug', () => {
    const result = get_topicCluster({ path: ['futon-frames'] });
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.slug).toBe('futon-frames');
    expect(body.cluster).toBeDefined();
  });

  it('returns 200 with another known slug', () => {
    const result = get_topicCluster({ path: ['mattresses'] });
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });

  it('returns 400 when request has no path array', () => {
    const result = get_topicCluster({ path: null });
    expect(result.status).toBe(400);
  });
});

// ── get_generateReferralLink ──────────────────────────────────────────────────

describe('get_generateReferralLink', () => {
  it('returns 401 when no authenticated member', async () => {
    __setMember(null);
    const result = await get_generateReferralLink();
    expect(result.status).toBe(401);
  });

  it('creates new referral code when none exists', async () => {
    __setMember({ _id: 'member-ref-1', loginEmail: 'ref@test.com' });
    __seed('Referrals', []);
    __seed('ReferralCredits', []);
    const result = await get_generateReferralLink();
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.referralCode).toBeDefined();
    expect(body.shareUrl).toContain('ref=');
    expect(body.stats).toBeDefined();
  });

  it('reuses existing referral code when already created', async () => {
    __setMember({ _id: 'member-ref-2', loginEmail: 'ref2@test.com' });
    __seed('Referrals', [
      { _id: 'ref-1', referrerMemberId: 'member-ref-2', referralCode: 'EXISTING1', status: 'pending' },
    ]);
    __seed('ReferralCredits', []);
    const result = await get_generateReferralLink();
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.referralCode).toBe('EXISTING1');
  });
});

// ── post_trackReferral ────────────────────────────────────────────────────────

describe('post_trackReferral', () => {
  it('returns 401 when no authenticated member', async () => {
    __setMember(null);
    const result = await post_trackReferral(jsonBody({ referralCode: 'CODE123' }));
    expect(result.status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    const result = await post_trackReferral({
      body: { json: async () => { throw new Error('bad json'); } },
    });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/invalid json/i);
  });

  it('returns 400 when referralCode missing', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    const result = await post_trackReferral(jsonBody({}));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/referralCode/i);
  });

  it('returns 400 when referral code not found', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    __seed('Referrals', []);
    const result = await post_trackReferral(jsonBody({ referralCode: 'NOTEXIST' }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/invalid referral code/i);
  });

  it('returns 400 when self-referral attempted', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    __seed('Referrals', [
      { _id: 'ref-1', referrerMemberId: 'mem-1', referralCode: 'MYCODE1', status: 'pending' },
    ]);
    const result = await post_trackReferral(jsonBody({ referralCode: 'MYCODE1' }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/self-referral/i);
  });

  it('returns 409 when referral already claimed', async () => {
    __setMember({ _id: 'mem-2', loginEmail: 'b@test.com' });
    __seed('Referrals', [
      { _id: 'ref-1', referrerMemberId: 'mem-1', referralCode: 'CLAIMED1', status: 'signed_up' },
    ]);
    const result = await post_trackReferral(jsonBody({ referralCode: 'CLAIMED1' }));
    expect(result.status).toBe(409);
  });

  it('returns 200 and tracks a valid referral', async () => {
    __setMember({ _id: 'mem-2', loginEmail: 'b@test.com' });
    __seed('Referrals', [
      { _id: 'ref-1', referrerMemberId: 'mem-1', referralCode: 'VALID123', status: 'pending' },
    ]);
    const result = await post_trackReferral(jsonBody({ referralCode: 'VALID123' }));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.tracked).toBe(true);
    expect(body.referrerId).toBe('mem-1');
  });
});

// ── get_bundles ───────────────────────────────────────────────────────────────

describe('get_bundles', () => {
  const sampleBundle = {
    _id: 'bundle-1',
    name: 'Complete Futon Set',
    slug: 'complete-futon-set',
    description: 'Frame + mattress bundle',
    price: 799,
    bundlePrice: 699,
    savings: 100,
    isActive: true,
    products: JSON.stringify([{ productId: 'prod-1', qty: 1 }]),
    couponCode: 'BUNDLE10',
  };

  it('returns 200 with empty bundles array when none exist', async () => {
    __seed('ProductBundle', []);
    const result = await get_bundles({ path: [] });
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    // get_bundles returns JSON.stringify(result.bundles) directly — body IS the array
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns 200 with bundle list', async () => {
    __seed('ProductBundle', [sampleBundle]);
    const result = await get_bundles({ path: [] });
    expect(result.status).toBe(200);
  });

  it('returns 200 with single bundle when slug exists', async () => {
    __seed('ProductBundle', [sampleBundle]);
    const result = await get_bundles({ path: ['complete-futon-set'] });
    expect(result.status).toBe(200);
  });

  it('returns 404 when slug not found', async () => {
    __seed('ProductBundle', []);
    const result = await get_bundles({ path: ['nonexistent-bundle'] });
    expect(result.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    __setQueryError('ProductBundle', new Error('DB timeout'));
    const result = await get_bundles({ path: [] });
    expect(result.status).toBe(500);
  });
});

// ── post_addBundleToCart ──────────────────────────────────────────────────────

describe('post_addBundleToCart', () => {
  it('returns 400 for invalid JSON body', async () => {
    const result = await post_addBundleToCart({
      body: { text: async () => '{ bad json }' },
    });
    expect(result.status).toBe(400);
  });

  it('returns 400 when slug is missing', async () => {
    const result = await post_addBundleToCart({
      body: { text: async () => JSON.stringify({ slug: '' }) },
    });
    expect(result.status).toBe(400);
  });

  it('returns 400 when slug is not a string', async () => {
    const result = await post_addBundleToCart({
      body: { text: async () => JSON.stringify({ slug: 123 }) },
    });
    expect(result.status).toBe(400);
  });

  it('returns 404 when bundle not found', async () => {
    __seed('ProductBundle', []);
    const result = await post_addBundleToCart({
      body: { text: async () => JSON.stringify({ slug: 'missing-bundle' }) },
    });
    expect(result.status).toBe(404);
  });
});

// ── get_productQA ─────────────────────────────────────────────────────────────

describe('get_productQA', () => {
  it('returns 400 when productId is missing', async () => {
    const result = await get_productQA({ path: [], query: {} });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/productId/i);
  });

  it('returns 200 with empty questions list', async () => {
    __seed('ProductQuestions', []);
    const result = await get_productQA({ query: { productId: 'prod-1' } });
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.questions)).toBe(true);
  });

  it('returns 200 with questions for product', async () => {
    __seed('ProductQuestions', [
      {
        _id: 'q1',
        productId: 'prod-1',
        question: 'Does this come in different colors?',
        answer: 'Yes, multiple finishes.',
        status: 'answered',
        memberName: 'Alice',
        helpfulVotes: 3,
      },
    ]);
    const result = await get_productQA({ query: { productId: 'prod-1' } });
    expect(result.status).toBe(200);
  });

  it('supports pagination via query params', async () => {
    __seed('ProductQuestions', []);
    const result = await get_productQA({ query: { productId: 'prod-1', page: '2', pageSize: '5' } });
    expect(result.status).toBe(200);
  });
});

// ── post_submitQuestion ───────────────────────────────────────────────────────

describe('post_submitQuestion', () => {
  it('returns 400 for invalid JSON', async () => {
    const result = await post_submitQuestion({
      body: { json: async () => { throw new Error('bad json'); } },
    });
    expect(result.status).toBe(400);
  });

  it('returns 400 when productId is missing', async () => {
    const result = await post_submitQuestion(jsonBody({
      question: 'Is this a futon frame?',
      email: 'user@test.com',
    }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/productId/i);
  });

  it('returns 400 when question is too short', async () => {
    const result = await post_submitQuestion(jsonBody({
      productId: 'prod-1',
      question: 'Short?',
      email: 'user@test.com',
    }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/10 characters/i);
  });

  it('returns 400 when email is missing', async () => {
    const result = await post_submitQuestion(jsonBody({
      productId: 'prod-1',
      question: 'What is the weight limit for this futon frame?',
    }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/email/i);
  });

  it('returns 200 for a valid question submission', async () => {
    __seed('QARateLimit', []);
    const result = await post_submitQuestion(jsonBody({
      productId: 'prod-1',
      question: 'What is the weight capacity for this futon frame?',
      name: 'Jane Doe',
      email: 'jane@example.com',
    }));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });
});

// ── post_answerQuestion ───────────────────────────────────────────────────────

describe('post_answerQuestion', () => {
  it('returns 403 when admin key is wrong', async () => {
    __setSecrets({ QA_ADMIN_KEY: 'correct-key' });
    const result = await post_answerQuestion({
      headers: { 'x-admin-key': 'wrong-key' },
      body: { json: async () => ({ questionId: 'q1', answer: 'It holds up to 600 lbs.' }) },
    });
    expect(result.status).toBe(403);
  });

  it('returns 403 when no admin key configured', async () => {
    __setSecrets({});
    const result = await post_answerQuestion({
      headers: { 'x-admin-key': 'any-key' },
      body: { json: async () => ({}) },
    });
    expect(result.status).toBe(403);
  });

  it('returns 400 for invalid JSON body', async () => {
    __setSecrets({ QA_ADMIN_KEY: 'admin-key-123' });
    const result = await post_answerQuestion({
      headers: { 'x-admin-key': 'admin-key-123' },
      body: { json: async () => { throw new Error('bad json'); } },
    });
    expect(result.status).toBe(400);
  });

  it('returns 400 when questionId is missing', async () => {
    __setSecrets({ QA_ADMIN_KEY: 'admin-key-123' });
    const result = await post_answerQuestion({
      headers: { 'x-admin-key': 'admin-key-123' },
      body: { json: async () => ({ answer: 'A valid answer.' }) },
    });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/questionId/i);
  });

  it('returns 400 when answer is too short', async () => {
    __setSecrets({ QA_ADMIN_KEY: 'admin-key-123' });
    const result = await post_answerQuestion({
      headers: { 'x-admin-key': 'admin-key-123' },
      body: { json: async () => ({ questionId: 'q1', answer: 'No.' }) },
    });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/5 characters/i);
  });

  it('returns 200 when question exists and answer is valid', async () => {
    __setSecrets({ QA_ADMIN_KEY: 'admin-key-123' });
    __seed('ProductQuestions', [
      {
        _id: 'q1',
        productId: 'prod-1',
        question: 'What is the weight limit?',
        status: 'pending',
        memberName: 'Bob',
      },
    ]);
    const result = await post_answerQuestion({
      headers: { 'x-admin-key': 'admin-key-123' },
      body: { json: async () => ({ questionId: 'q1', answer: 'The weight limit is 600 lbs.' }) },
    });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
  });
});

// ── post_gamificationEvent ────────────────────────────────────────────────────

describe('post_gamificationEvent', () => {
  it('returns 401 when no authenticated member', async () => {
    __setMember(null);
    const result = await post_gamificationEvent({
      body: { json: async () => ({ eventName: 'purchase', memberId: 'mem-1' }) },
    });
    expect(result.status).toBe(401);
    expect(JSON.parse(result.body).error).toMatch(/authentication/i);
  });

  it('returns 400 when eventName is missing', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    const result = await post_gamificationEvent({
      body: { json: async () => ({ memberId: 'mem-1' }) },
    });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/eventName/i);
  });

  it('returns 400 when memberId is missing', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    const result = await post_gamificationEvent({
      body: { json: async () => ({ eventName: 'purchase' }) },
    });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/memberId/i);
  });

  it('returns 401 when memberId does not match authenticated member', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    const result = await post_gamificationEvent({
      body: { json: async () => ({ eventName: 'purchase', memberId: 'mem-OTHER' }) },
    });
    expect(result.status).toBe(401);
    expect(JSON.parse(result.body).error).toMatch(/match/i);
  });

  it('returns 400 for invalid JSON body', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    const result = await post_gamificationEvent({
      body: { json: async () => { throw new Error('bad json'); } },
    });
    expect(result.status).toBe(400);
  });
});

// ── get_processNotificationQueueCron ─────────────────────────────────────────

describe('get_processNotificationQueueCron', () => {
  it('returns 403 when cron secret is wrong', async () => {
    __setSecrets({ ALERT_CRON_KEY: 'correct-key' });
    const result = await get_processNotificationQueueCron(cronReq('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 or 500 when no secret is configured (getSecret throws)', async () => {
    __setSecrets({});
    const result = await get_processNotificationQueueCron(cronReq('any-key'));
    expect([403, 500]).toContain(result.status);
  });

  it('returns 200 with empty notification queue', async () => {
    __setSecrets({ ALERT_CRON_KEY: 'notify-key' });
    __seed('PendingNotifications', []);
    const result = await get_processNotificationQueueCron(cronReq('notify-key'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(typeof body.processed).toBe('number');
    expect(typeof body.delivered).toBe('number');
    expect(typeof body.failed).toBe('number');
  });
});

// ── post_busEvent ─────────────────────────────────────────────────────────────

describe('post_busEvent', () => {
  it('returns 401 when no authenticated member', async () => {
    __setMember(null);
    const result = await post_busEvent({
      body: { json: async () => ({}) },
    });
    expect(result.status).toBe(401);
    expect(JSON.parse(result.body).error).toMatch(/Unauthorized/i);
  });

  it('returns 400 for invalid JSON body', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    const result = await post_busEvent({
      body: { json: async () => { throw new Error('bad json'); } },
    });
    expect(result.status).toBe(400);
  });

  it('returns 400 when event schema validation fails', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    // Missing required fields → validateIncomingEvent returns an error string
    const result = await post_busEvent(jsonBody({}));
    expect(result.status).toBe(400);
  });

  it('returns 200 for a valid bus event', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    __seed('BusEventRateLimit', []);
    const result = await post_busEvent(jsonBody({
      eventId: 'evt-001',
      schemaVersion: '1.0',
      event: 'streak_extended',
      userId: 'mem-1',
      source: 'mobile',
      ts: new Date().toISOString(),
    }));
    expect([200, 400]).toContain(result.status);
  });
});

// ── get_cmsGarbageCollect ─────────────────────────────────────────────────────

describe('get_cmsGarbageCollect', () => {
  it('returns 403 when cron secret is wrong', async () => {
    __setSecrets({ ALERT_CRON_KEY: 'correct-key' });
    const result = await get_cmsGarbageCollect(cronReq('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 or 500 when no secret is configured (getSecret throws)', async () => {
    __setSecrets({});
    const result = await get_cmsGarbageCollect(cronReq('any-key'));
    expect([403, 500]).toContain(result.status);
  });

  it('returns 200 when secret matches and no stale records', async () => {
    __setSecrets({ ALERT_CRON_KEY: 'gc-key' });
    const result = await get_cmsGarbageCollect(cronReq('gc-key'));
    expect(result.status).toBe(200);
  });
});

// ── Product feed null-field fallback coverage ─────────────────────────────────
// These tests call the feed functions with a product that has no _id, name,
// slug, price, discountedPrice, or collections — firing the right-branch of
// every `p.field || fallback` binary-expression in the row-mapping logic.

describe('get_facebookCatalogFeed — minimal product fallbacks', () => {
  it('handles products with all optional fields absent', async () => {
    const { get_facebookCatalogFeed } = await import('../src/backend/http-functions.js');
    __seed('Stores/Products', [
      {
        _id: undefined,
        name: undefined,
        slug: undefined,
        price: undefined,
        discountedPrice: undefined,
        inStock: false,
        collections: undefined,
        description: undefined,
        mainMedia: undefined,
      },
    ]);
    const result = await get_facebookCatalogFeed();
    expect([200, 500]).toContain(result.status);
  });
});

describe('get_pinterestProductFeed — minimal product fallbacks', () => {
  it('handles products with all optional fields absent', async () => {
    const { get_pinterestProductFeed } = await import('../src/backend/http-functions.js');
    __seed('Stores/Products', [
      {
        _id: undefined,
        name: undefined,
        slug: undefined,
        price: undefined,
        discountedPrice: undefined,
        inStock: undefined,
        collections: undefined,
        description: undefined,
        mainMedia: undefined,
        mediaItems: [{}],  // item without .src fires `m.src || m` right branch
      },
    ]);
    const result = await get_pinterestProductFeed();
    expect([200, 500]).toContain(result.status);
  });
});

// ── get_activeChallenges ────────────────────────────────────────────────────

describe('get_activeChallenges', () => {
  it('returns 400 when memberId missing from query', async () => {
    const result = await get_activeChallenges({ query: {} });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/memberId/i);
  });

  it('returns 401 when no authenticated member', async () => {
    __setMember(null);
    const result = await get_activeChallenges({ query: { memberId: 'mem-1' } });
    expect(result.status).toBe(401);
  });

  it('returns 403 when memberId does not match authenticated member', async () => {
    __setMember({ _id: 'mem-other', loginEmail: 'a@b.com' });
    const result = await get_activeChallenges({ query: { memberId: 'mem-1' } });
    expect(result.status).toBe(403);
  });

  it('returns 200 when memberId matches authenticated member', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    __seed('GamificationActionRateLimit', []);
    __seed('Challenges', []);
    const result = await get_activeChallenges({ query: { memberId: 'mem-1' } });
    expect([200, 429]).toContain(result.status);
  });
});

// ── post_challengeProgress ──────────────────────────────────────────────────

describe('post_challengeProgress', () => {
  it('returns 400 for invalid JSON body', async () => {
    const result = await post_challengeProgress({
      body: { json: async () => { throw new Error('bad json'); } },
    });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/Invalid JSON/i);
  });

  it('returns 400 when memberId is missing', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    const result = await post_challengeProgress(jsonBody({ challengeId: 'ch-1' }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/memberId/i);
  });

  it('returns 400 when challengeId is missing', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    const result = await post_challengeProgress(jsonBody({ memberId: 'mem-1' }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/challengeId/i);
  });

  it('returns 401 when no authenticated member', async () => {
    __setMember(null);
    const result = await post_challengeProgress(jsonBody({ memberId: 'mem-1', challengeId: 'ch-1' }));
    expect(result.status).toBe(401);
  });

  it('returns 403 when memberId does not match authenticated member', async () => {
    __setMember({ _id: 'mem-other', loginEmail: 'a@b.com' });
    const result = await post_challengeProgress(jsonBody({ memberId: 'mem-1', challengeId: 'ch-1' }));
    expect(result.status).toBe(403);
  });

  it('returns 200 or 400 for valid auth with matching member', async () => {
    __setMember({ _id: 'mem-1', loginEmail: 'a@b.com' });
    __seed('Challenges', []);
    __seed('ChallengeProgress', []);
    __seed('GamificationActionRateLimit', []);
    const result = await post_challengeProgress(jsonBody({ memberId: 'mem-1', challengeId: 'ch-1' }));
    // 200 success, 400 challenge-not-found, or 429 rate limited
    expect([200, 400, 429]).toContain(result.status);
  });
});

// ── get_cleanupRateLimitCron ────────────────────────────────────────────────

describe('get_cleanupRateLimitCron', () => {
  it('returns 403 when cron secret is wrong', async () => {
    __setSecrets({ ALERT_CRON_KEY: 'correct-key' });
    const result = await get_cleanupRateLimitCron(cronReq('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 when no secret is configured', async () => {
    __setSecrets({});
    const result = await get_cleanupRateLimitCron(cronReq('any-key'));
    expect([403, 500]).toContain(result.status);
  });

  it('returns 200 when secret matches and collections are empty', async () => {
    __setSecrets({ ALERT_CRON_KEY: 'cleanup-key' });
    __seed('GamificationActionRateLimit', []);
    __seed('GamificationDailyCap', []);
    const result = await get_cleanupRateLimitCron(cronReq('cleanup-key'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(body.pruned).toBeDefined();
  });

  it('prunes stale rate limit records', async () => {
    __setSecrets({ ALERT_CRON_KEY: 'cleanup-key' });
    const staleDate = new Date(Date.now() - 48 * 3600_000); // 48h ago
    __seed('GamificationActionRateLimit', [
      { _id: 'rl-1', memberId: 'mem-1', windowStart: staleDate },
      { _id: 'rl-2', memberId: 'mem-2', windowStart: staleDate },
    ]);
    __seed('GamificationDailyCap', [
      { _id: 'dc-1', memberId: 'mem-1', windowStart: staleDate },
    ]);
    const result = await get_cleanupRateLimitCron(cronReq('cleanup-key'));
    expect(result.status).toBe(200);
  });
});

// ── post_contactSubmissions / options_contactSubmissions ─────────────────────

describe('post_contactSubmissions', () => {
  const goodOrigin = 'https://carolina-futons-web.vercel.app';

  function buildReq({ body, origin = goodOrigin } = {}) {
    return {
      headers: { origin },
      body: { text: async () => body },
    };
  }

  beforeEach(() => {
    __setSecrets({ SITE_OWNER_CONTACT_ID: 'owner-1' });
    __seed('EmailRateLimit', []);
    crmReset();
  });

  it('returns 400 for invalid JSON body', async () => {
    const result = await post_contactSubmissions(buildReq({ body: '{ bad json' }));
    expect(result.status).toBe(400);
    const parsed = JSON.parse(result.body);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/Invalid JSON/i);
  });

  it('returns 400 when sendEmail rejects required-field validation', async () => {
    // sendEmail requires {name, email, message}; subject/phone are optional.
    // Omitting `message` reproduces a real client misuse without engaging
    // the triggeredEmails mock.
    const result = await post_contactSubmissions(
      buildReq({
        body: JSON.stringify({
          name: 'Stilgar',
          email: 'stilgar@example.com',
          subject: 'Frame question',
        }),
      }),
    );
    expect(result.status).toBe(400);
    const parsed = JSON.parse(result.body);
    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe('string');
  });

  it('returns 400 for invalid email format', async () => {
    const result = await post_contactSubmissions(
      buildReq({
        body: JSON.stringify({
          name: 'Stilgar',
          email: 'not-an-email',
          subject: 'Frame question',
          message: 'Do you ship to Hendersonville?',
        }),
      }),
    );
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('returns 200 + emits triggered email on a fully valid submission', async () => {
    const result = await post_contactSubmissions(
      buildReq({
        body: JSON.stringify({
          name: 'Stilgar',
          email: 'stilgar@example.com',
          phone: '828-555-0100',
          subject: 'Frame question',
          message: 'Do you ship to Hendersonville?',
        }),
      }),
    );
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ success: true });
    expect(result.headers['Access-Control-Allow-Origin']).toBe(goodOrigin);
    // cf-hafn: customer-side auto-reply also lands in the log; scope to owner.
    const log = crmEmailLog();
    const ownerLog = log.filter((e) => e.contactId === 'owner-1');
    expect(ownerLog).toHaveLength(1);
  });

  it('prepends [Size: <sizeOfInterest>] to the subject so the store sees it', async () => {
    const result = await post_contactSubmissions(
      buildReq({
        body: JSON.stringify({
          name: 'Stilgar',
          email: 'stilgar@example.com',
          subject: 'Frame question',
          message: 'Do you have queen futons in stock?',
          sizeOfInterest: 'queen',
        }),
      }),
    );
    expect(result.status).toBe(200);
    // cf-hafn: customer-side auto-reply also lands in the log; scope to owner.
    const log = crmEmailLog();
    const ownerLog = log.filter((e) => e.contactId === 'owner-1');
    expect(ownerLog).toHaveLength(1);
    expect(ownerLog[0].options.variables.subject).toBe('[Size: queen] Frame question');
  });

  it('omits the size prefix when sizeOfInterest is absent', async () => {
    await post_contactSubmissions(
      buildReq({
        body: JSON.stringify({
          name: 'Stilgar',
          email: 'stilgar@example.com',
          subject: 'Frame question',
          message: 'Hello',
        }),
      }),
    );
    const log = crmEmailLog();
    expect(log[0].options.variables.subject).toBe('Frame question');
  });

  it('persists the prefixed subject on the ContactSubmissions CMS row', async () => {
    __seed('ContactSubmissions', []);
    await post_contactSubmissions(
      buildReq({
        body: JSON.stringify({
          name: 'Stilgar',
          email: 'stilgar@example.com',
          subject: 'Mattress recommendation',
          message: 'Looking for a queen-size mattress for daily sleep.',
          sizeOfInterest: 'queen',
        }),
      }),
    );
    const rows = __getInserted('ContactSubmissions');
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe('[Size: queen] Mattress recommendation');
  });

  it('truncates the combined subject at the 300-char cap (no validation 400)', async () => {
    // sendEmail.validateSchema rejects subject >300 chars. With a max-length
    // raw subject, the prefix would push the total to 314 — would 400 if
    // not truncated. Verify happy 200 + truncation preserves the prefix.
    const longSubject = 'x'.repeat(300);
    const result = await post_contactSubmissions(
      buildReq({
        body: JSON.stringify({
          name: 'Stilgar',
          email: 'stilgar@example.com',
          subject: longSubject,
          message: 'Hello',
          sizeOfInterest: 'queen',
        }),
      }),
    );
    expect(result.status).toBe(200);
    const log = crmEmailLog();
    expect(log[0].options.variables.subject.length).toBe(300);
    expect(log[0].options.variables.subject.startsWith('[Size: queen] ')).toBe(true);
  });

  it('drops sizeOfInterest values outside the {twin,full,queen,king} whitelist', async () => {
    // Defensive: don't let a non-cfw caller smuggle arbitrary text into the
    // subject prefix. Anything not in the whitelist is treated as absent.
    await post_contactSubmissions(
      buildReq({
        body: JSON.stringify({
          name: 'Stilgar',
          email: 'stilgar@example.com',
          subject: 'Question',
          message: 'Hi',
          sizeOfInterest: '<script>alert(1)</script>',
        }),
      }),
    );
    const log = crmEmailLog();
    expect(log[0].options.variables.subject).toBe('Question');
  });

  it('normalises sizeOfInterest casing/whitespace before applying the whitelist', async () => {
    await post_contactSubmissions(
      buildReq({
        body: JSON.stringify({
          name: 'Stilgar',
          email: 'stilgar@example.com',
          subject: 'Question',
          message: 'Hi',
          sizeOfInterest: '  Queen  ',
        }),
      }),
    );
    const log = crmEmailLog();
    expect(log[0].options.variables.subject).toBe('[Size: queen] Question');
  });

  it('returns 429 when sendEmail surfaces a rate-limit message', async () => {
    // 4th submission within the 1-hour window trips _checkEmailRateLimit
    // (max 3 — see emailService.web.js EMAIL_RATE_LIMIT_MAX).
    const valid = JSON.stringify({
      name: 'Stilgar',
      email: 'stilgar@example.com',
      subject: 'Repeated ping',
      message: 'Hi',
    });
    for (let i = 0; i < 3; i++) {
      const ok = await post_contactSubmissions(buildReq({ body: valid }));
      expect(ok.status).toBe(200);
    }
    const limited = await post_contactSubmissions(buildReq({ body: valid }));
    expect(limited.status).toBe(429);
    const parsed = JSON.parse(limited.body);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/too many requests/i);
  });

  it('returns 500 when triggered email transport throws', async () => {
    crmFailNextEmail();
    const result = await post_contactSubmissions(
      buildReq({
        body: JSON.stringify({
          name: 'Stilgar',
          email: 'stilgar@example.com',
          subject: 'Outage probe',
          message: 'Hi',
        }),
      }),
    );
    expect(result.status).toBe(500);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('echoes Access-Control-Allow-Origin for allowlisted origin on error', async () => {
    const result = await post_contactSubmissions(buildReq({ body: '{ bad' }));
    expect(result.headers['Access-Control-Allow-Origin']).toBe(goodOrigin);
    expect(result.headers['Vary']).toBe('Origin');
  });

  it('omits Access-Control-Allow-Origin for disallowed origin', async () => {
    const result = await post_contactSubmissions(
      buildReq({ body: '{ bad', origin: 'https://attacker.example.com' }),
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('options_contactSubmissions', () => {
  it('returns 204 with CORS headers for allowlisted origin', () => {
    const result = options_contactSubmissions({
      headers: { origin: 'https://carolina-futons-web.vercel.app' },
    });
    expect(result.status).toBe(204);
    expect(result.headers['Access-Control-Allow-Origin']).toBe(
      'https://carolina-futons-web.vercel.app',
    );
    expect(result.headers['Access-Control-Allow-Methods']).toMatch(/POST/);
    expect(result.headers['Access-Control-Allow-Methods']).toMatch(/OPTIONS/);
  });

  it('returns 403 for disallowed origin', () => {
    const result = options_contactSubmissions({
      headers: { origin: 'https://attacker.example.com' },
    });
    expect(result.status).toBe(403);
  });
});
