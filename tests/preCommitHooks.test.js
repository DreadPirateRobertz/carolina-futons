/**
 * CF-m6u0 — pre-commit hooks (husky + lint-staged)
 * Tests: hook file exists, is executable, runs lint-staged;
 *        .lintstagedrc configures eslint + vitest --changed;
 *        package.json has prepare script and husky/lint-staged deps.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

function read(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function exists(rel) {
  try { statSync(resolve(ROOT, rel)); return true; } catch { return false; }
}

function isExecutable(rel) {
  const mode = statSync(resolve(ROOT, rel)).mode;
  // Check owner execute bit (0o100)
  return (mode & 0o100) !== 0;
}

// ── package.json ──────────────────────────────────────────────────────────────

describe('package.json — pre-commit hook dependencies', () => {
  let pkg;
  try { pkg = JSON.parse(read('package.json')); } catch { pkg = {}; }

  it('has husky in devDependencies', () => {
    expect(pkg.devDependencies?.husky).toBeTruthy();
  });

  it('has lint-staged in devDependencies', () => {
    expect(pkg.devDependencies?.['lint-staged']).toBeTruthy();
  });

  it('has prepare script that initialises husky', () => {
    expect(pkg.scripts?.prepare).toMatch(/husky/);
  });
});

// ── .husky/pre-commit ─────────────────────────────────────────────────────────

describe('.husky/pre-commit hook', () => {
  it('file exists', () => {
    expect(exists('.husky/pre-commit')).toBe(true);
  });

  it('is executable', () => {
    expect(isExecutable('.husky/pre-commit')).toBe(true);
  });

  it('runs lint-staged', () => {
    const content = read('.husky/pre-commit');
    expect(content).toMatch(/lint-staged/);
  });

  it('does not bypass eslint or tests (no --no-verify patterns)', () => {
    const content = read('.husky/pre-commit');
    expect(content).not.toMatch(/--no-verify/);
  });
});

// ── .lintstagedrc.cjs ─────────────────────────────────────────────────────────

describe('.lintstagedrc.cjs — staged file pipeline', () => {
  let src = '';
  try { src = read('.lintstagedrc.cjs'); } catch { src = ''; }

  it('.lintstagedrc.cjs exists', () => {
    expect(exists('.lintstagedrc.cjs')).toBe(true);
  });

  it('has a glob entry covering JS and/or TS files', () => {
    expect(src).toMatch(/\*\..*\{.*(?:js|ts).*\}|\.js|\.ts/);
  });

  it('runs eslint on staged JS/TS files', () => {
    expect(src).toMatch(/eslint/);
  });

  it('runs vitest with --changed', () => {
    expect(src).toMatch(/vitest/);
    expect(src).toMatch(/--changed/);
  });

  it('uses function form to prevent lint-staged filename injection', () => {
    // Function form: () => '...' ensures vitest is not given staged filenames
    expect(src).toMatch(/=>\s*['"`]vitest/);
  });

  it('passes --passWithNoTests to avoid blocking commits with no test coverage', () => {
    expect(src).toMatch(/--passWithNoTests/);
  });
});
