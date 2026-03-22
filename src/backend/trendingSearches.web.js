// trendingSearches.web.js — Trending Searches backend web method
// Returns editorially curated search term suggestions from the TrendingSearches CMS collection.
// Singleton pattern: only ever one record. Falls back to hardcoded defaults if collection empty.
//
// Cross-rig contract: collection 'TrendingSearches', field 'terms' (array of strings).
// cfutons_mobile (dallas/cm-c00) useConfig() hook reads the same field name.
//
// @setup
// Create CMS collection `TrendingSearches` with fields:
//   terms      (Array, Text items) — ordered list of trending search terms
//   updatedAt  (Date, auto)        — last updated

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const COLLECTION = 'TrendingSearches';

const DEFAULT_TERMS = [
  'futon frames',
  'murphy beds',
  'mattresses',
  'platform beds',
  'accessories',
];

// ── getTrendingSearches ────────────────────────────────────────────────

/**
 * Return trending search terms from the TrendingSearches CMS collection.
 * Falls back to DEFAULT_TERMS if the collection is empty or terms field is missing.
 *
 * @returns {Promise<{success: boolean, terms: string[], error?: string}>}
 */
export const getTrendingSearches = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData.query(COLLECTION)
        .limit(1)
        .find();

      if (result.items.length === 0) {
        return { success: true, terms: [...DEFAULT_TERMS] };
      }

      const raw = result.items[0].terms;
      const terms = Array.isArray(raw) && raw.length > 0
        ? raw.filter(t => typeof t === 'string' && t.trim())
        : [...DEFAULT_TERMS];

      return { success: true, terms };
    } catch (e) {
      console.error('[trendingSearches] getTrendingSearches failed:', e);
      return { success: false, terms: [...DEFAULT_TERMS], error: 'Failed to load trending searches' };
    }
  }
);
