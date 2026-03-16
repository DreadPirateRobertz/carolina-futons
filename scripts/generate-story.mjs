#!/usr/bin/env node
/**
 * @module generate-story
 * @description Playwright-based story screenshot generator.
 * Loads an HTML template, injects story data via __injectStoryData(),
 * and captures a 1080x1920 PNG screenshot.
 *
 * Usage:
 *   node scripts/generate-story.mjs --type did_you_know --data '{"headline":"...","fact":"..."}'
 *   node scripts/generate-story.mjs --type care_tip --data '{"title":"...","tip":"..."}'
 *   node scripts/generate-story.mjs --type weekend_visit
 *   node scripts/generate-story.mjs --type did_you_know --dry-run
 *
 * Options:
 *   --type       Story type: did_you_know | care_tip | weekend_visit
 *   --data       JSON string of template data (optional — uses defaults if omitted)
 *   --output     Output path for PNG (default: output/stories/<type>-<timestamp>.png)
 *   --dry-run    Validate template + data without launching browser
 *   --template   Override template path (default: content/social-stories/templates/<type>.html)
 */

import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

const TEMPLATE_MAP = {
  did_you_know: 'did-you-know.html',
  care_tip: 'care-tip.html',
  weekend_visit: 'weekend-visit.html',
};

function parseArgs(argv) {
  const args = { type: null, data: null, output: null, dryRun: false, template: null };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--type': args.type = argv[++i]; break;
      case '--data': args.data = argv[++i]; break;
      case '--output': args.output = argv[++i]; break;
      case '--dry-run': args.dryRun = true; break;
      case '--template': args.template = argv[++i]; break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }
  return args;
}

function resolveTemplatePath(args) {
  if (args.template) return resolve(PROJECT_ROOT, args.template);
  const filename = TEMPLATE_MAP[args.type];
  if (!filename) {
    console.error(`Unknown story type: ${args.type}`);
    console.error(`Valid types: ${Object.keys(TEMPLATE_MAP).join(', ')}`);
    process.exit(1);
  }
  return resolve(PROJECT_ROOT, 'content/social-stories/templates', filename);
}

function resolveOutputPath(args) {
  if (args.output) return resolve(PROJECT_ROOT, args.output);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return resolve(PROJECT_ROOT, 'output/stories', `${args.type}-${timestamp}.png`);
}

function parseData(dataStr) {
  if (!dataStr) return {};
  try {
    return JSON.parse(dataStr);
  } catch (err) {
    console.error(`Invalid JSON in --data: ${err.message}`);
    process.exit(1);
  }
}

async function generateStory(args) {
  const templatePath = resolveTemplatePath(args);
  const outputPath = resolveOutputPath(args);
  const data = parseData(args.data);

  if (!existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    process.exit(1);
  }

  console.log(`Story type:  ${args.type}`);
  console.log(`Template:    ${templatePath}`);
  console.log(`Data:        ${JSON.stringify(data)}`);

  if (args.dryRun) {
    const html = await readFile(templatePath, 'utf-8');
    const hasInjector = html.includes('__injectStoryData');
    console.log(`Dry run:     template valid (${html.length} bytes, injector: ${hasInjector})`);
    console.log(`Output would be: ${outputPath}`);
    return;
  }

  await mkdir(dirname(outputPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: STORY_WIDTH, height: STORY_HEIGHT });

    const templateUrl = `file://${templatePath}`;
    await page.goto(templateUrl, { waitUntil: 'load' });

    if (Object.keys(data).length > 0) {
      await page.evaluate((d) => {
        if (typeof window.__injectStoryData === 'function') {
          window.__injectStoryData(d);
        }
      }, data);
    }

    // Brief pause for any CSS transitions / font loading
    await page.waitForTimeout(200);

    await page.screenshot({
      path: outputPath,
      type: 'png',
      clip: { x: 0, y: 0, width: STORY_WIDTH, height: STORY_HEIGHT },
    });

    console.log(`Screenshot:  ${outputPath}`);
    console.log(`Dimensions:  ${STORY_WIDTH}x${STORY_HEIGHT}`);
  } finally {
    await browser.close();
  }
}

// ── Main ─────────────────────────────────────────────────────────────

const args = parseArgs(process.argv);
if (!args.type) {
  console.error('Usage: node scripts/generate-story.mjs --type <story_type> [--data \'{"key":"value"}\'] [--output path.png] [--dry-run]');
  console.error(`Valid types: ${Object.keys(TEMPLATE_MAP).join(', ')}`);
  process.exit(1);
}

generateStory(args).catch((err) => {
  console.error('Error generating story:', err.message);
  process.exit(1);
});
