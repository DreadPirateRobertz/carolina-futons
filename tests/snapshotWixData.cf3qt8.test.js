/**
 * @file snapshotWixData.cf3qt8.test.js
 * @description Unit tests for scripts/cutover/snapshot-wix-data.mjs —
 * specifically the manifest-summary writer and per-collection-line
 * formatter. The network call is exercised on cutover-prep night with
 * real WIX_API_KEY/WIX_SITE_ID; not in scope here.
 *
 * cf-3qt.8 acceptance item 1.
 */

import { describe, it, expect } from 'vitest';
import {
  SNAPSHOT_COLLECTIONS,
  _internals,
} from '../scripts/cutover/snapshot-wix-data.mjs';

const { buildManifestSummary, formatCollectionLine } = _internals;

describe('SNAPSHOT_COLLECTIONS manifest', () => {
  it('lists at least the load-bearing collections', () => {
    // Anchor against a small must-have subset; the full list is allowed
    // to grow but must never lose any of these mandatory entries.
    const mandatory = [
      'SiteContent',           // Brenda's edits (Path B)
      'ContactSubmissions',    // form funnel
      'AbandonedCarts',        // recovery flow
      'EmailQueue',            // in-flight transactional emails
      'Fulfillments',          // shipping ledger
      'GiftCards',             // monetary state
      'ReferralCodes',         // monetary state
      'InventoryLevels',       // commerce-critical
    ];
    for (const id of mandatory) {
      expect(SNAPSHOT_COLLECTIONS).toContain(id);
    }
  });

  it('has no duplicates', () => {
    expect(SNAPSHOT_COLLECTIONS.length).toBe(new Set(SNAPSHOT_COLLECTIONS).size);
  });

  it('each entry is a non-empty string with no whitespace', () => {
    for (const id of SNAPSHOT_COLLECTIONS) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(id).not.toMatch(/\s/);
    }
  });
});

describe('formatCollectionLine', () => {
  it('renders a successful row with right-padded count', () => {
    const out = formatCollectionLine({ id: 'SiteContent', status: 'ok', count: 42 });
    expect(out).toMatch(/✓\s+SiteContent\s+\s+42 rows/);
  });

  it('renders a missing-collection row', () => {
    const out = formatCollectionLine({ id: 'NotProvisioned', status: 'missing' });
    expect(out).toContain('○');
    expect(out).toContain('NotProvisioned');
    expect(out).toMatch(/collection not found/i);
  });

  it('renders an error row with the error message', () => {
    const out = formatCollectionLine({ id: 'X', status: 'error', error: 'rate-limited' });
    expect(out).toContain('✗');
    expect(out).toContain('X');
    expect(out).toContain('rate-limited');
  });

  it('renders an unknown-status row defensively', () => {
    const out = formatCollectionLine({ id: 'X', status: 'weird' });
    expect(out).toContain('?');
    expect(out).toContain('X');
  });
});

describe('buildManifestSummary', () => {
  const SAMPLE = [
    { id: 'SiteContent', status: 'ok', count: 12 },
    { id: 'ContactSubmissions', status: 'ok', count: 88 },
    { id: 'NotProvisioned', status: 'missing' },
    { id: 'BadAuth', status: 'error', error: 'forbidden' },
  ];

  it('contains the cutover header and all four entries', () => {
    const md = buildManifestSummary({
      outDir: '/tmp/snap',
      capturedAtIso: '2026-05-10T03:00:00.000Z',
      results: SAMPLE,
      totalRows: 100,
    });
    expect(md).toContain('# cf-3qt.8 — Wix CMS Snapshot');
    expect(md).toContain('**Captured:** 2026-05-10T03:00:00.000Z');
    expect(md).toContain('**Output:** `/tmp/snap`');
    expect(md).toContain('**Collections requested:** 4');
    expect(md).toContain('**Total rows captured:** 100');
    expect(md).toContain('SiteContent');
    expect(md).toContain('ContactSubmissions');
    expect(md).toContain('NotProvisioned');
    expect(md).toContain('BadAuth');
  });

  it('has the not-in-snapshot caveat block', () => {
    const md = buildManifestSummary({
      outDir: '/tmp/snap',
      capturedAtIso: '2026-05-10T03:00:00.000Z',
      results: SAMPLE,
      totalRows: 100,
    });
    expect(md).toContain('## What is NOT in this snapshot');
    expect(md).toContain('Wix Stores Orders');
    expect(md).toContain('cf-3qt.8 item 5');
    expect(md).toContain('Wix Members PII');
    expect(md).toContain('Wix Media Manager');
  });

  it('has the cutover-usage block with the t+24h diff suggestion', () => {
    const md = buildManifestSummary({
      outDir: '/tmp/snap',
      capturedAtIso: '2026-05-10T03:00:00.000Z',
      results: SAMPLE,
      totalRows: 100,
    });
    expect(md).toContain('## How to use during the cutover');
    expect(md).toMatch(/t\+24h post-cutover/);
    expect(md).toMatch(/wixData\.update\(collection, row\)/);
  });
});
