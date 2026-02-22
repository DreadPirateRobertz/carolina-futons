import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  submitQuestion,
  answerQuestion,
  getProductQuestions,
  voteHelpful,
  flagQuestion,
  getUnanswered,
  getQASchema,
} from '../src/backend/productQA.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'alice@example.com', contactDetails: { firstName: 'Alice', lastName: 'Smith' } });
});

// ── submitQuestion ───────────────────────────────────────────────────

describe('submitQuestion', () => {
  it('submits a valid question', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });
    __seed('ProductQuestions', []);

    const result = await submitQuestion('product-1', 'Does this futon come with a mattress included?');
    expect(result.success).toBe(true);
    expect(result.data.question).toContain('mattress');
    expect(inserted.productId).toBe('product-1');
    expect(inserted.memberName).toBe('Alice S.');
    expect(inserted.status).toBe('pending');
    expect(inserted.helpfulVotes).toBe(0);
  });

  it('rejects questions shorter than 10 characters', async () => {
    __seed('ProductQuestions', []);
    const result = await submitQuestion('product-1', 'How?');
    expect(result.success).toBe(false);
    expect(result.error).toContain('10 characters');
  });

  it('rejects empty question', async () => {
    __seed('ProductQuestions', []);
    const result = await submitQuestion('product-1', '');
    expect(result.success).toBe(false);
  });

  it('rejects invalid product ID', async () => {
    const result = await submitQuestion('', 'Valid question text here');
    expect(result.success).toBe(false);
  });

  it('enforces per-product question limit', async () => {
    const questions = Array.from({ length: 5 }, (_, i) => ({
      _id: `q-${i}`, productId: 'product-1', memberId: 'member-1',
    }));
    __seed('ProductQuestions', questions);

    const result = await submitQuestion('product-1', 'One more question about this product?');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum');
  });

  it('sanitizes HTML in question text', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });
    __seed('ProductQuestions', []);

    await submitQuestion('product-1', '<script>alert("xss")</script>Is this a real question?');
    expect(inserted.question).not.toContain('<script>');
  });

  it('uses fallback name when firstName missing', async () => {
    __setMember({ _id: 'member-1', contactDetails: {} });
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });
    __seed('ProductQuestions', []);

    await submitQuestion('product-1', 'What are the dimensions of this futon?');
    expect(inserted.memberName).toBe('Customer');
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await submitQuestion('product-1', 'What color options are available?');
    expect(result.success).toBe(false);
  });
});

// ── answerQuestion ───────────────────────────────────────────────────

describe('answerQuestion', () => {
  it('admin answers a question', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('ProductQuestions', [{
      _id: 'q-1', productId: 'product-1', memberId: 'member-1',
      question: 'Does it come with a mattress?', status: 'pending',
    }]);

    const result = await answerQuestion('q-1', 'Yes, all our futon packages include a mattress.');
    expect(result.success).toBe(true);
    expect(updated.answer).toContain('mattress');
    expect(updated.answeredBy).toBe('Carolina Futons');
    expect(updated.answeredAt).toBeInstanceOf(Date);
    expect(updated.status).toBe('answered');
  });

  it('rejects short answers', async () => {
    __seed('ProductQuestions', [{ _id: 'q-1', status: 'pending' }]);
    const result = await answerQuestion('q-1', 'Yes');
    expect(result.success).toBe(false);
    expect(result.error).toContain('5 characters');
  });

  it('rejects empty answer', async () => {
    __seed('ProductQuestions', [{ _id: 'q-1', status: 'pending' }]);
    const result = await answerQuestion('q-1', '');
    expect(result.success).toBe(false);
  });

  it('fails for non-existent question', async () => {
    __seed('ProductQuestions', []);
    const result = await answerQuestion('nonexistent', 'Great question! Here is the answer.');
    expect(result.success).toBe(false);
  });

  it('fails for invalid question ID', async () => {
    const result = await answerQuestion('', 'Answer text here');
    expect(result.success).toBe(false);
  });
});

// ── getProductQuestions ───────────────────────────────────────────────

describe('getProductQuestions', () => {
  it('returns questions for a product', async () => {
    __seed('ProductQuestions', [
      { _id: 'q-1', productId: 'product-1', question: 'Q1?', answer: 'A1', status: 'answered', helpfulVotes: 5, memberName: 'Alice S.' },
      { _id: 'q-2', productId: 'product-1', question: 'Q2?', answer: null, status: 'pending', helpfulVotes: 2, memberName: 'Bob T.' },
      { _id: 'q-3', productId: 'product-1', question: 'Bad Q', answer: null, status: 'hidden', helpfulVotes: 0 },
    ]);

    const result = await getProductQuestions('product-1');
    expect(result.success).toBe(true);
    // hidden questions should be excluded
    expect(result.data.questions).toHaveLength(2);
    expect(result.data.questions[0].question).toBeDefined();
  });

  it('filters answered only', async () => {
    __seed('ProductQuestions', [
      { _id: 'q-1', productId: 'product-1', status: 'answered', helpfulVotes: 0 },
      { _id: 'q-2', productId: 'product-1', status: 'pending', helpfulVotes: 0 },
    ]);

    const result = await getProductQuestions('product-1', { answeredOnly: true });
    expect(result.data.questions).toHaveLength(1);
  });

  it('paginates results', async () => {
    __seed('ProductQuestions', []);
    const result = await getProductQuestions('product-1', { page: 2, pageSize: 5 });
    expect(result.data.page).toBe(2);
    expect(result.data.pageSize).toBe(5);
  });

  it('clamps page size', async () => {
    __seed('ProductQuestions', []);
    const result = await getProductQuestions('product-1', { pageSize: 100 });
    expect(result.data.pageSize).toBe(50);
  });

  it('fails for invalid product ID', async () => {
    const result = await getProductQuestions('');
    expect(result.success).toBe(false);
  });

  it('returns empty for product with no questions', async () => {
    __seed('ProductQuestions', []);
    const result = await getProductQuestions('product-1');
    expect(result.data.questions).toHaveLength(0);
  });
});

// ── voteHelpful ──────────────────────────────────────────────────────

describe('voteHelpful', () => {
  it('increments helpful vote count', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('ProductQuestions', [{
      _id: 'q-1', helpfulVotes: 3, voters: '[]',
    }]);

    const result = await voteHelpful('q-1');
    expect(result.success).toBe(true);
    expect(result.data.helpfulVotes).toBe(4);
    expect(updated.helpfulVotes).toBe(4);
  });

  it('prevents duplicate votes', async () => {
    __seed('ProductQuestions', [{
      _id: 'q-1', helpfulVotes: 1, voters: '["member-1"]',
    }]);

    const result = await voteHelpful('q-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already voted');
  });

  it('fails for non-existent question', async () => {
    __seed('ProductQuestions', []);
    const result = await voteHelpful('nonexistent');
    expect(result.success).toBe(false);
  });

  it('fails for invalid question ID', async () => {
    const result = await voteHelpful('');
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await voteHelpful('q-1');
    expect(result.success).toBe(false);
  });

  it('handles invalid voters JSON gracefully', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('ProductQuestions', [{
      _id: 'q-1', helpfulVotes: 0, voters: 'invalid-json',
    }]);

    const result = await voteHelpful('q-1');
    expect(result.success).toBe(true);
    expect(updated.helpfulVotes).toBe(1);
  });
});

// ── flagQuestion ─────────────────────────────────────────────────────

describe('flagQuestion', () => {
  it('flags a question and increments count', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('ProductQuestions', [{
      _id: 'q-1', flagCount: 0, flaggedBy: '[]', status: 'pending',
    }]);

    const result = await flagQuestion('q-1');
    expect(result.success).toBe(true);
    expect(result.data.flagCount).toBe(1);
    expect(result.data.hidden).toBe(false);
  });

  it('auto-hides after reaching flag threshold', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('ProductQuestions', [{
      _id: 'q-1', flagCount: 2, flaggedBy: '["other-1", "other-2"]', status: 'pending',
    }]);

    const result = await flagQuestion('q-1');
    expect(result.data.flagCount).toBe(3);
    expect(result.data.hidden).toBe(true);
    expect(updated.status).toBe('hidden');
  });

  it('prevents duplicate flags', async () => {
    __seed('ProductQuestions', [{
      _id: 'q-1', flagCount: 1, flaggedBy: '["member-1"]', status: 'pending',
    }]);

    const result = await flagQuestion('q-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already flagged');
  });

  it('fails for non-existent question', async () => {
    __seed('ProductQuestions', []);
    const result = await flagQuestion('nonexistent');
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await flagQuestion('q-1');
    expect(result.success).toBe(false);
  });
});

// ── getUnanswered ────────────────────────────────────────────────────

describe('getUnanswered', () => {
  it('returns pending questions for admin', async () => {
    __seed('ProductQuestions', [
      { _id: 'q-1', productId: 'p-1', status: 'pending', question: 'Q1?', _createdDate: new Date() },
      { _id: 'q-2', productId: 'p-2', status: 'pending', question: 'Q2?', _createdDate: new Date() },
      { _id: 'q-3', productId: 'p-1', status: 'answered', question: 'Q3?' },
    ]);

    const result = await getUnanswered();
    expect(result.success).toBe(true);
    expect(result.data.questions).toHaveLength(2);
    expect(result.data.questions.every(q => q.productId)).toBe(true);
  });

  it('paginates results', async () => {
    __seed('ProductQuestions', []);
    const result = await getUnanswered({ page: 1, pageSize: 5 });
    expect(result.data.page).toBe(1);
    expect(result.data.pageSize).toBe(5);
  });

  it('returns empty when all answered', async () => {
    __seed('ProductQuestions', [
      { _id: 'q-1', status: 'answered' },
    ]);

    const result = await getUnanswered();
    expect(result.data.questions).toHaveLength(0);
  });
});

// ── getQASchema ──────────────────────────────────────────────────────

describe('getQASchema', () => {
  it('generates FAQ schema for answered questions', async () => {
    __seed('ProductQuestions', [
      { _id: 'q-1', productId: 'product-1', question: 'Is it comfortable?', answer: 'Yes, very comfortable.', status: 'answered', helpfulVotes: 5 },
      { _id: 'q-2', productId: 'product-1', question: 'What colors?', answer: 'Black, brown, grey.', status: 'answered', helpfulVotes: 3 },
    ]);

    const result = await getQASchema('product-1');
    expect(result.success).toBe(true);
    expect(result.data.schema['@type']).toBe('FAQPage');
    expect(result.data.schema.mainEntity).toHaveLength(2);
    expect(result.data.schema.mainEntity[0]['@type']).toBe('Question');
    expect(result.data.questionCount).toBe(2);
  });

  it('returns null schema when no answered questions', async () => {
    __seed('ProductQuestions', [
      { _id: 'q-1', productId: 'product-1', status: 'pending', helpfulVotes: 0 },
    ]);

    const result = await getQASchema('product-1');
    expect(result.success).toBe(true);
    expect(result.data.schema).toBeNull();
  });

  it('fails for invalid product ID', async () => {
    const result = await getQASchema('');
    expect(result.success).toBe(false);
  });

  it('excludes pending questions from schema', async () => {
    __seed('ProductQuestions', [
      { _id: 'q-1', productId: 'product-1', status: 'answered', question: 'Q1?', answer: 'A1', helpfulVotes: 0 },
      { _id: 'q-2', productId: 'product-1', status: 'pending', question: 'Q2?', helpfulVotes: 0 },
    ]);

    const result = await getQASchema('product-1');
    expect(result.data.schema.mainEntity).toHaveLength(1);
  });
});
