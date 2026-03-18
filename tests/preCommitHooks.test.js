/**
 * CF-m6u0 — pre-commit hooks (husky + lint-staged)
 * Tests: hook file exists, is executable, runs lint-staged (no --no-verify bypass);
 *        .lintstagedrc.cjs configures eslint --fix --max-warnings=0 + vitest --changed;
 *        package.json has exact prepare script and husky/lint-staged deps.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

function read(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function stat(rel) {
  try { return statSync(resolve(ROOT, rel)); } catch { return null; }
}

function exists(rel) { return stat(rel) !== null; }

function isExecutable(rel) {
  const s = stat(rel);
  // Check owner execute bit (0o100) — POSIX only; always true on Windows
  return s !== null && (s.mode & 0o100) !== 0;
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

  it('prepare script is exactly "husky" (husky v9 requirement)', () => {
    expect(pkg.scripts?.prepare).toBe('husky');
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

  it('uses --no flag on npx to prevent network fetch of lint-staged', () => {
    const content = read('.husky/pre-commit');
    expect(content).toMatch(/npx\s+--no\s+lint-staged/);
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

  it('runs eslint --fix on staged files', () => {
    expect(src).toMatch(/eslint\s+--fix/);
  });

  it('runs eslint with --max-warnings=0 to treat warnings as errors', () => {
    expect(src).toMatch(/--max-warnings[= ]0/);
  });

  it('eslint runs before vitest (lint then test order)', () => {
    const eslintPos = src.indexOf('eslint');
    const vitestPos = src.indexOf('vitest');
    expect(eslintPos).toBeGreaterThan(-1);
    expect(vitestPos).toBeGreaterThan(eslintPos);
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
