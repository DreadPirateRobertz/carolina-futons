import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
  },
}));

let _mockMember = { _id: 'member1', contactDetails: { firstName: 'Jane', lastName: 'Doe' } };
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: async () => _mockMember },
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ne: (field, val) => { filters[`${field}_ne`] = { type: 'ne', field, value: val }; return chain; },
    contains: (field, val) => { filters[`${field}_contains`] = { type: 'contains', field, value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    skip: (n) => { filters._skip = n; return chain; },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit' || key === '_skip') continue;
        if (f.type === 'eq') items = items.filter(i => i[f.field || key] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
      }
      return items.length;
    },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit' || key === '_skip') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
        if (f.type === 'contains') items = items.filter(i => (i[f.field] || '').toLowerCase().includes(f.value));
      }
      const skip = filters._skip || 0;
      const limit = filters._limit || items.length;
      items = items.slice(skip, skip + limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      const col = _collections[collection] || [];
      const idx = col.findIndex(i => i._id === item._id);
      if (idx >= 0) col[idx] = { ...item };
      return item;
    },
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  _mockMember = { _id: 'member1', contactDetails: { firstName: 'Jane', lastName: 'Doe' } };
  vi.resetModules();
  mod = await import('../src/backend/productQA.web.js');
});

// ── submitQuestion ─────────────────────────────────────────────────

describe('submitQuestion', () => {
  it('rejects invalid product ID', async () => {
    const r = await mod.submitQuestion(null, 'What size is this?');
    expect(r.success).toBe(false);
  });

  it('rejects short question (<10 chars)', async () => {
    const r = await mod.submitQuestion('prod1', 'Short');
    expect(r.success).toBe(false);
    expect(r.error).toContain('10 characters');
  });

  it('rejects empty question', async () => {
    const r = await mod.submitQuestion('prod1', '');
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.submitQuestion('prod1', 'What are the dimensions of this futon?');
    expect(r.success).toBe(false);
    expect(r.error).toContain('authenticated');
  });

  it('submits valid question', async () => {
    const r = await mod.submitQuestion('prod1', 'What are the dimensions of this futon?');
    expect(r.success).toBe(true);
    expect(r.data._id).toBeTruthy();
    expect(r.data.question).toContain('dimensions');
  });

  it('sets member name from contact details', async () => {
    await mod.submitQuestion('prod1', 'What colors are available for this?');
    const q = _collections['ProductQuestions'][0];
    expect(q.memberName).toContain('Jane');
  });

  it('defaults member name to Customer when no contact details', async () => {
    _mockMember = { _id: 'member1', contactDetails: {} };
    await mod.submitQuestion('prod1', 'Is this futon comfortable?');
    const q = _collections['ProductQuestions'][0];
    expect(q.memberName).toBe('Customer');
  });

  it('rate limits to 5 questions per product per member', async () => {
    __seed('ProductQuestions', Array.from({ length: 5 }, (_, i) => ({
      _id: `q${i}`, productId: 'prod1', memberId: 'member1',
    })));
    const r = await mod.submitQuestion('prod1', 'This is my sixth question for this product?');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Maximum 5');
  });

  it('initializes question with pending status', async () => {
    await mod.submitQuestion('prod1', 'What material is the frame made of?');
    const q = _collections['ProductQuestions'][0];
    expect(q.status).toBe('pending');
    expect(q.helpfulVotes).toBe(0);
    expect(q.answer).toBeNull();
  });
});

// ── answerQuestion ─────────────────────────────────────────────────

describe('answerQuestion', () => {
  it('rejects invalid question ID', async () => {
    const r = await mod.answerQuestion(null, 'This is the answer.');
    expect(r.success).toBe(false);
  });

  it('rejects short answer (<5 chars)', async () => {
    __seed('ProductQuestions', [{ _id: 'q1', question: 'Test?', status: 'pending' }]);
    const r = await mod.answerQuestion('q1', 'No');
    expect(r.success).toBe(false);
    expect(r.error).toContain('5 characters');
  });

  it('rejects non-existent question', async () => {
    const r = await mod.answerQuestion('missing', 'Here is the answer to your question.');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('answers question and updates status', async () => {
    __seed('ProductQuestions', [{ _id: 'q1', question: 'Test?', status: 'pending' }]);
    const r = await mod.answerQuestion('q1', 'The frame is made of solid hardwood.');
    expect(r.success).toBe(true);
    expect(_collections['ProductQuestions'][0].status).toBe('answered');
    expect(_collections['ProductQuestions'][0].answer).toContain('hardwood');
    expect(_collections['ProductQuestions'][0].answeredBy).toBe('Carolina Futons');
  });
});

// ── getProductQuestions ─────────────────────────────────────────────

describe('getProductQuestions', () => {
  it('rejects invalid product ID', async () => {
    const r = await mod.getProductQuestions(null);
    expect(r.success).toBe(false);
  });

  it('returns empty for product with no questions', async () => {
    const r = await mod.getProductQuestions('prod1');
    expect(r.success).toBe(true);
    expect(r.data.questions).toHaveLength(0);
  });

  it('returns questions for a product', async () => {
    __seed('ProductQuestions', [
      { _id: 'q1', productId: 'prod1', question: 'Is this comfy?', status: 'answered', helpfulVotes: 5 },
      { _id: 'q2', productId: 'prod1', question: 'What size?', status: 'pending', helpfulVotes: 0 },
      { _id: 'q3', productId: 'prod2', question: 'Other product', status: 'answered', helpfulVotes: 2 },
    ]);
    const r = await mod.getProductQuestions('prod1');
    expect(r.success).toBe(true);
    expect(r.data.questions.length).toBe(2);
  });

  it('excludes hidden questions', async () => {
    __seed('ProductQuestions', [
      { _id: 'q1', productId: 'prod1', question: 'Good?', status: 'answered' },
      { _id: 'q2', productId: 'prod1', question: 'Bad?', status: 'hidden' },
    ]);
    const r = await mod.getProductQuestions('prod1');
    expect(r.data.questions.length).toBe(1);
  });

  it('filters answered only when requested', async () => {
    __seed('ProductQuestions', [
      { _id: 'q1', productId: 'prod1', question: 'Answered?', status: 'answered' },
      { _id: 'q2', productId: 'prod1', question: 'Pending?', status: 'pending' },
    ]);
    const r = await mod.getProductQuestions('prod1', { answeredOnly: true });
    expect(r.data.questions.length).toBe(1);
    expect(r.data.questions[0]._id).toBe('q1');
  });

  it('defaults page and pageSize', async () => {
    const r = await mod.getProductQuestions('prod1');
    expect(r.data.page).toBe(1);
    expect(r.data.pageSize).toBe(10);
  });

  it('respects page and pageSize options', async () => {
    const r = await mod.getProductQuestions('prod1', { page: 2, pageSize: 5 });
    expect(r.data.page).toBe(2);
    expect(r.data.pageSize).toBe(5);
  });

  it('caps pageSize at 50', async () => {
    const r = await mod.getProductQuestions('prod1', { pageSize: 100 });
    expect(r.data.pageSize).toBe(50);
  });
});

// ── voteHelpful ────────────────────────────────────────────────────

describe('voteHelpful', () => {
  it('rejects invalid question ID', async () => {
    const r = await mod.voteHelpful(null);
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.voteHelpful('q1');
    expect(r.success).toBe(false);
  });

  it('rejects non-existent question', async () => {
    const r = await mod.voteHelpful('missing');
    expect(r.success).toBe(false);
  });

  it('increments vote count', async () => {
    __seed('ProductQuestions', [{ _id: 'q1', helpfulVotes: 3, voters: '[]' }]);
    const r = await mod.voteHelpful('q1');
    expect(r.success).toBe(true);
    expect(r.data.helpfulVotes).toBe(4);
  });

  it('prevents duplicate voting', async () => {
    __seed('ProductQuestions', [{ _id: 'q1', helpfulVotes: 3, voters: '["member1"]' }]);
    const r = await mod.voteHelpful('q1');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Already voted');
  });

  it('adds member to voters list', async () => {
    __seed('ProductQuestions', [{ _id: 'q1', helpfulVotes: 0, voters: '[]' }]);
    await mod.voteHelpful('q1');
    const voters = JSON.parse(_collections['ProductQuestions'][0].voters);
    expect(voters).toContain('member1');
  });
});

// ── flagQuestion ───────────────────────────────────────────────────

describe('flagQuestion', () => {
  it('rejects invalid question ID', async () => {
    const r = await mod.flagQuestion(null);
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.flagQuestion('q1');
    expect(r.success).toBe(false);
  });

  it('increments flag count', async () => {
    __seed('ProductQuestions', [{ _id: 'q1', flagCount: 0, flaggedBy: '[]', status: 'pending' }]);
    const r = await mod.flagQuestion('q1');
    expect(r.success).toBe(true);
    expect(r.data.flagCount).toBe(1);
    expect(r.data.hidden).toBe(false);
  });

  it('auto-hides after 3 flags', async () => {
    __seed('ProductQuestions', [{ _id: 'q1', flagCount: 2, flaggedBy: '["m2","m3"]', status: 'pending' }]);
    const r = await mod.flagQuestion('q1');
    expect(r.data.flagCount).toBe(3);
    expect(r.data.hidden).toBe(true);
    expect(_collections['ProductQuestions'][0].status).toBe('hidden');
  });

  it('prevents duplicate flagging', async () => {
    __seed('ProductQuestions', [{ _id: 'q1', flagCount: 1, flaggedBy: '["member1"]', status: 'pending' }]);
    const r = await mod.flagQuestion('q1');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Already flagged');
  });
});

// ── getUnanswered ──────────────────────────────────────────────────

describe('getUnanswered', () => {
  it('returns pending questions', async () => {
    __seed('ProductQuestions', [
      { _id: 'q1', status: 'pending', productId: 'p1', question: 'Q1?', memberName: 'User' },
      { _id: 'q2', status: 'answered', productId: 'p1', question: 'Q2?' },
    ]);
    const r = await mod.getUnanswered();
    expect(r.success).toBe(true);
    expect(r.data.questions.length).toBe(1);
    expect(r.data.questions[0]._id).toBe('q1');
  });

  it('returns empty when no pending', async () => {
    const r = await mod.getUnanswered();
    expect(r.success).toBe(true);
    expect(r.data.questions).toHaveLength(0);
  });

  it('respects pagination', async () => {
    const r = await mod.getUnanswered({ page: 2, pageSize: 5 });
    expect(r.data.page).toBe(2);
    expect(r.data.pageSize).toBe(5);
  });
});

// ── getQASchema ────────────────────────────────────────────────────

describe('getQASchema', () => {
  it('rejects invalid product ID', async () => {
    const r = await mod.getQASchema(null);
    expect(r.success).toBe(false);
  });

  it('returns null schema when no answered questions', async () => {
    const r = await mod.getQASchema('prod1');
    expect(r.success).toBe(true);
    expect(r.data.schema).toBeNull();
  });

  it('returns FAQ schema for answered questions', async () => {
    __seed('ProductQuestions', [
      { _id: 'q1', productId: 'prod1', question: 'Is it comfortable?', answer: 'Very comfortable!', status: 'answered', helpfulVotes: 5 },
    ]);
    const r = await mod.getQASchema('prod1');
    expect(r.success).toBe(true);
    expect(r.data.schema['@type']).toBe('FAQPage');
    expect(r.data.schema.mainEntity).toHaveLength(1);
    expect(r.data.schema.mainEntity[0].name).toBe('Is it comfortable?');
    expect(r.data.schema.mainEntity[0].acceptedAnswer.text).toBe('Very comfortable!');
    expect(r.data.questionCount).toBe(1);
  });

  it('excludes non-answered questions from schema', async () => {
    __seed('ProductQuestions', [
      { _id: 'q1', productId: 'prod1', question: 'Q1?', answer: 'A1', status: 'answered', helpfulVotes: 1 },
      { _id: 'q2', productId: 'prod1', question: 'Q2?', status: 'pending', helpfulVotes: 0 },
    ]);
    const r = await mod.getQASchema('prod1');
    expect(r.data.schema.mainEntity).toHaveLength(1);
  });
});
