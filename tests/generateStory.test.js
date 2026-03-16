import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const TEMPLATES_DIR = resolve(__dirname, '../content/social-stories/templates');

const STORY_TYPES = {
  did_you_know: 'did-you-know.html',
  care_tip: 'care-tip.html',
  weekend_visit: 'weekend-visit.html',
};

// ── Template Existence ───────────────────────────────────────────────

describe('story templates — existence', () => {
  for (const [type, file] of Object.entries(STORY_TYPES)) {
    it(`${type} template exists`, () => {
      const path = resolve(TEMPLATES_DIR, file);
      expect(existsSync(path)).toBe(true);
    });
  }
});

// ── Template Structure ───────────────────────────────────────────────

describe('story templates — structure', () => {
  for (const [type, file] of Object.entries(STORY_TYPES)) {
    describe(type, () => {
      let html;

      beforeAll(async () => {
        html = await readFile(resolve(TEMPLATES_DIR, file), 'utf-8');
      });

      it('is valid HTML with doctype', () => {
        expect(html).toMatch(/^<!DOCTYPE html>/i);
        expect(html).toContain('<html');
        expect(html).toContain('</html>');
      });

      it('sets story dimensions (1080x1920)', () => {
        expect(html).toContain('width: 1080px');
        expect(html).toContain('height: 1920px');
      });

      it('includes __injectStoryData function', () => {
        expect(html).toContain('window.__injectStoryData');
        expect(html).toContain('function(data)');
      });

      it('uses textContent for data injection (not innerHTML)', () => {
        // Security: all injections must use textContent
        const injectorMatch = html.match(/window\.__injectStoryData\s*=\s*function[\s\S]*?};/);
        expect(injectorMatch).toBeTruthy();
        const injector = injectorMatch[0];
        expect(injector).not.toContain('innerHTML');
        expect(injector).toContain('textContent');
      });

      it('includes Carolina Futons branding', () => {
        expect(html).toContain('Carolina Futons');
        expect(html).toContain('@carolinafutons');
      });

      it('uses brand colors from sharedTokens', () => {
        // Sand #E8D5B7, Espresso #3A2518, Mountain Blue #5B8FA8
        expect(html).toContain('#E8D5B7');
        expect(html).toContain('#3A2518');
        expect(html).toContain('#5B8FA8');
      });

      it('uses updated sunsetCoral (#4A7D94) not old value', () => {
        expect(html).not.toContain('#E8845C');
      });

      it('includes Hendersonville location', () => {
        expect(html).toContain('Hendersonville');
      });
    });
  }
});

// ── Template-Specific Content ────────────────────────────────────────

describe('did-you-know template', () => {
  let html;
  beforeAll(async () => {
    html = await readFile(resolve(TEMPLATES_DIR, 'did-you-know.html'), 'utf-8');
  });

  it('has fact number element', () => {
    expect(html).toContain('id="factNumber"');
  });

  it('has fact headline element', () => {
    expect(html).toContain('id="factHeadline"');
  });

  it('has fact body element', () => {
    expect(html).toContain('id="factBody"');
  });

  it('injector handles factNumber, headline, fact', () => {
    expect(html).toContain("data.factNumber");
    expect(html).toContain("data.headline");
    expect(html).toContain("data.fact");
  });

  it('has "Did You Know" badge', () => {
    expect(html).toContain('Did You Know');
  });

  it('has mountain skyline SVG decoration', () => {
    expect(html).toContain('<svg');
    expect(html).toContain('polygon');
  });
});

describe('care-tip template', () => {
  let html;
  beforeAll(async () => {
    html = await readFile(resolve(TEMPLATES_DIR, 'care-tip.html'), 'utf-8');
  });

  it('has tip headline element', () => {
    expect(html).toContain('id="tipHeadline"');
  });

  it('has tip body element', () => {
    expect(html).toContain('id="tipBody"');
  });

  it('has attribution element', () => {
    expect(html).toContain('id="tipAttribution"');
  });

  it('injector handles title, tip, attribution', () => {
    expect(html).toContain("data.title");
    expect(html).toContain("data.tip");
    expect(html).toContain("data.attribution");
  });

  it('has dark background (espresso theme)', () => {
    expect(html).toContain('background: #3A2518');
  });

  it('has Brenda attribution by default', () => {
    expect(html).toContain('Brenda');
  });

  it('has opening quote mark decoration', () => {
    expect(html).toContain('quote-mark');
  });
});

describe('weekend-visit template', () => {
  let html;
  beforeAll(async () => {
    html = await readFile(resolve(TEMPLATES_DIR, 'weekend-visit.html'), 'utf-8');
  });

  it('has weekend headline element', () => {
    expect(html).toContain('id="weekendHeadline"');
  });

  it('has promo subtitle element', () => {
    expect(html).toContain('id="weekendSub"');
  });

  it('injector handles heading, promo, hours', () => {
    expect(html).toContain("data.heading");
    expect(html).toContain("data.promo");
    expect(html).toContain("data.hours");
  });

  it('has hours schedule box', () => {
    expect(html).toContain('hours-box');
    expect(html).toContain('Wednesday');
    expect(html).toContain('Saturday');
  });

  it('has feature chips', () => {
    expect(html).toContain('feature-chip');
    expect(html).toContain('Try every piece');
    expect(html).toContain('No-pressure');
  });

  it('has CTA button', () => {
    expect(html).toContain('id="ctaButton"');
    expect(html).toContain('Visit Us');
  });

  it('has store address and phone', () => {
    expect(html).toContain('824 Locust St');
    expect(html).toContain('(828) 252-9449');
  });

  it('has night sky with stars and moon', () => {
    expect(html).toContain('night-star');
  });
});

// ── Generate Script ──────────────────────────────────────────────────

describe('generate-story.mjs', () => {
  it('script file exists', () => {
    const scriptPath = resolve(__dirname, '../scripts/generate-story.mjs');
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('script references all template types', async () => {
    const script = await readFile(
      resolve(__dirname, '../scripts/generate-story.mjs'),
      'utf-8'
    );
    expect(script).toContain('did_you_know');
    expect(script).toContain('care_tip');
    expect(script).toContain('weekend_visit');
  });

  it('script uses headless browser', async () => {
    const script = await readFile(
      resolve(__dirname, '../scripts/generate-story.mjs'),
      'utf-8'
    );
    expect(script).toContain('headless: true');
  });

  it('script sets correct viewport', async () => {
    const script = await readFile(
      resolve(__dirname, '../scripts/generate-story.mjs'),
      'utf-8'
    );
    expect(script).toContain('1080');
    expect(script).toContain('1920');
  });

  it('script supports --dry-run flag', async () => {
    const script = await readFile(
      resolve(__dirname, '../scripts/generate-story.mjs'),
      'utf-8'
    );
    expect(script).toContain('--dry-run');
    expect(script).toContain('dryRun');
  });

  it('script calls __injectStoryData on page', async () => {
    const script = await readFile(
      resolve(__dirname, '../scripts/generate-story.mjs'),
      'utf-8'
    );
    expect(script).toContain('__injectStoryData');
  });
});
