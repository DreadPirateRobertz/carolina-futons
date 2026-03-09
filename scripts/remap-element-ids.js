#!/usr/bin/env node
/**
 * Element ID Remapping Utility (CF-d6ro)
 *
 * Bulk-renames $w('#elementId') references across src/ and tests/.
 * Takes a JSON mapping file { "oldId": "newId", ... }.
 * Dry-run by default; pass --apply to write changes.
 *
 * Usage:
 *   node scripts/remap-element-ids.js mapping.json [--apply]
 *
 * @module remap-element-ids
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

/**
 * Parse and validate a JSON mapping file.
 * @param {string} filePath - Path to JSON mapping file
 * @returns {Record<string, string>} oldId → newId mapping
 * @throws {Error} On invalid file, JSON, or mapping structure
 */
export function parseMapping(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read mapping file: ${filePath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in mapping file: ${err.message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Mapping must be a JSON object { "oldId": "newId", ... }');
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) {
    throw new Error('Mapping is empty — nothing to remap');
  }

  for (const [key, value] of entries) {
    if (!key) {
      throw new Error('Mapping keys must be non-empty strings');
    }
    if (typeof value !== 'string' || !value) {
      throw new Error(`Mapping value for "${key}" must be a non-empty string, got: ${typeof value}`);
    }
  }

  return parsed;
}

/**
 * Replace element IDs in source text according to a mapping.
 * Handles: $w('#id'), $w("#id"), $w(`#id`), '#id' / "#id" in selector arrays.
 * Does NOT replace bare prose references without # prefix.
 * Avoids double-replacement by replacing all keys simultaneously.
 *
 * @param {string} source - Source file content
 * @param {Record<string, string>} mapping - oldId → newId mapping
 * @param {{ countMode?: boolean }} [options] - If countMode, return { text, count }
 * @returns {string | { text: string, count: number }}
 */
export function replaceIds(source, mapping, options = {}) {
  const keys = Object.keys(mapping);
  if (keys.length === 0) return options.countMode ? { text: source, count: 0 } : source;

  // Build a single regex that matches #oldId inside quotes/backticks
  // Captures: (quote char)(#)(oldId)(quote char)
  // We match: ['"`]#oldId['"`] but only within $w() or string contexts
  // Strategy: match #oldId bounded by quote+word-boundary to avoid partial matches
  const escapedKeys = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const idAlternation = escapedKeys.join('|');

  // Match: (single/double/backtick quote) # (one of our IDs) (same or any closing context)
  // We need to ensure we don't match partial IDs, so we use word boundary after ID
  const pattern = new RegExp(
    `(['"\`])#(${idAlternation})\\b(?=\\1|[^a-zA-Z0-9_])`,
    'g'
  );

  let count = 0;
  const result = source.replace(pattern, (match, quote, oldId) => {
    count++;
    return `${quote}#${mapping[oldId]}`;
  });

  if (options.countMode) {
    return { text: result, count };
  }
  return result;
}

/**
 * Recursively collect all .js files in a directory.
 * @param {string} dir - Directory to scan
 * @returns {string[]} Array of absolute file paths
 */
function collectJsFiles(dir) {
  const results = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectJsFiles(fullPath));
    } else if (extname(entry) === '.js') {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Run element ID remapping across directories.
 * @param {{ mappingPath: string, scanDirs: string[], apply?: boolean }} opts
 * @returns {{ filesScanned: number, filesChanged: number, totalReplacements: number, fileDetails: Array<{ file: string, replacements: number }> }}
 */
export function remapElementIds({ mappingPath, scanDirs, apply = false }) {
  const mapping = parseMapping(mappingPath);

  // Validate scan directories exist
  for (const dir of scanDirs) {
    if (!existsSync(dir)) {
      throw new Error(`Scan directory does not exist: ${dir}`);
    }
  }

  // Collect all .js files
  const allFiles = [];
  for (const dir of scanDirs) {
    allFiles.push(...collectJsFiles(dir));
  }

  let filesChanged = 0;
  let totalReplacements = 0;
  const fileDetails = [];

  for (const filePath of allFiles) {
    const content = readFileSync(filePath, 'utf8');
    const { text, count } = replaceIds(content, mapping, { countMode: true });

    if (count > 0) {
      fileDetails.push({ file: filePath, replacements: count });
      totalReplacements += count;
      if (apply) {
        writeFileSync(filePath, text, 'utf8');
        filesChanged++;
      }
    }
  }

  return {
    filesScanned: allFiles.length,
    filesChanged: apply ? filesChanged : 0,
    totalReplacements,
    fileDetails,
  };
}

// ── CLI entrypoint ───────────────────────────────────────────────────

const isDirectRun = process.argv[1] && process.argv[1].endsWith('remap-element-ids.js');
if (isDirectRun) {
  const args = process.argv.slice(2);
  const applyFlag = args.includes('--apply');
  const mappingPath = args.find(a => !a.startsWith('--'));

  if (!mappingPath) {
    console.error('Usage: node scripts/remap-element-ids.js <mapping.json> [--apply]');
    process.exit(1);
  }

  const scanDirs = [join(process.cwd(), 'src'), join(process.cwd(), 'tests')];
  const result = remapElementIds({ mappingPath, scanDirs, apply: applyFlag });

  console.log(`\nElement ID Remapping ${applyFlag ? '(APPLIED)' : '(DRY RUN)'}`);
  console.log('─'.repeat(50));
  console.log(`Files scanned:  ${result.filesScanned}`);
  console.log(`Files changed:  ${result.filesChanged}`);
  console.log(`Replacements:   ${result.totalReplacements}`);

  if (result.fileDetails.length > 0) {
    console.log('\nPer-file details:');
    for (const detail of result.fileDetails) {
      console.log(`  ${detail.file}: ${detail.replacements} replacement(s)`);
    }
  }

  if (!applyFlag && result.totalReplacements > 0) {
    console.log('\nRun with --apply to write changes.');
  }
}
