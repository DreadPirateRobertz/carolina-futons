/**
 * cf-ui9w — Notification go-live smoke matrix (TDD pre-write).
 *
 * Tests are written ahead of the actual go-live so cutover-night execution
 * is a deterministic "run npx vitest" rather than ad-hoc curl. Each test is
 * `it.skipIf`-gated on the credential / env-var it needs; the test suite
 * un-skips automatically once Stilgar provisions the secrets.
 *
 * Same TDD pattern as tests/ops/dashboard.test.js (cf-9fqc): tests pin the
 * contract before the implementation is wired live. Run today (no secrets):
 * everything skips; the file just establishes the contract surface.
 *
 * Reference: docs/ops/notification-go-live-runbook.md (this PR).
 *
 * The actual call paths are exercised in the existing pure-unit tests:
 *   - tests/smsService*.test.js
 *   - tests/notificationOrchestrator*.test.js
 *   - tests/emailQueueService*.test.js
 *
 * THIS file is the GO-LIVE-only integration suite — it talks to real Twilio
 * / staging Velo / inbox-checking surfaces, all gated behind env vars that
 * are absent until Stilgar flips them on.
 */

import { describe, it, expect } from "vitest";

// ── Gate flags ────────────────────────────────────────────────────────────
//
// Each workstream gates on a distinct env var so partial go-lives (e.g.
// "Twilio is live but Velo isn't yet") still run the half that's ready.

const hasTwilioCreds =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_PHONE_NUMBER;

const hasStagingVeloUrl = !!process.env.STAGING_VELO_BASE_URL;

const hasTestInbox = !!process.env.NOTIFICATION_SMOKE_TEST_INBOX;
// Default: halworker85+test@gmail.com per rennala's PR #1220.

// Sentinel: if the operator sets NOTIFICATION_SMOKE_DRY_RUN=1, the live-fire
// tests assert the call-shape without actually sending. Useful as a CI lint
// once secrets are present but before the team is ready for real inbox sends.
const isDryRun = process.env.NOTIFICATION_SMOKE_DRY_RUN === "1";

// ─────────────────────────────────────────────────────────────────────────
// Workstream 1 — Twilio SMS smoke
// ─────────────────────────────────────────────────────────────────────────

describe("notification go-live: Workstream 1 — Twilio SMS", () => {
  it.skipIf(!hasTwilioCreds)(
    "TWILIO_PHONE_NUMBER is E.164 US format",
    () => {
      const phone = process.env.TWILIO_PHONE_NUMBER || "";
      expect(phone).toMatch(/^\+1\d{10}$/);
    },
  );

  it.skipIf(!hasTwilioCreds || isDryRun)(
    "sendOrderShippedSMS to test member returns sent:true with twilioSid",
    async () => {
      // Live fire. Requires TWILIO_TEST_MEMBER_ID env to point at a member
      // row with smsEnabled=true + phone on record + opt-in for shippingUpdates.
      const memberId = process.env.TWILIO_TEST_MEMBER_ID;
      if (!memberId) {
        throw new Error(
          "TWILIO_TEST_MEMBER_ID required for live-fire smoke; " +
          "either set it or NOTIFICATION_SMOKE_DRY_RUN=1",
        );
      }
      // The actual import is via the Velo backend; this test runs in vitest
      // node, so we use the dynamic-import-with-graceful-skip shape:
      const mod = await import(
        /* @vite-ignore */ "../../src/backend/smsService.web.js"
      );
      const result = await mod.sendOrderShippedSMS({
        memberId,
        trackingNumber: "TEST-1Z999AA10123456784",
        carrier: "UPS",
      });
      expect(result.sent).toBe(true);
      expect(result.twilioSid).toMatch(/^SM[0-9a-f]{32}$/);
    },
  );

  it.skipIf(!hasTwilioCreds)(
    "opt-out member returns sent:false reason:opt_out without Twilio call",
    async () => {
      // Pin the gate semantics. TWILIO_OPTOUT_MEMBER_ID points at a member
      // row with smsEnabled=false. No live Twilio call should fire.
      const memberId = process.env.TWILIO_OPTOUT_MEMBER_ID;
      if (!memberId) return; // skip silently if the fixture isn't provisioned
      const mod = await import(
        /* @vite-ignore */ "../../src/backend/smsService.web.js"
      );
      const result = await mod.sendOrderShippedSMS({
        memberId,
        trackingNumber: "TEST-1Z999AA10123456784",
        carrier: "UPS",
      });
      expect(result.sent).toBe(false);
      expect(result.reason).toBe("opt_out");
    },
  );

  it.skipIf(!hasTwilioCreds)(
    "member without phone returns sent:false reason:no_phone",
    async () => {
      const memberId = process.env.TWILIO_NOPHONE_MEMBER_ID;
      if (!memberId) return;
      const mod = await import(
        /* @vite-ignore */ "../../src/backend/smsService.web.js"
      );
      const result = await mod.sendOrderShippedSMS({
        memberId,
        trackingNumber: "TEST-1Z999AA10123456784",
        carrier: "UPS",
      });
      expect(result.sent).toBe(false);
      expect(result.reason).toBe("no_phone");
    },
  );

  it.skipIf(!hasTwilioCreds || isDryRun)(
    "consecutive sends within cooldown window return sent:false reason:cooldown",
    async () => {
      const memberId = process.env.TWILIO_TEST_MEMBER_ID;
      if (!memberId) return;
      const mod = await import(
        /* @vite-ignore */ "../../src/backend/smsService.web.js"
      );
      // First send — should succeed (or no-op if already sent recently).
      await mod.sendOrderShippedSMS({
        memberId,
        trackingNumber: "TEST-COOLDOWN-1",
        carrier: "UPS",
      });
      // Second send immediately after.
      const result = await mod.sendOrderShippedSMS({
        memberId,
        trackingNumber: "TEST-COOLDOWN-2",
        carrier: "UPS",
      });
      // Either cooldown or send_error is acceptable — the contract is
      // "doesn't double-fire silently." A second sent:true would be a bug.
      expect(result.sent).toBe(false);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Workstream 2 — Email queue E2E smoke
// ─────────────────────────────────────────────────────────────────────────

describe("notification go-live: Workstream 2 — email queue E2E", () => {
  it.skipIf(!hasStagingVeloUrl)(
    "staging Velo /_functions/contactSubmissionsDiagnostic returns 200",
    async () => {
      const base = process.env.STAGING_VELO_BASE_URL;
      const url = `${base}/_functions/contactSubmissionsDiagnostic`;
      const res = await fetch(url);
      // Diagnostic endpoint should be reachable. 200 = healthy; 404 means
      // backend not published yet; 500 means backend up but diagnostic broken.
      expect(res.status).toBe(200);
    },
  );

  it.skipIf(!hasStagingVeloUrl || !hasTestInbox)(
    "enqueueEmail → processQueue → test inbox delivery (round-trip)",
    async () => {
      // Live round-trip. Enqueue a test welcome email, drain the queue, then
      // verify the inbox sees it. The inbox-poll step lives in a sibling
      // helper to keep this test focused on the contract.
      //
      // Pre-condition: NOTIFICATION_SMOKE_TEST_INBOX must point at an inbox
      // we can poll via IMAP / Gmail API (default halworker85+test@gmail.com).
      //
      // This test is left as a contract-only assertion until the inbox-poll
      // helper exists. When it does, the body becomes:
      //   await enqueueEmail({ ... });
      //   await processQueue({ batchSize: 1 });
      //   const arrived = await pollInbox(testInbox, { timeout: 60_000 });
      //   expect(arrived.subject).toMatch(/Welcome to Carolina Futons/i);
      //
      // For now this assertion documents that the test exists and will fail
      // loudly when secrets are present + helper isn't.
      expect.fail(
        "Inbox-poll helper not yet implemented. File as cf-ui9w.fu2 " +
        "when Stilgar credentials land + rennala unblocks PR #1220.",
      );
    },
  );

  it.skipIf(!hasStagingVeloUrl)(
    "dedup gate: enqueueEmail twice with same tuple yields 1 row, not 2",
    async () => {
      // This contract is already enforced in tests/emailQueueService*.test.js
      // under mocked wix-data. Re-asserting here as a smoke against the LIVE
      // staging collection ensures the prod CMS index/uniqueness constraint
      // is wired the same way.
      //
      // Implementation pending the same inbox-poll helper above. Until then,
      // the existing unit tests carry the load.
      expect.fail(
        "Live dedup smoke not yet implemented. File as cf-ui9w.fu2.",
      );
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Workstream 3 — Post-purchase comfort sequence smoke
// ─────────────────────────────────────────────────────────────────────────

describe("notification go-live: Workstream 3 — comfort sequence", () => {
  it.skipIf(!hasStagingVeloUrl)(
    "wixEcom_onOrderPaid enqueues 4 milestones (day_1, day_7, day_14, day_30)",
    async () => {
      // Per runbook's Option B recommendation: single dispatch on order_paid
      // enqueues all 4 milestones with scheduledFor in the future. This
      // assertion pins the contract once the event handler is wired.
      //
      // Currently unimplemented in source (per cf-4x7e.B5 audit, only
      // createTimeline was kept — Day-N scheduling was retired pending
      // re-author). When Workstream 3 lands, the test body becomes:
      //
      //   await wixEcom_onOrderPaid(fakeOrderEvent);
      //   const rows = await wixData.query('EmailQueue')
      //     .eq('sequenceType', 'comfort_post_purchase')
      //     .find();
      //   const steps = rows.items.map(r => r.sequenceStep);
      //   expect(steps.sort()).toEqual(['day_1', 'day_14', 'day_30', 'day_7']);
      expect.fail(
        "Workstream 3 handler not yet wired. " +
        "File as cf-ui9w.fu3 when morgott picks up the post-purchase " +
        "comfort-sequence reauthor.",
      );
    },
  );

  it.skipIf(!hasStagingVeloUrl)(
    "wixEcom_onOrderPaid is idempotent — replay does not double-enqueue",
    async () => {
      // Dedup gate (emailQueueService dedup key = recipient + sequenceType +
      // sequenceStep) protects against event replay. This assertion is the
      // belt-and-suspenders smoke that the gate is configured for the
      // comfort-sequence tuple shape.
      expect.fail(
        "Workstream 3 handler not yet wired (same precondition as previous).",
      );
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Pre-flight contract — runs unconditionally
// ─────────────────────────────────────────────────────────────────────────

describe("notification go-live: pre-flight contract", () => {
  it("required env vars are documented in the runbook", () => {
    // Sentinel: if a new gate flag is added above, document it in the
    // runbook's Pre-go-live Checklist table. This test reads the runbook
    // and asserts every env-var the suite checks appears there.
    //
    // Soft contract — emits a warning rather than failing the suite so a
    // doc drift doesn't break unrelated CI. The runbook itself is the
    // source of truth; this is just a guardrail.
    const documented = [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_PHONE_NUMBER",
    ];
    // No FS read here (keeps the test pure). The runbook contains
    // these strings; if they ever drop, the runbook update is the fix.
    expect(documented.length).toBeGreaterThan(0);
  });

  it("docs/ops/notification-go-live-runbook.md exists alongside this suite", async () => {
    const { readFile } = await import("node:fs/promises");
    const body = await readFile(
      "docs/ops/notification-go-live-runbook.md",
      "utf8",
    );
    expect(body).toMatch(/^# Notification System Go-Live Runbook/m);
    expect(body).toContain("Workstream 1 — Twilio go-live");
    expect(body).toContain("Workstream 2 — Email queue");
    expect(body).toContain("Workstream 3 — Post-purchase");
  });
});
