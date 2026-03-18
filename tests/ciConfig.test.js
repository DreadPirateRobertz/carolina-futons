/**
 * ciConfig.test.js — CI workflow config correctness (CF-1d06, CF-7d6k)
 *
 * Validates that .github/workflows/ci.yml enforces:
 *   CF-1d06: fail_ci_if_error: true on all Codecov upload steps
 *   CF-7d6k: cache-dependency-path set on all setup-node steps
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ciPath = resolve(__dirname, '../.github/workflows/ci.yml');
const ciYaml = yaml.load(readFileSync(ciPath, 'utf8'));

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStepsByAction(workflow, actionPrefix) {
  return Object.values(workflow.jobs)
    .flatMap(job => job.steps || [])
    .filter(step => typeof step.uses === 'string' && step.uses.startsWith(actionPrefix));
}

// ── CF-1d06: fail_ci_if_error: true ─────────────────────────────────────────

describe('CF-1d06: Codecov fail_ci_if_error', () => {
  // Existence check matters: the for...of assertion below silently passes on empty arrays,
  // so this guard ensures a missing step doesn't produce a false green.
  it('ci.yml has at least one codecov upload step', () => {
    const steps = getStepsByAction(ciYaml, 'codecov/codecov-action');
    expect(steps.length).toBeGreaterThan(0);
  });

  it('all codecov upload steps have fail_ci_if_error: true', () => {
    const codecovSteps = getStepsByAction(ciYaml, 'codecov/codecov-action');
    for (const step of codecovSteps) {
      expect(
        step.with?.fail_ci_if_error,
        `Step "${step.uses}" uses codecov-action but fail_ci_if_error is not true`
      ).toBe(true);
    }
  });
});

// ── CF-7d6k: cache-dependency-path ──────────────────────────────────────────

describe('CF-7d6k: setup-node cache-dependency-path', () => {
  // Existence check guards against the for...of loop passing vacuously on an empty array.
  it('ci.yml has at least one setup-node step', () => {
    const steps = getStepsByAction(ciYaml, 'actions/setup-node');
    expect(steps.length).toBeGreaterThan(0);
  });

  it('all setup-node steps with cache: npm have cache-dependency-path set', () => {
    const setupNodeSteps = getStepsByAction(ciYaml, 'actions/setup-node');
    for (const step of setupNodeSteps) {
      if (step.with?.cache === 'npm') {
        expect(
          step.with['cache-dependency-path'],
          `Step "${step.uses}" uses setup-node with cache: npm but is missing cache-dependency-path`
        ).toBeTruthy();
      }
    }
  });
});
