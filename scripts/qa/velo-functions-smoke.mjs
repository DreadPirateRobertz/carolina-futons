#!/usr/bin/env node
/**
 * @file velo-functions-smoke.mjs
 * @description Post-publish smoke suite for the 5 Velo /_functions endpoints.
 *
 * Spec: docs/qa/velo-functions-smoke-2026-05-05.md
 * Targets: staging (chrisdealglass.wixstudio.com) by default; prod via env.
 *
 * Run:
 *   node scripts/qa/velo-functions-smoke.mjs
 *   VELO_SMOKE_BASE=https://www.carolinafutons.com node scripts/qa/velo-functions-smoke.mjs
 *   CONTACT_VALID_EXPECT=200 node scripts/qa/velo-functions-smoke.mjs   # after cf-c6g5
 *
 * Exits 1 on any unexpected status; emits TAP-ish lines so the GitHub Action
 * can grep + comment.
 *
 * Standalone .mjs — does NOT depend on cfutons monorepo (per memory rule
 * "scripts/* use .mjs; never add type:module to package.json").
 */

const BASE = process.env.VELO_SMOKE_BASE || 'https://chrisdealglass.wixstudio.com/my-site';
const ORIGIN = process.env.VELO_SMOKE_ORIGIN || 'https://carolina-futons-web.vercel.app';

// Allow flipping known-broken expectations as the underlying infra fixes land.
// When a fix ships, set the env var to the new expected status — if smoke
// still sees the old status, the action will alert (regression OR mis-flip).

// cf-9ieq + cf-c6g5: sendEmail returns 500 because the Triggered Email
// template is missing. Flip to 200 once cf-c6g5 lands.
const CONTACT_VALID_EXPECT = Number(process.env.CONTACT_VALID_EXPECT || 500);

// cf-89xn-followup: newsletterService.subscribeToNewsletter currently rejects
// fresh emails with "Subscription failed. Please try again." (root cause TBD —
// likely missing CMS collection or external ESP credential). Tracked as
// follow-up bead. Flip to 200 once newsletter path is healthy.
const NEWSLETTER_VALID_EXPECT = Number(process.env.NEWSLETTER_VALID_EXPECT || 400);

// cf-89xn-followup: get_unsubscribe + post_unsubscribe paths fail with 500
// when getSecret('UNSUB_TOKEN_SECRET') throws — same SecretNotFoundError
// pattern cf-9ieq found for SITE_OWNER_CONTACT_ID. The bare catch {} in
// get_unsubscribe (silent-failure-hunter flagged on PR #18) hides this.
// Flip to 400 once UNSUB_TOKEN_SECRET secret is added to Wix Secrets Manager.
const UNSUB_INVALID_TOKEN_EXPECT = Number(process.env.UNSUB_INVALID_TOKEN_EXPECT || 500);

const RUN_ID = String(Date.now());

const cases = [];
let okCount = 0;
let failCount = 0;

function record(name, ok, detail) {
  cases.push({ name, ok, detail });
  if (ok) {
    okCount++;
    console.log(`ok ${cases.length} - ${name}`);
  } else {
    failCount++;
    console.log(`not ok ${cases.length} - ${name}\n  ${detail}`);
  }
}

async function probe({ name, method = 'GET', path, headers = {}, body, expectStatus, expectBodyMatch }) {
  const url = `${BASE}${path}`;
  const init = {
    method,
    headers: { Origin: ORIGIN, ...headers },
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  let res, text;
  try {
    res = await fetch(url, init);
    text = await res.text();
  } catch (err) {
    record(name, false, `network: ${err?.message || err}`);
    return;
  }

  const expected = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
  if (!expected.includes(res.status)) {
    record(name, false, `status: got ${res.status}, expected ${expected.join(' | ')} — body: ${text.slice(0, 200)}`);
    return;
  }
  if (expectBodyMatch) {
    const matched = expectBodyMatch instanceof RegExp ? expectBodyMatch.test(text) : text.includes(expectBodyMatch);
    if (!matched) {
      record(name, false, `body: did not match ${expectBodyMatch} — got: ${text.slice(0, 200)}`);
      return;
    }
  }
  record(name, true);
}

console.log(`# velo-functions-smoke: ${BASE} (origin=${ORIGIN}, run=${RUN_ID})`);

// ── /_functions/health ────────────────────────────────────────────────────────
await probe({ name: 'health: GET 200', path: '/_functions/health', expectStatus: 200, expectBodyMatch: /"status"\s*:\s*"ok"/ });
await probe({ name: 'health: OPTIONS 204', method: 'OPTIONS', path: '/_functions/health', expectStatus: [204, 403] }); // 403 if get_health hasn't been republished post-cf-89xn yet

// ── /_functions/contactSubmissions ───────────────────────────────────────────
await probe({
  name: `contactSubmissions: valid → ${CONTACT_VALID_EXPECT}`,
  method: 'POST', path: '/_functions/contactSubmissions',
  body: { name: 'Smoke', email: `smoke+${RUN_ID}@example.com`, subject: 'smoke', message: 'smoke run' },
  expectStatus: CONTACT_VALID_EXPECT,
});
await probe({
  name: 'contactSubmissions: invalid JSON 400',
  method: 'POST', path: '/_functions/contactSubmissions',
  body: '{ bad', expectStatus: 400, expectBodyMatch: /Invalid JSON/i,
});
await probe({
  name: 'contactSubmissions: missing message 400',
  method: 'POST', path: '/_functions/contactSubmissions',
  body: { name: 'Smoke', email: 'smoke@example.com' }, expectStatus: 400,
});
await probe({
  name: 'contactSubmissions: invalid email format 400',
  method: 'POST', path: '/_functions/contactSubmissions',
  body: { name: 'Smoke', email: 'not-an-email', message: 'y' }, expectStatus: 400,
});
await probe({ name: 'contactSubmissions: OPTIONS 204', method: 'OPTIONS', path: '/_functions/contactSubmissions', expectStatus: 204 });

// ── /_functions/mailingListSignups ───────────────────────────────────────────
await probe({
  name: `mailingListSignups: valid → ${NEWSLETTER_VALID_EXPECT}`,
  method: 'POST', path: '/_functions/mailingListSignups',
  body: { email: `smoke+${RUN_ID}@example.com`, source: 'smoke_test' },
  // 200 once newsletter service is healthy; 400 today (cf-89xn-followup);
  // 429 if a prior smoke run hit the 3/hour rate limit on the +<RUN_ID>
  // bucket (shouldn't, since timestamps are unique).
  expectStatus: [NEWSLETTER_VALID_EXPECT, 429],
});
await probe({
  name: 'mailingListSignups: invalid JSON 400',
  method: 'POST', path: '/_functions/mailingListSignups',
  body: '{ bad', expectStatus: 400,
});
await probe({
  name: 'mailingListSignups: missing email 400',
  method: 'POST', path: '/_functions/mailingListSignups',
  body: {}, expectStatus: 400,
});
await probe({
  name: 'mailingListSignups: honeypot silent 200',
  method: 'POST', path: '/_functions/mailingListSignups',
  body: { email: `smoke+honeypot+${RUN_ID}@example.com`, honeypot: 'bot' },
  expectStatus: 200,
});
await probe({ name: 'mailingListSignups: OPTIONS 204', method: 'OPTIONS', path: '/_functions/mailingListSignups', expectStatus: 204 });

// ── /_functions/sampleRequests ───────────────────────────────────────────────
await probe({
  name: 'sampleRequests: invalid JSON 400',
  method: 'POST', path: '/_functions/sampleRequests',
  body: '{ bad', expectStatus: 400,
});
await probe({
  name: 'sampleRequests: missing swatchIds 400',
  method: 'POST', path: '/_functions/sampleRequests',
  body: {
    contactInfo: { email: `smoke+${RUN_ID}@example.com`, firstName: 'S', lastName: 'T', address: '1', city: 'H', state: 'NC', zip: '28792' },
  },
  expectStatus: 400,
});
await probe({ name: 'sampleRequests: OPTIONS 204', method: 'OPTIONS', path: '/_functions/sampleRequests', expectStatus: 204 });

// ── /_functions/deliveryZone ─────────────────────────────────────────────────
await probe({
  name: 'deliveryZone: local NC zip 200',
  path: '/_functions/deliveryZone?zip=28792',
  expectStatus: 200, expectBodyMatch: /"success"\s*:\s*true/,
});
await probe({
  name: 'deliveryZone: out-of-range 200 (zone:outofrange)',
  path: '/_functions/deliveryZone?zip=99999',
  expectStatus: 200, expectBodyMatch: /"zone"\s*:\s*"outofrange"/,
});
await probe({ name: 'deliveryZone: missing zip 400', path: '/_functions/deliveryZone', expectStatus: 400 });
await probe({ name: 'deliveryZone: letters 400', path: '/_functions/deliveryZone?zip=ABCDE', expectStatus: 400 });
await probe({ name: 'deliveryZone: short zip 400', path: '/_functions/deliveryZone?zip=123', expectStatus: 400 });
await probe({ name: 'deliveryZone: OPTIONS 204', method: 'OPTIONS', path: '/_functions/deliveryZone', expectStatus: 204 });

// ── /_functions/unsubscribe ──────────────────────────────────────────────────
await probe({
  name: 'unsubscribe GET: missing token 400 HTML',
  path: '/_functions/unsubscribe',
  expectStatus: 400, expectBodyMatch: /Invalid link/i,
});
await probe({
  name: `unsubscribe GET: invalid token → ${UNSUB_INVALID_TOKEN_EXPECT} HTML`,
  path: '/_functions/unsubscribe?token=garbage',
  expectStatus: UNSUB_INVALID_TOKEN_EXPECT,
  expectBodyMatch: UNSUB_INVALID_TOKEN_EXPECT === 400 ? /invalid or has expired/i : /Error|Something went wrong/i,
});
await probe({
  name: 'unsubscribe POST: missing token 400 JSON',
  method: 'POST', path: '/_functions/unsubscribe',
  body: {}, expectStatus: 400, expectBodyMatch: /Token is required/,
});
await probe({
  name: `unsubscribe POST: invalid token → ${UNSUB_INVALID_TOKEN_EXPECT} JSON`,
  method: 'POST', path: '/_functions/unsubscribe',
  body: { token: 'garbage' },
  expectStatus: UNSUB_INVALID_TOKEN_EXPECT,
  expectBodyMatch: UNSUB_INVALID_TOKEN_EXPECT === 400 ? /invalid-token/ : /Internal server error/i,
});
await probe({
  name: 'unsubscribe POST: invalid JSON 400',
  method: 'POST', path: '/_functions/unsubscribe',
  body: '{ bad', expectStatus: 400,
});
await probe({ name: 'unsubscribe OPTIONS: 204', method: 'OPTIONS', path: '/_functions/unsubscribe', expectStatus: 204 });

console.log(`\n1..${cases.length}`);
console.log(`# pass: ${okCount}, fail: ${failCount}`);
process.exit(failCount === 0 ? 0 : 1);
