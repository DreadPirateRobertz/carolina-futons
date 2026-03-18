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

function getAllSteps(workflow) {
  return Object.values(workflow.jobs).flatMap(job => job.steps || []);
}

function getCodecovSteps(workflow) {
  return getAllSteps(workflow).filter(
    step => typeof step.uses === 'string' && step.uses.startsWith('codecov/codecov-action')
  );
}

function getSetupNodeSteps(workflow) {
  return getAllSteps(workflow).filter(
    step => typeof step.uses === 'string' && step.uses.startsWith('actions/setup-node')
  );
}

// ── CF-1d06: fail_ci_if_error: true ─────────────────────────────────────────

describe('CF-1d06: Codecov fail_ci_if_error', () => {
  it('ci.yml has at least one codecov upload step', () => {
    const steps = getCodecovSteps(ciYaml);
    expect(steps.length).toBeGreaterThan(0);
  });

  it('all codecov upload steps have fail_ci_if_error: true', () => {
    const codecovSteps = getCodecovSteps(ciYaml);
    for (const step of codecovSteps) {
      expect(
        step.with?.fail_ci_if_error,
        `Step "${step.name}" uses codecov-action but fail_ci_if_error is not true`
      ).toBe(true);
    }
  });
});

// ── CF-7d6k: cache-dependency-path ──────────────────────────────────────────

describe('CF-7d6k: setup-node cache-dependency-path', () => {
  it('ci.yml has at least one setup-node step', () => {
    const steps = getSetupNodeSteps(ciYaml);
    expect(steps.length).toBeGreaterThan(0);
  });

  it('all setup-node steps with cache: npm have cache-dependency-path set', () => {
    const setupNodeSteps = getSetupNodeSteps(ciYaml);
    for (const step of setupNodeSteps) {
      if (step.with?.cache === 'npm') {
        expect(
          step.with['cache-dependency-path'],
          `Step "${step.name}" uses setup-node with cache: npm but is missing cache-dependency-path`
        ).toBeTruthy();
      }
    }
  });
});
