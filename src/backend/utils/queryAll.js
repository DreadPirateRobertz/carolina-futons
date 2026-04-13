/**
 * @file queryAll.js
 * @description Utility to fetch all items across paginated wix-data query results.
 *
 * Wix Data queries cap at 1000 items per page. queryAll traverses hasNext/next
 * cursor pages until all matching items are collected.
 *
 * WHY: A single .limit(N).find() silently truncates results beyond N. queryAll
 * prevents data loss for large collections (>1000 opted-in members, large queues,
 * etc.) by following the cursor chain to completion. cf-n16
 */

/**
 * Fetch every item matching a wix-data query by following hasNext/next pages.
 *
 * @param {Object} queryBuilder - A wixData query builder with filters and limit set.
 *   Example: wixData.query('MyCollection').eq('status', 'active').limit(500)
 * @param {Object} [options] - Passed to find() (e.g. { suppressAuth: true })
 * @returns {Promise<Array>} All matching items across all pages.
 */
export async function queryAll(queryBuilder, options = {}) {
  const items = [];
  let page = await queryBuilder.find(options);
  items.push(...page.items);
  while (page.hasNext()) {
    page = await page.next();
    items.push(...page.items);
  }
  return items;
}
