import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * Validates CI workflow configuration for correct GitHub Actions permissions.
 * Prevents regressions like CF-k04l (403 on PR coverage comments).
 *
 * Uses simple string parsing to avoid adding a yaml dependency.
 */
describe('CI workflow configuration', () => {
  let raw;

  try {
    raw = readFileSync('.github/workflows/ci.yml', 'utf8');
  } catch {
    // handled in test
  }

  it('ci.yml exists and is readable', () => {
    expect(raw).toBeDefined();
    expect(raw.length).toBeGreaterThan(0);
  });

  it('test job has pull-requests write permission for PR comments', () => {
    // Extract the test job block (from "  test:" to the next job at same indent)
    const testJobMatch = raw.match(/^ {2}test:\n([\s\S]*?)(?=\n {2}\w+:|\n(?=\S))/m);
    expect(testJobMatch).not.toBeNull();

    const testBlock = testJobMatch[1];
    // Check for permissions block within the test job
    const hasPermissions = /permissions:/.test(testBlock);
    expect(hasPermissions).toBe(true);

    const hasPRWrite = /pull-requests:\s*write/.test(testBlock);
    expect(hasPRWrite).toBe(true);
  });

  it('test job has contents read permission for checkout', () => {
    const testJobMatch = raw.match(/^ {2}test:\n([\s\S]*?)(?=\n {2}\w+:|\n(?=\S))/m);
    const testBlock = testJobMatch[1];

    const hasContentsRead = /contents:\s*(read|write)/.test(testBlock);
    expect(hasContentsRead).toBe(true);
  });

  it('nightly-integration job has issues write permission for creating failure issues', () => {
    // nightly-integration is the last job, so grab everything after its header
    const nightlyIdx = raw.indexOf('  nightly-integration:');
    expect(nightlyIdx).toBeGreaterThan(-1);
    const nightlyBlock = raw.slice(nightlyIdx);

    const hasIssuesWrite = /issues:\s*write/.test(nightlyBlock);
    expect(hasIssuesWrite).toBe(true);
  });

  it('does not use blanket write-all permissions', () => {
    // No top-level or job-level write-all
    expect(raw).not.toMatch(/permissions:\s*write-all/);
  });

  it('coverage comment step runs only on PRs with node 20', () => {
    // Verify the conditional guard exists
    expect(raw).toMatch(/if:.*github\.event_name\s*==\s*'pull_request'.*matrix\.node-version\s*==\s*20/);
  });
});
