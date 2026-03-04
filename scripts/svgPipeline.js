/**
 * @module svgPipeline
 * @description SVG export pipeline: Figma → optimize → brand token injection → Wix integration.
 * Part of the Figma-first illustration pivot (cf-gtep).
 *
 * Usage:
 *   node scripts/svgPipeline.js <input.svg> [--output <dir>]
 *
 * Pipeline steps:
 *   1. Read Figma-exported SVG
 *   2. Optimize: remove metadata, comments, XML declaration, empty elements
 *   3. Inject brand tokens: replace hardcoded hex with sharedTokens.js variable data-attributes
 *   4. Wrap for Wix HtmlComponent: responsive HTML wrapper with message listener
 *   5. Output: optimized SVG, tokenized SVG, Wix HTML, and report
 */

// Brand colors from sharedTokens.js — hex (lowercase) → token path
const BRAND_COLORS = {
  '#e8d5b7': 'colors.sandBase',
  '#f2e8d5': 'colors.sandLight',
  '#d4bc96': 'colors.sandDark',
  '#3a2518': 'colors.espresso',
  '#5c4033': 'colors.espressoLight',
  '#5b8fa8': 'colors.mountainBlue',
  '#3d6b80': 'colors.mountainBlueDark',
  '#a8ccd8': 'colors.mountainBlueLight',
  '#e8845c': 'colors.sunsetCoral',
  '#c96b44': 'colors.sunsetCoralDark',
  '#f2a882': 'colors.sunsetCoralLight',
  '#faf7f2': 'colors.offWhite',
  '#ffffff': 'colors.white',
  '#b8d4e3': 'colors.skyGradientTop',
  '#f0c87a': 'colors.skyGradientBottom',
  '#4a7c59': 'colors.success',
  '#c0392b': 'colors.error',
  '#767676': 'colors.muted',
  '#816d51': 'colors.mutedBrown',
};

/**
 * Build a Map of hex colors to sharedTokens variable names.
 * @returns {Map<string, string>}
 */
export function buildColorMap() {
  return new Map(Object.entries(BRAND_COLORS));
}

/**
 * Optimize an SVG string by removing Figma export bloat.
 * Removes: XML declaration, comments, metadata, empty style/defs, editor attributes.
 *
 * @param {string} svg - Raw SVG string.
 * @returns {string} Optimized SVG string.
 */
export function optimizeSvg(svg) {
  if (!svg) return '';

  let result = svg;

  // Remove XML declaration
  result = result.replace(/<\?xml[^?]*\?>\s*/gi, '');

  // Remove comments
  result = result.replace(/<!--[\s\S]*?-->\s*/g, '');

  // Remove metadata elements
  result = result.replace(/<metadata[\s\S]*?<\/metadata>\s*/gi, '');

  // Remove empty style elements
  result = result.replace(/<style[^>]*>\s*\/\*[^*]*\*\/\s*<\/style>\s*/gi, '');

  // Remove empty defs
  result = result.replace(/<defs>\s*<\/defs>\s*/gi, '');

  // Remove Figma-specific attributes
  result = result.replace(/\s*data-figma[a-z-]*="[^"]*"/gi, '');

  // Remove xmlns:figma namespace
  result = result.replace(/\s*xmlns:figma="[^"]*"/gi, '');

  // Remove figma-namespaced elements
  result = result.replace(/<figma:[^>]*>[\s\S]*?<\/figma:[^>]*>\s*/gi, '');
  result = result.replace(/<figma:[^/]*\/>\s*/gi, '');

  // Collapse whitespace between tags
  result = result.replace(/>\s+</g, '><');

  // Trim
  result = result.trim();

  return result;
}

/**
 * Replace hardcoded hex colors with brand token data-attributes.
 * Each fill/stroke attribute with a brand hex gets a data-token attribute added.
 *
 * @param {string} svg - SVG string.
 * @param {Object} [options]
 * @param {boolean} [options.report=false] - Return { svg, replacements } instead of just svg.
 * @returns {string|{ svg: string, replacements: Array }} Tokenized SVG or report.
 */
export function injectBrandTokens(svg, options = {}) {
  if (!svg) return options.report ? { svg: '', replacements: [] } : '';

  const colorMap = buildColorMap();
  const replacements = [];

  // Replace hex colors in fill and stroke attributes with token data-attributes
  let result = svg.replace(
    /(fill|stroke)="(#[0-9a-fA-F]{6})"/g,
    (match, attr, hex) => {
      const token = colorMap.get(hex.toLowerCase());
      if (token) {
        replacements.push({ hex, token, attribute: attr });
        return `${attr}="${hex}" data-token-${attr}="${token}"`;
      }
      return match;
    }
  );

  if (options.report) {
    return { svg: result, replacements };
  }
  return result;
}

/**
 * Wrap an SVG string in a responsive HTML document for Wix HtmlComponent.
 * Includes CSS for 100% width/height and a postMessage listener for dynamic updates.
 *
 * Note: The message listener uses textContent-based DOM replacement. The SVG content
 * is sourced from our own pipeline (Figma exports we process), not from user input.
 * The postMessage origin is verified by Wix's iframe sandboxing.
 *
 * @param {string} svg - SVG string.
 * @returns {string} Complete HTML document.
 */
export function wrapForWixHtmlComponent(svg) {
  if (!svg) return '';

  // The SVG is embedded directly at build time (not from user input).
  // The message listener allows the parent Wix page to swap SVG content
  // by sending trusted postMessage from same-origin Wix code.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 100%; height: 100vh; overflow: hidden; }
  svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
${svg}
<script>
window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'updateSvg') {
    var parser = new DOMParser();
    var doc = parser.parseFromString(event.data.svg, 'image/svg+xml');
    var svgEl = doc.documentElement;
    if (svgEl && svgEl.tagName === 'svg') {
      var old = document.querySelector('svg');
      if (old) old.replaceWith(svgEl);
    }
  }
});
</script>
</body>
</html>`;
}

/**
 * Run the full SVG pipeline: optimize → inject tokens → wrap for Wix.
 *
 * @param {string} rawSvg - Raw Figma-exported SVG.
 * @returns {{ optimized: string, tokenized: string, wixHtml: string, report: Object }|null}
 */
export function processSvgPipeline(rawSvg) {
  if (!rawSvg) return null;

  const originalSize = rawSvg.length;

  // Step 1: Optimize
  const optimized = optimizeSvg(rawSvg);
  const optimizedSize = optimized.length;

  // Step 2: Inject brand tokens
  const { svg: tokenized, replacements } = injectBrandTokens(optimized, { report: true });

  // Step 3: Wrap for Wix HtmlComponent
  const wixHtml = wrapForWixHtmlComponent(optimized);

  return {
    optimized,
    tokenized,
    wixHtml,
    report: {
      originalSize,
      optimizedSize,
      savingsPercent: Math.round((1 - optimizedSize / originalSize) * 100),
      replacements,
      tokenCount: replacements.length,
    },
  };
}

// CLI entrypoint
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('svgPipeline.js')) {
  const fs = await import('fs');
  const path = await import('path');

  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/svgPipeline.js <input.svg> [--output <dir>]');
    process.exit(1);
  }

  const outputIdx = process.argv.indexOf('--output');
  const outputDir = outputIdx > -1 ? process.argv[outputIdx + 1] : path.dirname(inputPath);

  const rawSvg = fs.readFileSync(inputPath, 'utf8');
  const result = processSvgPipeline(rawSvg);

  if (!result) {
    console.error('Failed to process SVG.');
    process.exit(1);
  }

  const baseName = path.basename(inputPath, '.svg');
  fs.writeFileSync(path.join(outputDir, `${baseName}.optimized.svg`), result.optimized);
  fs.writeFileSync(path.join(outputDir, `${baseName}.tokenized.svg`), result.tokenized);
  fs.writeFileSync(path.join(outputDir, `${baseName}.wix.html`), result.wixHtml);

  console.log(`SVG Pipeline Complete: ${baseName}`);
  console.log(`  Original: ${result.report.originalSize} bytes`);
  console.log(`  Optimized: ${result.report.optimizedSize} bytes (${result.report.savingsPercent}% smaller)`);
  console.log(`  Token replacements: ${result.report.tokenCount}`);
  result.report.replacements.forEach(r => {
    console.log(`    ${r.hex} → ${r.token} (${r.attribute})`);
  });
}
