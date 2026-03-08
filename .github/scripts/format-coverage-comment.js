/**
 * Formats a vitest coverage-summary.json into a markdown PR comment.
 * @param {Object} summary - Parsed coverage-summary.json (must have .total)
 * @param {Object|null} thresholds - { lines, branches, functions } or null
 * @returns {string} Markdown-formatted coverage comment
 */
export function formatCoverageComment(summary, thresholds) {
  const { lines, branches, functions, statements } = summary.total;

  const metrics = [
    { name: 'Lines', pct: lines.pct, threshold: thresholds?.lines },
    { name: 'Branches', pct: branches.pct, threshold: thresholds?.branches },
    { name: 'Functions', pct: functions.pct, threshold: thresholds?.functions },
    { name: 'Statements', pct: statements.pct, threshold: null },
  ];

  const hasThresholds = thresholds != null;
  const failures = metrics.filter(
    (m) => m.threshold != null && m.pct < m.threshold
  );

  const icon = failures.length > 0 ? ':x:' : ':white_check_mark:';
  let md = `## ${icon} Coverage Report\n\n`;

  if (hasThresholds) {
    md += '| Metric | Coverage | Threshold | Status |\n';
    md += '|--------|----------|-----------|--------|\n';

    for (const m of metrics) {
      const pctStr = `${m.pct}%`;
      if (m.threshold != null) {
        const pass = m.pct >= m.threshold;
        const status = pass ? ':white_check_mark:' : ':x: Below threshold';
        md += `| ${m.name} | ${pctStr} | ${m.threshold}% | ${status} |\n`;
      } else {
        md += `| ${m.name} | ${pctStr} | — | — |\n`;
      }
    }
  } else {
    md += '| Metric | Coverage |\n';
    md += '|--------|----------|\n';

    for (const m of metrics) {
      md += `| ${m.name} | ${m.pct}% |\n`;
    }
  }

  if (failures.length > 0) {
    md += `\n> **${failures.length} metric(s) below threshold.** Please improve coverage before merging.\n`;
  }

  return md;
}
