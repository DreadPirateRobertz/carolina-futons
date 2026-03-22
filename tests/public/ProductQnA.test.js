import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadQnA,
  renderQnA,
  loadMore,
  submitQuestion,
  destroy,
  _resetForTest,
} from '../../src/public/ProductQnA.js';
import {
  __reset as wixDataReset,
  __seed,
  __getInserted,
  __setQueryError,
  __setInsertError,
  __onInsert,
} from '../__mocks__/wix-data.js';

// ─── wix-data mock ───────────────────────────────────────────────────────────
vi.mock('wix-data', () => import('../__mocks__/wix-data.js'));

// ─── Mock element factory ─────────────────────────────────────────────────────
function el(overrides = {}) {
  return {
    text: '',
    value: '',
    label: '',
    collapse: vi.fn(),
    expand: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    data: [],
    accessibility: { ariaLabel: '', ariaExpanded: undefined, ariaControls: '' },
    ...overrides,
  };
}

// ─── $w factory ──────────────────────────────────────────────────────────────
function makeW(overrides = {}) {
  const els = {
    qnaSection: el(),
    qnaAccordion: el({ onItemReady: vi.fn() }),
    qnaQuestion: el(),
    qnaAnswer: el(),
    qnaSubmitForm: el(),
    qnaQuestionInput: el(),
    qnaSubmitBtn: el(),
    qnaThankYou: el(),
    qnaLoadMore: el(),
    qnaEmpty: el(),
    ...overrides,
  };

  function $w(selector) {
    const id = selector.replace('#', '');
    return els[id] || el();
  }

  $w._els = els;
  return $w;
}

const APPROVED_ITEMS = [
  { _id: 'a1', productId: 'p1', question: 'Does it fold?', answer: 'Yes, fully.', approved: true, createdDate: new Date('2026-01-01') },
  { _id: 'a2', productId: 'p1', question: 'Frame material?', answer: 'Steel.', approved: true, createdDate: new Date('2026-01-02') },
  { _id: 'a3', productId: 'p1', question: 'Weight limit?', answer: '500 lbs.', approved: true, createdDate: new Date('2026-01-03') },
  { _id: 'a4', productId: 'p1', question: 'Warranty?', answer: '1 year.', approved: true, createdDate: new Date('2026-01-04') },
  { _id: 'a5', productId: 'p1', question: 'Comes assembled?', answer: 'Partially.', approved: true, createdDate: new Date('2026-01-05') },
];

beforeEach(() => {
  wixDataReset();
  _resetForTest();
});

// ─── loadQnA ─────────────────────────────────────────────────────────────────

describe('loadQnA', () => {
  it('returns first page of approved items for the product', async () => {
    __seed('ProductQnA', [
      ...APPROVED_ITEMS,
      { _id: 'other', productId: 'p2', question: 'Q?', answer: 'A.', approved: true, createdDate: new Date() },
      { _id: 'pend', productId: 'p1', question: 'Pending?', answer: null, approved: false, createdDate: new Date() },
    ]);
    const result = await loadQnA('p1');
    expect(result.items).toHaveLength(5);
    expect(result.items.every(i => i.productId === 'p1' && i.approved === true)).toBe(true);
  });

  it('returns up to 5 items per page', async () => {
    const extra = [
      { _id: 'a6', productId: 'p1', question: 'Q6?', answer: 'A6.', approved: true, createdDate: new Date('2026-01-06') },
    ];
    __seed('ProductQnA', [...APPROVED_ITEMS, ...extra]);
    const result = await loadQnA('p1');
    expect(result.items).toHaveLength(5);
  });

  it('returns hasMore=true when more items exist beyond first page', async () => {
    const extra = { _id: 'a6', productId: 'p1', question: 'Q6?', answer: 'A6.', approved: true, createdDate: new Date('2026-01-06') };
    __seed('ProductQnA', [...APPROVED_ITEMS, extra]);
    const result = await loadQnA('p1');
    expect(result.hasMore).toBe(true);
  });

  it('returns hasMore=false when all items fit in first page', async () => {
    __seed('ProductQnA', APPROVED_ITEMS.slice(0, 3));
    const result = await loadQnA('p1');
    expect(result.hasMore).toBe(false);
  });

  it('returns empty items array when no approved items exist', async () => {
    __seed('ProductQnA', []);
    const result = await loadQnA('p1');
    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it('sorts items by createdDate descending (newest first)', async () => {
    __seed('ProductQnA', APPROVED_ITEMS);
    const result = await loadQnA('p1');
    const dates = result.items.map(i => new Date(i.createdDate).getTime());
    expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
  });

  it('returns error=true on wixData failure', async () => {
    __setQueryError('ProductQnA', new Error('DB unavailable'));
    const result = await loadQnA('p1');
    expect(result.error).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});

// ─── renderQnA ───────────────────────────────────────────────────────────────

describe('renderQnA', () => {
  it('shows qnaSection and sets accordion data when items present', () => {
    const $w = makeW();
    renderQnA($w, APPROVED_ITEMS, false);
    expect($w._els.qnaSection.show).toHaveBeenCalled();
    expect($w._els.qnaAccordion.data).toHaveLength(5);
  });

  it('hides qnaEmpty when items are present', () => {
    const $w = makeW();
    renderQnA($w, APPROVED_ITEMS, false);
    expect($w._els.qnaEmpty.hide).toHaveBeenCalled();
  });

  it('shows qnaEmpty and hides qnaSection when no items', () => {
    const $w = makeW();
    renderQnA($w, [], false);
    expect($w._els.qnaEmpty.show).toHaveBeenCalled();
    expect($w._els.qnaSection.hide).toHaveBeenCalled();
  });

  it('shows qnaLoadMore when hasMore=true', () => {
    const $w = makeW();
    renderQnA($w, APPROVED_ITEMS, true);
    expect($w._els.qnaLoadMore.show).toHaveBeenCalled();
  });

  it('hides qnaLoadMore when hasMore=false', () => {
    const $w = makeW();
    renderQnA($w, APPROVED_ITEMS, false);
    expect($w._els.qnaLoadMore.hide).toHaveBeenCalled();
  });

  it('registers onItemReady BEFORE setting .data', () => {
    const $w = makeW();
    const callOrder = [];
    $w._els.qnaAccordion.onItemReady = vi.fn(() => callOrder.push('onItemReady'));
    Object.defineProperty($w._els.qnaAccordion, 'data', {
      set: vi.fn(() => callOrder.push('data')),
      get: vi.fn(() => []),
    });
    renderQnA($w, APPROVED_ITEMS, false);
    expect(callOrder[0]).toBe('onItemReady');
    expect(callOrder[1]).toBe('data');
  });

  it('onItemReady sets question and answer text on the repeater item', () => {
    const $w = makeW();
    let capturedCallback = null;
    $w._els.qnaAccordion.onItemReady = vi.fn((cb) => { capturedCallback = cb; });
    renderQnA($w, APPROVED_ITEMS, false);

    const itemQ = el();
    const itemA = el();
    const $item = (selector) => selector === '#qnaQuestion' ? itemQ : itemA;
    capturedCallback($item, APPROVED_ITEMS[0]);
    expect(itemQ.text).toBe('Does it fold?');
    expect(itemA.text).toBe('Yes, fully.');
  });

  it('onItemReady sets aria-expanded on question element', () => {
    const $w = makeW();
    let capturedCallback = null;
    $w._els.qnaAccordion.onItemReady = vi.fn((cb) => { capturedCallback = cb; });
    renderQnA($w, APPROVED_ITEMS, false);

    const itemQ = el();
    const itemA = el();
    const $item = (selector) => selector === '#qnaQuestion' ? itemQ : itemA;
    capturedCallback($item, APPROVED_ITEMS[0]);
    expect(itemQ.accessibility.ariaExpanded).toBe(false);
  });

  it('onItemReady hides answer panel by default (collapsed)', () => {
    const $w = makeW();
    let capturedCallback = null;
    $w._els.qnaAccordion.onItemReady = vi.fn((cb) => { capturedCallback = cb; });
    renderQnA($w, APPROVED_ITEMS, false);

    const itemQ = el();
    const itemA = el();
    const $item = (selector) => selector === '#qnaQuestion' ? itemQ : itemA;
    capturedCallback($item, APPROVED_ITEMS[0]);
    expect(itemA.collapse).toHaveBeenCalled();
  });

  it('onItemReady wires onClick to toggle answer visibility', () => {
    const $w = makeW();
    let capturedCallback = null;
    $w._els.qnaAccordion.onItemReady = vi.fn((cb) => { capturedCallback = cb; });
    renderQnA($w, APPROVED_ITEMS, false);

    let clickHandler = null;
    const itemQ = el({ onClick: vi.fn((fn) => { clickHandler = fn; }) });
    const itemA = el();
    const $item = (selector) => selector === '#qnaQuestion' ? itemQ : itemA;
    capturedCallback($item, APPROVED_ITEMS[0]);

    // First click — expand
    clickHandler();
    expect(itemA.expand).toHaveBeenCalled();
    expect(itemQ.accessibility.ariaExpanded).toBe(true);

    // Second click — collapse
    clickHandler();
    expect(itemA.collapse).toHaveBeenCalled();
    expect(itemQ.accessibility.ariaExpanded).toBe(false);
  });
});

// ─── loadMore ────────────────────────────────────────────────────────────────

describe('loadMore', () => {
  it('appends next page items to existing accordion data', async () => {
    const sixItems = [
      ...APPROVED_ITEMS,
      { _id: 'a6', productId: 'p1', question: 'Q6?', answer: 'A6.', approved: true, createdDate: new Date('2026-01-06') },
    ];
    __seed('ProductQnA', sixItems);
    const $w = makeW();
    $w._els.qnaAccordion.data = APPROVED_ITEMS.slice();

    const result = await loadMore($w, 'p1', 1);
    expect(result.appended).toBe(1);
    expect($w._els.qnaAccordion.data).toHaveLength(6);
  });

  it('hides qnaLoadMore when no more items remain', async () => {
    __seed('ProductQnA', APPROVED_ITEMS);
    const $w = makeW();
    $w._els.qnaAccordion.data = APPROVED_ITEMS.slice();

    await loadMore($w, 'p1', 1);
    expect($w._els.qnaLoadMore.hide).toHaveBeenCalled();
  });

  it('keeps qnaLoadMore visible when more items exist after load', async () => {
    const tenItems = Array.from({ length: 11 }, (_, i) => ({
      _id: `a${i + 1}`,
      productId: 'p1',
      question: `Q${i + 1}?`,
      answer: `A${i + 1}.`,
      approved: true,
      createdDate: new Date(`2026-01-${String(i + 1).padStart(2, '0')}`),
    }));
    __seed('ProductQnA', tenItems);
    const $w = makeW();
    $w._els.qnaAccordion.data = tenItems.slice(0, 5);

    const result = await loadMore($w, 'p1', 1);
    expect(result.hasMore).toBe(true);
    expect($w._els.qnaLoadMore.show).toHaveBeenCalled();
  });

  it('handles wixData error on loadMore without throwing', async () => {
    __setQueryError('ProductQnA', new Error('timeout'));
    const $w = makeW();
    $w._els.qnaAccordion.data = APPROVED_ITEMS.slice();

    await expect(loadMore($w, 'p1', 1)).resolves.not.toThrow();
    // Existing data unchanged
    expect($w._els.qnaAccordion.data).toHaveLength(5);
  });
});

// ─── submitQuestion ───────────────────────────────────────────────────────────

describe('submitQuestion', () => {
  it('inserts a pending item into ProductQnA collection', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What colors are available?';
    await submitQuestion($w, 'p1');
    const inserted = __getInserted('ProductQnA');
    expect(inserted.some(i => i.question === 'What colors are available?' && i.approved === false && i.productId === 'p1')).toBe(true);
  });

  it('shows qnaThankYou on successful submit', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What colors are available?';
    await submitQuestion($w, 'p1');
    expect($w._els.qnaThankYou.show).toHaveBeenCalled();
  });

  it('clears the input on successful submit', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What colors are available?';
    await submitQuestion($w, 'p1');
    expect($w._els.qnaQuestionInput.value).toBe('');
  });

  it('does not insert when question is empty', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = '   ';
    await submitQuestion($w, 'p1');
    expect(__getInserted('ProductQnA')).toHaveLength(0);
  });

  it('does not show qnaThankYou when question is empty', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = '';
    await submitQuestion($w, 'p1');
    expect($w._els.qnaThankYou.show).not.toHaveBeenCalled();
  });

  it('hides qnaThankYou on wixData insert error', async () => {
    __setInsertError('ProductQnA', new Error('network'));
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What is the weight?';
    await submitQuestion($w, 'p1');
    expect($w._els.qnaThankYou.show).not.toHaveBeenCalled();
  });

  it('disables submit button during submission, re-enables after', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'What colors?';
    const order = [];
    $w._els.qnaSubmitBtn.disable = vi.fn(() => order.push('disable'));
    $w._els.qnaSubmitBtn.enable = vi.fn(() => order.push('enable'));
    await submitQuestion($w, 'p1');
    expect(order[0]).toBe('disable');
    expect(order[order.length - 1]).toBe('enable');
  });

  it('rate-limits rapid repeat submissions (second call within window is no-op)', async () => {
    const insertSpy = vi.fn();
    __onInsert(insertSpy);
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'First question?';

    await submitQuestion($w, 'p1');
    $w._els.qnaQuestionInput.value = 'Second question?';
    await submitQuestion($w, 'p1');

    // Only one insert: rate limit blocks second
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  it('re-enables submit after rate-limit rejection', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'First?';
    await submitQuestion($w, 'p1');

    $w._els.qnaSubmitBtn.enable.mockClear();
    $w._els.qnaQuestionInput.value = 'Second?';
    await submitQuestion($w, 'p1'); // rate limited
    expect($w._els.qnaSubmitBtn.enable).toHaveBeenCalled();
  });
});

// ─── destroy ─────────────────────────────────────────────────────────────────

describe('destroy', () => {
  it('resets module state (rate limit timer clears)', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'First?';
    await submitQuestion($w, 'p1');

    destroy();

    // After destroy, submission should go through again
    const insertSpy = vi.fn();
    __onInsert(insertSpy);
    $w._els.qnaQuestionInput.value = 'Second?';
    await submitQuestion($w, 'p1');
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── Integration: loadQnA → renderQnA ────────────────────────────────────────

describe('integration: load and render', () => {
  it('full flow: load approved items and render to accordion', async () => {
    __seed('ProductQnA', APPROVED_ITEMS);
    const $w = makeW();

    const { items, hasMore } = await loadQnA('p1');
    renderQnA($w, items, hasMore);

    expect($w._els.qnaSection.show).toHaveBeenCalled();
    expect($w._els.qnaAccordion.data).toHaveLength(5);
    expect($w._els.qnaEmpty.hide).toHaveBeenCalled();
  });

  it('full flow: empty collection shows empty state', async () => {
    __seed('ProductQnA', []);
    const $w = makeW();

    const { items, hasMore } = await loadQnA('p1');
    renderQnA($w, items, hasMore);

    expect($w._els.qnaEmpty.show).toHaveBeenCalled();
    expect($w._els.qnaSection.hide).toHaveBeenCalled();
  });

  it('full flow: load error shows empty state', async () => {
    __setQueryError('ProductQnA', new Error('DB down'));
    const $w = makeW();

    const { items, hasMore } = await loadQnA('p1');
    renderQnA($w, items, hasMore);

    expect($w._els.qnaEmpty.show).toHaveBeenCalled();
  });

  it('load → render → loadMore appends without re-rendering existing items', async () => {
    const sixItems = [
      ...APPROVED_ITEMS,
      { _id: 'a6', productId: 'p1', question: 'Q6?', answer: 'A6.', approved: true, createdDate: new Date('2026-01-06') },
    ];
    __seed('ProductQnA', sixItems);
    const $w = makeW();

    const { items, hasMore } = await loadQnA('p1');
    renderQnA($w, items, hasMore);
    expect($w._els.qnaAccordion.data).toHaveLength(5);

    // Page 2
    await loadMore($w, 'p1', 1);
    expect($w._els.qnaAccordion.data).toHaveLength(6);
    expect($w._els.qnaLoadMore.hide).toHaveBeenCalled();
  });
});

// ─── edge cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('loadQnA filters out unapproved items from other products', async () => {
    __seed('ProductQnA', [
      { _id: 'x1', productId: 'p2', question: 'Other product?', answer: 'Yes.', approved: true, createdDate: new Date() },
      { _id: 'x2', productId: 'p1', question: 'Pending?', answer: null, approved: false, createdDate: new Date() },
      ...APPROVED_ITEMS.slice(0, 2),
    ]);
    const result = await loadQnA('p1');
    expect(result.items).toHaveLength(2);
    expect(result.items.every(i => i.productId === 'p1' && i.approved)).toBe(true);
  });

  it('submitQuestion ignores whitespace-only input', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = '\t  \n';
    await submitQuestion($w, 'p1');
    expect(__getInserted('ProductQnA')).toHaveLength(0);
    expect($w._els.qnaThankYou.show).not.toHaveBeenCalled();
  });

  it('renderQnA with hasMore=false hides load more and shows section', () => {
    const $w = makeW();
    renderQnA($w, [APPROVED_ITEMS[0]], false);
    expect($w._els.qnaLoadMore.hide).toHaveBeenCalled();
    expect($w._els.qnaSection.show).toHaveBeenCalled();
  });

  it('destroy allows immediate re-submission after reset', async () => {
    const $w = makeW();
    $w._els.qnaQuestionInput.value = 'First?';
    await submitQuestion($w, 'p1');
    destroy();

    wixDataReset();
    $w._els.qnaQuestionInput.value = 'After reset?';
    await submitQuestion($w, 'p1');
    const inserted = __getInserted('ProductQnA');
    expect(inserted.some(i => i.question === 'After reset?')).toBe(true);
  });
});

// ─── accessibility ────────────────────────────────────────────────────────────

describe('accessibility', () => {
  it('onItemReady sets aria-controls pairing question → answer', () => {
    const $w = makeW();
    let capturedCallback = null;
    $w._els.qnaAccordion.onItemReady = vi.fn((cb) => { capturedCallback = cb; });
    renderQnA($w, [APPROVED_ITEMS[0]], false);

    const itemQ = el();
    const itemA = el();
    const $item = (selector) => selector === '#qnaQuestion' ? itemQ : itemA;
    capturedCallback($item, APPROVED_ITEMS[0]);

    expect(itemQ.accessibility.ariaControls).toBeTruthy();
    expect(itemA.accessibility).toBeDefined();
  });

  it('accordion question element gets role button ariaLabel', () => {
    const $w = makeW();
    let capturedCallback = null;
    $w._els.qnaAccordion.onItemReady = vi.fn((cb) => { capturedCallback = cb; });
    renderQnA($w, [APPROVED_ITEMS[0]], false);

    const itemQ = el();
    const itemA = el();
    const $item = (selector) => selector === '#qnaQuestion' ? itemQ : itemA;
    capturedCallback($item, APPROVED_ITEMS[0]);

    expect(itemQ.accessibility.ariaLabel).toContain('Does it fold?');
  });
});
