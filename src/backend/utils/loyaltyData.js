/**
 * @module loyaltyData
 * Shared plain module (no webMethod) for loyalty tier calculation.
 * Imported by both loyaltyTiers.web.js and http-functions.js.
 * Cannot use webMethod here — this runs in multiple Wix execution contexts.
 */

export const LOYALTY_TIERS = [
  { name: 'Bronze', min: 0, next: 500 },
  { name: 'Silver', min: 500, next: 1500 },
  { name: 'Gold', min: 1500, next: null },
];

/**
 * Resolve tier name and next-tier threshold from a points balance.
 * @param {number} points
 * @returns {{ name: string, min: number, next: number|null }}
 */
export function resolveTierFromPoints(points) {
  const sorted = [...LOYALTY_TIERS].sort((a, b) => b.min - a.min);
  for (const tier of sorted) {
    if (points >= tier.min) return tier;
  }
  return LOYALTY_TIERS[0];
}
