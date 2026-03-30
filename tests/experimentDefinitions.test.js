/**
 * @file experimentDefinitions.test.js
 * @description Tests for 3 A/B experiment modules (CF-8ush):
 * quiz gate, spin wheel gate, gamification tour.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from './__mocks__/wix-data.js';
import { _reset as resetAbExperiments } from '../src/public/abExperiments.js';

// ── Quiz Gate Experiment ─────────────────────────────────────────────

import {
  EXPERIMENT_NAME as QUIZ_NAME,
  VARIANTS as QUIZ_VARIANTS,
  initQuizGateTest,
  isQuizGateRequired,
  trackQuizCompletion,
  trackQuizSkip,
} from '../src/public/quizGateExperiment.js';

// ── Spin Wheel Gate Experiment ───────────────────────────────────────

import {
  EXPERIMENT_NAME as SPIN_NAME,
  VARIANTS as SPIN_VARIANTS,
  initSpinWheelGateTest,
  isEmailRequiredForSpin,
  trackSpinComplete,
  trackPrizeRedemption,
} from '../src/public/spinWheelGateExperiment.js';

// ── Gamification Tour Experiment ─────────────────────────────────────

import {
  EXPERIMENT_NAME as TOUR_NAME,
  VARIANTS as TOUR_VARIANTS,
  initGamificationTourTest,
  shouldAutoShowTour,
  trackTourCompletion,
  trackTourOptIn,
} from '../src/public/gamificationTourExperiment.js';

beforeEach(() => {
  __reset();
  resetAbExperiments();
});

// ── Quiz Gate ────────────────────────────────────────────────────────

describe('quizGateExperiment', () => {
  it('has correct experiment name', () => {
    expect(QUIZ_NAME).toBe('quiz_gate_test');
  });

  it('defines 2 variants: required and optional', () => {
    expect(QUIZ_VARIANTS.A.gateRequired).toBe(true);
    expect(QUIZ_VARIANTS.B.gateRequired).toBe(false);
  });

  it('defaults to gate required when no experiment active', async () => {
    const result = await initQuizGateTest();
    expect(result.gateRequired).toBe(true);
    expect(result.experimentActive).toBe(false);
  });

  it('returns a valid variant when experiment is active', async () => {
    __seed('AbTests', [{
      _id: 'quiz-test', testName: 'quiz_gate_test', active: true,
      variants: JSON.stringify([
        { id: 'A', name: 'Required' },
        { id: 'B', name: 'Optional' },
      ]),
      trafficPercent: 100,
    }]);

    const result = await initQuizGateTest();
    expect(result.experimentActive).toBe(true);
    expect(result.variantId).toMatch(/^[AB]$/);
    // gateRequired should match variant config
    const expectedGate = QUIZ_VARIANTS[result.variantId].gateRequired;
    expect(result.gateRequired).toBe(expectedGate);
  });

  it('isQuizGateRequired returns true by default', () => {
    expect(isQuizGateRequired()).toBe(true);
  });

  it('trackQuizCompletion does not throw', async () => {
    await expect(trackQuizCompletion(true)).resolves.not.toThrow();
  });

  it('trackQuizSkip does not throw', async () => {
    await expect(trackQuizSkip()).resolves.not.toThrow();
  });

  it('initQuizGateTest returns default when backend throws (catch branch)', async () => {
    __setQueryError('AbTests', new Error('DB error'));
    const result = await initQuizGateTest();
    expect(result.gateRequired).toBe(true);
    expect(result.experimentActive).toBe(false);
    expect(result.variantId).toBeNull();
  });

  it('isQuizGateRequired returns true when active variant id is unknown', async () => {
    __seed('AbTests', [{
      _id: 'quiz-test', testName: 'quiz_gate_test', active: true,
      variants: JSON.stringify([{ id: 'X', name: 'Unknown' }]),
      trafficPercent: 100,
    }]);
    await initQuizGateTest();
    // variant 'X' not in VARIANTS map — ?? true fallback
    expect(isQuizGateRequired()).toBe(true);
  });
});

// ── Spin Wheel Gate ──────────────────────────────────────────────────

describe('spinWheelGateExperiment', () => {
  it('has correct experiment name', () => {
    expect(SPIN_NAME).toBe('spin_wheel_gate_test');
  });

  it('defines 2 variants: email-gate and no-gate', () => {
    expect(SPIN_VARIANTS.A.requireEmail).toBe(true);
    expect(SPIN_VARIANTS.B.requireEmail).toBe(false);
  });

  it('defaults to email required when no experiment active', async () => {
    const result = await initSpinWheelGateTest();
    expect(result.requireEmail).toBe(true);
    expect(result.experimentActive).toBe(false);
  });

  it('returns a valid variant when experiment is active', async () => {
    __seed('AbTests', [{
      _id: 'spin-test', testName: 'spin_wheel_gate_test', active: true,
      variants: JSON.stringify([
        { id: 'A', name: 'Email gate' },
        { id: 'B', name: 'No gate' },
      ]),
      trafficPercent: 100,
    }]);

    const result = await initSpinWheelGateTest();
    expect(result.experimentActive).toBe(true);
    expect(result.variantId).toMatch(/^[AB]$/);
    const expectedEmail = SPIN_VARIANTS[result.variantId].requireEmail;
    expect(result.requireEmail).toBe(expectedEmail);
  });

  it('isEmailRequiredForSpin returns true by default', () => {
    expect(isEmailRequiredForSpin()).toBe(true);
  });

  it('trackSpinComplete does not throw', async () => {
    await expect(trackSpinComplete(true, '10% off')).resolves.not.toThrow();
  });

  it('trackPrizeRedemption does not throw', async () => {
    await expect(trackPrizeRedemption()).resolves.not.toThrow();
  });

  it('initSpinWheelGateTest returns default when backend throws (catch branch)', async () => {
    __setQueryError('AbTests', new Error('DB error'));
    const result = await initSpinWheelGateTest();
    expect(result.requireEmail).toBe(true);
    expect(result.experimentActive).toBe(false);
    expect(result.variantId).toBeNull();
  });

  it('isEmailRequiredForSpin returns true when active variant id is unknown', async () => {
    __seed('AbTests', [{
      _id: 'spin-test', testName: 'spin_wheel_gate_test', active: true,
      variants: JSON.stringify([{ id: 'X', name: 'Unknown' }]),
      trafficPercent: 100,
    }]);
    await initSpinWheelGateTest();
    expect(isEmailRequiredForSpin()).toBe(true);
  });
});

// ── Gamification Tour ────────────────────────────────────────────────

describe('gamificationTourExperiment', () => {
  it('has correct experiment name', () => {
    expect(TOUR_NAME).toBe('gamification_tour_test');
  });

  it('defines 2 variants: auto and opt-in', () => {
    expect(TOUR_VARIANTS.A.autoShow).toBe(true);
    expect(TOUR_VARIANTS.B.autoShow).toBe(false);
  });

  it('defaults to auto-show when no experiment active', async () => {
    const result = await initGamificationTourTest();
    expect(result.autoShow).toBe(true);
    expect(result.experimentActive).toBe(false);
  });

  it('returns a valid variant when experiment is active', async () => {
    __seed('AbTests', [{
      _id: 'tour-test', testName: 'gamification_tour_test', active: true,
      variants: JSON.stringify([
        { id: 'A', name: 'Auto' },
        { id: 'B', name: 'Opt-in' },
      ]),
      trafficPercent: 100,
    }]);

    const result = await initGamificationTourTest();
    expect(result.experimentActive).toBe(true);
    expect(result.variantId).toMatch(/^[AB]$/);
    const expectedAuto = TOUR_VARIANTS[result.variantId].autoShow;
    expect(result.autoShow).toBe(expectedAuto);
  });

  it('shouldAutoShowTour returns true by default', () => {
    expect(shouldAutoShowTour()).toBe(true);
  });

  it('trackTourCompletion does not throw', async () => {
    await expect(trackTourCompletion(true)).resolves.not.toThrow();
  });

  it('trackTourOptIn does not throw', async () => {
    await expect(trackTourOptIn()).resolves.not.toThrow();
  });

  it('initGamificationTourTest returns default when backend throws (catch branch)', async () => {
    __setQueryError('AbTests', new Error('DB error'));
    const result = await initGamificationTourTest();
    expect(result.autoShow).toBe(true);
    expect(result.experimentActive).toBe(false);
    expect(result.variantId).toBeNull();
  });

  it('shouldAutoShowTour returns true when active variant id is unknown', async () => {
    __seed('AbTests', [{
      _id: 'tour-test', testName: 'gamification_tour_test', active: true,
      variants: JSON.stringify([{ id: 'X', name: 'Unknown' }]),
      trafficPercent: 100,
    }]);
    await initGamificationTourTest();
    expect(shouldAutoShowTour()).toBe(true);
  });
});

// ── Cross-experiment ─────────────────────────────────────────────────

describe('experiment independence', () => {
  it('all 3 experiments have unique names', () => {
    const names = [QUIZ_NAME, SPIN_NAME, TOUR_NAME];
    expect(new Set(names).size).toBe(3);
  });

  it('all experiments default to control variant behavior', async () => {
    const quiz = await initQuizGateTest();
    const spin = await initSpinWheelGateTest();
    const tour = await initGamificationTourTest();

    expect(quiz.gateRequired).toBe(true); // control = required
    expect(spin.requireEmail).toBe(true);  // control = gate
    expect(tour.autoShow).toBe(true);      // control = auto
  });
});
