/**
 * @module siteContentSeed
 * @description One-shot seed script for the SiteContent CMS collection that
 * powers the cfw owner-editable copy reader (cf-4mol / cfw-66o.2). Stilgar
 * (or melania) creates the collection schema in Wix Studio Dashboard then
 * runs `seedSiteContent()` once from the Velo backend to populate the
 * 20 default rows. Subsequent runs are idempotent — existing keys are
 * skipped, missing ones added, and any user edits already in place are
 * preserved.
 *
 * cfw-66o.6 / cf-atze.
 *
 * ## Wix Studio Dashboard schema (do this first)
 * Collection ID: SiteContent
 * Permissions: Site Members may read; only Admin can write
 * Fields:
 *   - key (TEXT, primary, unique) — dotted path, e.g. "footer.tagline"
 *   - value (TEXT) — the displayed copy; cfw treats non-string values as missing
 *   - description (TEXT) — where this string surfaces, for Brenda
 *   - updatedAt (DATETIME) — last edit (Wix auto-stamps _updatedDate too)
 *
 * ## How to run
 * From the Velo Editor's "Test API" or Wix CLI:
 *   await import('backend/siteContentSeed.web').then(m => m.seedSiteContent());
 *
 * @requires wix-data
 * @requires backend/utils/errorHandler - logError
 */

import { webMethod, Permissions } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

const COLLECTION = 'SiteContent';

/**
 * Seed rows. Keys mirror the dotted paths the cfw `getSiteContent` reader
 * uses; values match what the page renders today (so any deploy that ships
 * before this script runs still produces correct copy via the reader's
 * fallback path). Brenda edits these freely from the Wix Studio Content
 * Manager — that's the whole point.
 *
 * Source of truth for fallbacks:
 *   - footer.tagline / footer.copyrightLine: src/components/site/Footer.tsx
 *   - hero.headline / hero.subhead: src/components/theme-d/FilterFirst.tsx
 *   - visit.hours.* : src/app/visit/page.tsx (post-Brenda #475 schedule)
 *   - announcement.* : src/components/site/AnnouncementBarCartAware.tsx
 */
export const SITE_CONTENT_SEED = [
  {
    key: 'footer.tagline',
    value: 'Quality futons since 1991',
    description: 'Site footer wordmark tagline (under the Carolina Futons logo)',
  },
  {
    key: 'footer.copyrightLine',
    value: 'Carolina Futons. Hendersonville, NC.',
    description:
      'Site footer copyright line; the year is auto-prepended by the page',
  },

  {
    key: 'hero.headline',
    value: 'Hardwood futons, built to last',
    description: 'Home page hero headline (top of /)',
  },
  {
    key: 'hero.subhead',
    value: 'Family-owned in Hendersonville, NC since 1991',
    description: 'Home page hero subhead under the headline',
  },

  {
    key: 'visit.hours.sun-tue',
    value: '10 am – 5 pm',
    description: 'Store hours for Sunday through Tuesday on /visit',
  },
  {
    key: 'visit.hours.wed-sat',
    value: 'Closed',
    description: 'Store hours for Wednesday through Saturday on /visit',
  },

  {
    key: 'announcement.rotation.1.message',
    value: 'Free white-glove delivery on orders over $1,500',
    description: 'Announcement bar rotation slot 1 — message',
  },
  { key: 'announcement.rotation.1.cta-label', value: '', description: 'Slot 1 CTA label (empty = no CTA)' },
  { key: 'announcement.rotation.1.cta-href', value: '', description: 'Slot 1 CTA destination URL' },

  {
    key: 'announcement.rotation.2.message',
    value: '10-year warranty on all hardwood futon frames',
    description: 'Announcement bar rotation slot 2 — message',
  },
  { key: 'announcement.rotation.2.cta-label', value: '', description: 'Slot 2 CTA label' },
  { key: 'announcement.rotation.2.cta-href', value: '', description: 'Slot 2 CTA destination URL' },

  {
    key: 'announcement.rotation.3.message',
    value: 'Family-owned since 1991 · Hendersonville, NC',
    description: 'Announcement bar rotation slot 3 — message',
  },
  { key: 'announcement.rotation.3.cta-label', value: '', description: 'Slot 3 CTA label' },
  { key: 'announcement.rotation.3.cta-href', value: '', description: 'Slot 3 CTA destination URL' },

  {
    key: 'announcement.rotation.4.message',
    value: 'Free fabric swatches — find your perfect match',
    description: 'Announcement bar rotation slot 4 — message',
  },
  {
    key: 'announcement.rotation.4.cta-label',
    value: 'Order free swatches',
    description: 'Slot 4 CTA label',
  },
  {
    key: 'announcement.rotation.4.cta-href',
    value: '/swatch-request',
    description: 'Slot 4 CTA destination URL',
  },

  {
    key: 'announcement.rotation.5.message',
    value: 'Assembly included with every delivery',
    description: 'Announcement bar rotation slot 5 — message',
  },
  { key: 'announcement.rotation.5.cta-label', value: '', description: 'Slot 5 CTA label' },
  { key: 'announcement.rotation.5.cta-href', value: '', description: 'Slot 5 CTA destination URL' },
];

/**
 * Insert seed rows that don't already exist. Existing rows are left alone —
 * a row that's been hand-edited by Brenda must NEVER be overwritten by a
 * re-run of this script.
 *
 * @returns {Promise<{inserted: number, skipped: number, errors: number}>}
 */
async function _seedSiteContent() {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const now = new Date();

  for (const row of SITE_CONTENT_SEED) {
    try {
      const existing = await wixData
        .query(COLLECTION)
        .eq('key', row.key)
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        skipped += 1;
        continue;
      }

      await wixData.insert(COLLECTION, {
        key: row.key,
        value: row.value,
        description: row.description,
        updatedAt: now,
      });
      inserted += 1;
    } catch (err) {
      errors += 1;
      logError(`siteContentSeed:${row.key}`, err);
    }
  }

  return { inserted, skipped, errors };
}

/**
 * Admin-only entry point. Run once from the Velo Editor or Wix CLI after
 * the SiteContent collection schema is created in Wix Studio Dashboard.
 */
export const seedSiteContent = webMethod(Permissions.Admin, _seedSiteContent);

// Exported for unit tests; not part of the public surface.
export const _internal = { _seedSiteContent };
