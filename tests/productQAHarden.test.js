/**
 * @file productQAHarden.test.js
 * @description CF-0b22: Hardening tests for Product Q&A.
 *
 * Covers gaps not in productQA.test.js / productQADeep.test.js:
 *  - submitQuestion: owner notification email sent after submission
 *  - submitQuestion: email failure does NOT block successful submission
 *  - submitQuestion: no email when question is invalid (rejected early)
 *  - insertGuestQuestion: submits without member auth
 *  - insertGuestQuestion: validation (short question, bad productId)
 *  - insertGuestQuestion: owner notification sent
 *  - HTTP get_productQA: returns approved Q&A for valid productId
 *  - HTTP get_productQA: returns 400 for missing productId
 *  - HTTP post_submitQuestion: inserts and returns success
 *  - HTTP post_submitQuestion: returns 400 for short question
 *  - HTTP post_submitQuestion: returns 400 for bad JSON
 *  - HTTP post_answerQuestion: updates status with valid admin key
 *  - HTTP post_answerQuestion: returns 403 with wrong admin key
 *  - HTTP post_answerQuestion: returns 404 for missing question
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetCrm, __getEmailLog, __failNextEmail } from './__mocks__/wix-crm-backend.js';
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from './__mocks__/wix-http-functions.js';
import {
  submitQuestion,
  insertGuestQuestion,
} from '../src/backend/productQA.web.js';
import {
  get_productQA,
  post_submitQuestion,
  post_answerQuestion,
} from '../src/backend/http-functions.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeRequest({ query = {}, headers = {}, body = null } = {}) {
  return {
    query,
    headers,
    body: {
      json: async () => {
        if (body === null) throw new Error('No body');
        return body;
      },
    },
  };
}

beforeEach(() => {
  __seed('ProductQuestions', []);
  __setMember({ _id: 'member-1', contactDetails: { firstName: 'Alice', lastName: 'Smith' } });
  __setSecrets({ SITE_OWNER_CONTACT_ID: 'owner-contact-1', QA_ADMIN_KEY: 'test-admin-key-abc123' });
  resetCrm();
});

// ── submitQuestion — owner email notification ─────────────────────────

describe('submitQuestion — owner email notification', () => {
  it('sends triggered email to owner after question is submitted', async () => {
    const result = await submitQuestion('product-1', 'What size mattress is included with this futon?');
    expect(result.success).toBe(true);

    // Wait for the best-effort notification (fire-and-forget with .catch)
    await new Promise(r => setTimeout(r, 0));

    const log = __getEmailLog();
    expect(log).toHaveLength(1);
    expect(log[0].templateId).toBe('new_product_question');
    expect(log[0].contactId).toBe('owner-contact-1');
    expect(log[0].options.variables.productId).toBe('product-1');
    expect(log[0].options.variables.question).toContain('mattress');
  });

  it('submission succeeds even when email notification fails', async () => {
    __failNextEmail();

    const result = await submitQuestion('product-1', 'Does this futon come with delivery and setup?');
    expect(result.success).toBe(true);

    await new Promise(r => setTimeout(r, 0));
    // Email log should be empty (email threw, was caught, not retried)
    const log = __getEmailLog();
    expect(log).toHaveLength(0);
  });

  it('does NOT send email when question is rejected (too short)', async () => {
    const result = await submitQuestion('product-1', 'Short?');
    expect(result.success).toBe(false);

    await new Promise(r => setTimeout(r, 0));
    expect(__getEmailLog()).toHaveLength(0);
  });

  it('does NOT send email when member is not authenticated', async () => {
    __setMember(null);
    const result = await submitQuestion('product-1', 'What colors are available for this sofa?');
    expect(result.success).toBe(false);

    await new Promise(r => setTimeout(r, 0));
    expect(__getEmailLog()).toHaveLength(0);
  });

  it('email variables include memberName', async () => {
    await submitQuestion('product-1', 'Is this futon available in queen size?');
    await new Promise(r => setTimeout(r, 0));

    const log = __getEmailLog();
    expect(log).toHaveLength(1);
    expect(log[0].options.variables.memberName).toContain('Alice');
  });
});

// ── insertGuestQuestion ───────────────────────────────────────────────

describe('insertGuestQuestion', () => {
  it('inserts question without member authentication', async () => {
    let inserted = null;
    __onInsert((_col, item) => { inserted = item; });

    const result = await insertGuestQuestion({
      productId: 'product-1',
      question: 'Does this futon fold flat for storage?',
      memberName: 'Jane',
    });

    expect(result.success).toBe(true);
    expect(result.data.question).toContain('flat');
    expect(inserted.memberId).toBeNull();
    expect(inserted.memberName).toBe('Jane');
    expect(inserted.status).toBe('pending');
  });

  it('falls back to Customer when no name provided', async () => {
    let inserted = null;
    __onInsert((_col, item) => { inserted = item; });

    await insertGuestQuestion({
      productId: 'product-1',
      question: 'What is the weight capacity of this futon?',
    });

    expect(inserted.memberName).toBe('Customer');
  });

  it('rejects question shorter than 10 characters', async () => {
    const result = await insertGuestQuestion({ productId: 'product-1', question: 'Short?' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('10 characters');
  });

  it('rejects empty product ID', async () => {
    const result = await insertGuestQuestion({ productId: '', question: 'Valid question about this product?' });
    expect(result.success).toBe(false);
  });

  it('sends owner notification email on success', async () => {
    await insertGuestQuestion({
      productId: 'product-1',
      question: 'What type of wood is used in the frame?',
      memberName: 'Bob',
    });
    await new Promise(r => setTimeout(r, 0));

    const log = __getEmailLog();
    expect(log).toHaveLength(1);
    expect(log[0].options.variables.memberName).toBe('Bob');
  });
});

// ── HTTP get_productQA ────────────────────────────────────────────────

describe('HTTP get_productQA', () => {
  it('returns answered Q&A for valid productId', async () => {
    __seed('ProductQuestions', [
      { _id: 'q-1', productId: 'prod-1', question: 'Is it comfy?', answer: 'Yes!', status: 'answered', helpfulVotes: 3 },
      { _id: 'q-2', productId: 'prod-1', question: 'Assembly?', answer: null, status: 'pending', helpfulVotes: 0 },
    ]);

    const req = makeRequest({ query: { productId: 'prod-1' } });
    const res = await get_productQA(req);

    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    // Only answered questions (answeredOnly: true)
    expect(data.questions).toHaveLength(1);
    expect(data.questions[0].question).toBe('Is it comfy?');
  });

  it('returns 400 when productId is missing', async () => {
    const req = makeRequest({ query: {} });
    const res = await get_productQA(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toContain('productId');
  });

  it('passes page and pageSize to backend', async () => {
    __seed('ProductQuestions', []);
    const req = makeRequest({ query: { productId: 'prod-1', page: '2', pageSize: '5' } });
    const res = await get_productQA(req);
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(5);
  });

  it('returns 200 with empty array when no answered questions', async () => {
    __seed('ProductQuestions', []);
    const req = makeRequest({ query: { productId: 'prod-1' } });
    const res = await get_productQA(req);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).questions).toHaveLength(0);
  });
});

// ── HTTP post_submitQuestion ──────────────────────────────────────────

describe('HTTP post_submitQuestion', () => {
  it('inserts question and returns 200 success', async () => {
    let inserted = null;
    __onInsert((_col, item) => { inserted = item; });

    const req = makeRequest({
      body: { productId: 'product-1', question: 'Can this futon be used as a permanent bed?', name: 'Tom' },
    });
    const res = await post_submitQuestion(req);

    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data._id).toBeTruthy();
    expect(inserted.status).toBe('pending');
  });

  it('returns 400 for question shorter than 10 chars', async () => {
    const req = makeRequest({ body: { productId: 'product-1', question: 'Short?' } });
    const res = await post_submitQuestion(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toContain('10 characters');
  });

  it('returns 400 for missing productId', async () => {
    const req = makeRequest({ body: { question: 'What is the warranty on this futon frame?' } });
    const res = await post_submitQuestion(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = makeRequest({ body: null }); // null triggers json() throw
    const res = await post_submitQuestion(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toContain('Invalid JSON');
  });
});

// ── HTTP post_answerQuestion ──────────────────────────────────────────

describe('HTTP post_answerQuestion', () => {
  beforeEach(() => {
    __seed('ProductQuestions', [
      { _id: 'q-1', productId: 'product-1', question: 'Is it firm?', status: 'pending' },
    ]);
  });

  it('answers question with valid admin key', async () => {
    let updated = null;
    __onUpdate((_col, item) => { updated = item; });

    const req = makeRequest({
      headers: { 'x-admin-key': 'test-admin-key-abc123' },
      body: { questionId: 'q-1', answer: 'The futon comes in firm and medium options.' },
    });
    const res = await post_answerQuestion(req);

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
    expect(updated.status).toBe('answered');
    expect(updated.answeredBy).toBe('Carolina Futons');
  });

  it('returns 403 with wrong admin key', async () => {
    const req = makeRequest({
      headers: { 'x-admin-key': 'wrong-key' },
      body: { questionId: 'q-1', answer: 'Here is the answer to your question.' },
    });
    const res = await post_answerQuestion(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 with missing admin key', async () => {
    const req = makeRequest({
      headers: {},
      body: { questionId: 'q-1', answer: 'Here is the answer to your question.' },
    });
    const res = await post_answerQuestion(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for missing questionId', async () => {
    const req = makeRequest({
      headers: { 'x-admin-key': 'test-admin-key-abc123' },
      body: { answer: 'Here is the answer to your question.' },
    });
    const res = await post_answerQuestion(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for short answer', async () => {
    const req = makeRequest({
      headers: { 'x-admin-key': 'test-admin-key-abc123' },
      body: { questionId: 'q-1', answer: 'Yes' },
    });
    const res = await post_answerQuestion(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent question', async () => {
    const req = makeRequest({
      headers: { 'x-admin-key': 'test-admin-key-abc123' },
      body: { questionId: 'nonexistent', answer: 'The frame is made of solid hardwood.' },
    });
    const res = await post_answerQuestion(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = makeRequest({
      headers: { 'x-admin-key': 'test-admin-key-abc123' },
      body: null,
    });
    const res = await post_answerQuestion(req);
    expect(res.status).toBe(400);
  });
});
