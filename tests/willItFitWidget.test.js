/**
 * @file willItFitWidget.test.js
 * @description Tests for CF-oo4b: WillItFitWidget — furniture dimension checker.
 *
 * Covers:
 *  - buildVerdict: all-fit, tight-fit, too-large, no-data
 *  - initWillItFitWidget: click handler, input parsing, result display
 *  - Fit calculation: exact match, too large, tight fit
 *  - Graceful degradation: no dimensions, backend error
 *  - Edge cases: partial inputs, zero/negative values
 *
 * CF-oo4b
 */
import { describe, it, expect, vi } from 'vitest';
import {
  initWillItFitWidget,
  buildVerdict,
} from '../src/public/WillItFitWidget.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    value: '',
    _visible: true,
    _onClick: null,
    show:    vi.fn(function () { this._visible = true; }),
    hide:    vi.fn(function () { this._visible = false; }),
    enable:  vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(function (cb) { this._onClick = cb; }),
    ...overrides,
  };
}

function make$w(inputValues = {}) {
  const els = {
    '#willItFitSection': makeEl(),
    '#fitRoomWidth':     makeEl({ value: inputValues.roomWidth ?? '' }),
    '#fitRoomDepth':     makeEl({ value: inputValues.roomDepth ?? '' }),
    '#fitDoorwayWidth':  makeEl({ value: inputValues.doorwayWidth ?? '' }),
    '#fitCheckBtn':      makeEl(),
    '#fitResultSection': makeEl(),
    '#fitVerdict':       makeEl(),
    '#fitDetails':       makeEl(),
    '#fitNoData':        makeEl(),
  };
  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  return $w;
}

// ── buildVerdict ─────────────────────────────────────────────────────────────

describe('buildVerdict', () => {
  it('returns "It fits!" when all checks pass with clearance', () => {
    const result = {
      success: true, allFit: true, anyTight: false,
      checks: [
        { check: 'doorway', fits: true, clearanceWidth: 5, clearanceHeight: 10, tight: false },
        { check: 'room', fits: true, clearanceWidth: 12, clearanceDepth: 8, tight: false },
      ],
    };
    const { verdict } = buildVerdict(result);
    expect(verdict).toBe('It fits!');
  });

  it('returns "Tight fit" when fit but tight', () => {
    const result = {
      success: true, allFit: true, anyTight: true,
      checks: [
        { check: 'doorway', fits: true, clearanceWidth: 1, clearanceHeight: 5, tight: true },
      ],
    };
    const { verdict } = buildVerdict(result);
    expect(verdict).toContain('Tight fit');
  });

  it('returns "Too large" when product does not fit', () => {
    const result = {
      success: true, allFit: false, anyTight: false,
      checks: [
        { check: 'room', fits: false, clearanceWidth: -5, clearanceDepth: -3, tight: false },
      ],
    };
    const { verdict } = buildVerdict(result);
    expect(verdict).toContain('Too large');
  });

  it('includes clearance in details for doorway', () => {
    const result = {
      success: true, allFit: true, anyTight: false,
      checks: [
        { check: 'doorway', fits: true, clearanceWidth: 4, clearanceHeight: 10, tight: false },
      ],
    };
    const { details } = buildVerdict(result);
    expect(details).toContain('Doorway');
    expect(details).toContain('4.0"');
  });

  it('includes clearance in details for room', () => {
    const result = {
      success: true, allFit: true, anyTight: false,
      checks: [
        { check: 'room', fits: true, clearanceWidth: 6, clearanceDepth: 10, tight: false },
      ],
    };
    const { details } = buildVerdict(result);
    expect(details).toContain('Room');
    expect(details).toContain('6.0"');
  });

  it('returns error message when success is false', () => {
    const { details } = buildVerdict({ success: false, error: 'No dimension data' });
    expect(details).toContain('No dimension data');
  });
});

// ── initWillItFitWidget ──────────────────────────────────────────────────────

describe('initWillItFitWidget — setup', () => {
  it('wires onClick on fitCheckBtn', async () => {
    const $w = make$w();
    await initWillItFitWidget('prod-1', { $w, checkRoomFit: vi.fn() });
    expect($w._els['#fitCheckBtn'].onClick).toHaveBeenCalled();
  });

  it('hides result section initially', async () => {
    const $w = make$w();
    await initWillItFitWidget('prod-1', { $w, checkRoomFit: vi.fn() });
    expect($w._els['#fitResultSection'].hide).toHaveBeenCalled();
  });

  it('does nothing when productId is falsy', async () => {
    const $w = make$w();
    await initWillItFitWidget('', { $w, checkRoomFit: vi.fn() });
    expect($w._els['#fitCheckBtn'].onClick).not.toHaveBeenCalled();
  });
});

describe('initWillItFitWidget — check flow', () => {
  it('calls checkRoomFit with room dimensions on click', async () => {
    const $w = make$w({ roomWidth: '120', roomDepth: '144', doorwayWidth: '36' });
    const checkFit = vi.fn().mockResolvedValue({
      success: true, allFit: true, anyTight: false,
      checks: [
        { check: 'doorway', fits: true, clearanceWidth: 4, clearanceHeight: 10, tight: false },
        { check: 'room', fits: true, clearanceWidth: 20, clearanceDepth: 30, tight: false },
      ],
    });
    await initWillItFitWidget('prod-1', { $w, checkRoomFit: checkFit });

    await $w._els['#fitCheckBtn']._onClick();

    expect(checkFit).toHaveBeenCalledWith('prod-1', {
      roomWidth: 120,
      roomDepth: 144,
      doorwayWidth: 36,
      doorwayHeight: 80,
    });
  });

  it('shows verdict text on successful check', async () => {
    const $w = make$w({ roomWidth: '120', roomDepth: '144' });
    const checkFit = vi.fn().mockResolvedValue({
      success: true, allFit: true, anyTight: false,
      checks: [{ check: 'room', fits: true, clearanceWidth: 20, clearanceDepth: 30, tight: false }],
    });
    await initWillItFitWidget('prod-1', { $w, checkRoomFit: checkFit });

    await $w._els['#fitCheckBtn']._onClick();

    expect($w._els['#fitVerdict'].text).toBe('It fits!');
    expect($w._els['#fitResultSection'].show).toHaveBeenCalled();
  });

  it('shows fitNoData when product has no dimensions', async () => {
    const $w = make$w({ roomWidth: '120', roomDepth: '144' });
    const checkFit = vi.fn().mockResolvedValue({
      success: false, error: 'No dimension data available for this product',
    });
    await initWillItFitWidget('prod-1', { $w, checkRoomFit: checkFit });

    await $w._els['#fitCheckBtn']._onClick();

    expect($w._els['#fitNoData'].show).toHaveBeenCalled();
  });

  it('shows fitNoData on backend error', async () => {
    const $w = make$w({ roomWidth: '120', roomDepth: '144' });
    const checkFit = vi.fn().mockRejectedValue(new Error('network'));
    await initWillItFitWidget('prod-1', { $w, checkRoomFit: checkFit });

    await $w._els['#fitCheckBtn']._onClick();

    expect($w._els['#fitNoData'].show).toHaveBeenCalled();
  });

  it('disables button during check and re-enables after', async () => {
    const $w = make$w({ roomWidth: '120', roomDepth: '144' });
    const checkFit = vi.fn().mockResolvedValue({
      success: true, allFit: true, anyTight: false,
      checks: [{ check: 'room', fits: true, clearanceWidth: 20, clearanceDepth: 30, tight: false }],
    });
    await initWillItFitWidget('prod-1', { $w, checkRoomFit: checkFit });

    await $w._els['#fitCheckBtn']._onClick();

    expect($w._els['#fitCheckBtn'].disable).toHaveBeenCalled();
    expect($w._els['#fitCheckBtn'].enable).toHaveBeenCalled();
  });

  it('ignores click when all inputs are empty', async () => {
    const $w = make$w({ roomWidth: '', roomDepth: '', doorwayWidth: '' });
    const checkFit = vi.fn();
    await initWillItFitWidget('prod-1', { $w, checkRoomFit: checkFit });

    await $w._els['#fitCheckBtn']._onClick();

    expect(checkFit).not.toHaveBeenCalled();
  });

  it('handles partial inputs (only doorway)', async () => {
    const $w = make$w({ doorwayWidth: '32' });
    const checkFit = vi.fn().mockResolvedValue({
      success: true, allFit: true, anyTight: false,
      checks: [{ check: 'doorway', fits: true, clearanceWidth: 2, clearanceHeight: 40, tight: false }],
    });
    await initWillItFitWidget('prod-1', { $w, checkRoomFit: checkFit });

    await $w._els['#fitCheckBtn']._onClick();

    expect(checkFit).toHaveBeenCalledWith('prod-1', {
      doorwayWidth: 32,
      doorwayHeight: 80,
    });
  });

  it('ignores negative input values', async () => {
    const $w = make$w({ roomWidth: '-10', roomDepth: '100' });
    const checkFit = vi.fn().mockResolvedValue({
      success: true, allFit: true, anyTight: false,
      checks: [],
    });
    await initWillItFitWidget('prod-1', { $w, checkRoomFit: checkFit });

    await $w._els['#fitCheckBtn']._onClick();

    // Only roomDepth should be passed (roomWidth is negative → null → excluded)
    expect(checkFit).toHaveBeenCalledWith('prod-1', { roomDepth: 100 });
  });
});
