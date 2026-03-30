import { describe, it, expect } from 'vitest';

const { getQuizQuestions, getRecommendation } = await import('../src/backend/styleQuizService.web.js');

// ── getQuizQuestions ──────────────────────────────────────────────────────────

describe('getQuizQuestions', () => {
  it('returns an array of exactly 5 questions', async () => {
    const questions = await getQuizQuestions();
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(5);
  });

  it('question ids are q1 through q5', async () => {
    const questions = await getQuizQuestions();
    const ids = questions.map(q => q.id);
    expect(ids).toEqual(['q1', 'q2', 'q3', 'q4', 'q5']);
  });

  it('each question has id, text, and options array', async () => {
    const questions = await getQuizQuestions();
    for (const q of questions) {
      expect(typeof q.id).toBe('string');
      expect(typeof q.text).toBe('string');
      expect(q.text.length).toBeGreaterThan(0);
      expect(Array.isArray(q.options)).toBe(true);
    }
  });

  it('each option has a string value and label', async () => {
    const questions = await getQuizQuestions();
    for (const q of questions) {
      for (const opt of q.options) {
        expect(typeof opt.value).toBe('string');
        expect(typeof opt.label).toBe('string');
        expect(opt.value.length).toBeGreaterThan(0);
        expect(opt.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('each question has at least 3 options', async () => {
    const questions = await getQuizQuestions();
    for (const q of questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('option values within each question are unique', async () => {
    const questions = await getQuizQuestions();
    for (const q of questions) {
      const values = q.options.map(o => o.value);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    }
  });

  it('questions cover room size', async () => {
    const questions = await getQuizQuestions();
    const texts = questions.map(q => q.text.toLowerCase());
    const coversRoomSize = texts.some(t => t.includes('room') || t.includes('space') || t.includes('size'));
    expect(coversRoomSize).toBe(true);
  });

  it('questions cover budget', async () => {
    const questions = await getQuizQuestions();
    const texts = questions.map(q => q.text.toLowerCase());
    const coversBudget = texts.some(t => t.includes('budget') || t.includes('spend') || t.includes('price'));
    expect(coversBudget).toBe(true);
  });

  it('questions cover usage (sleep/lounge)', async () => {
    const questions = await getQuizQuestions();
    const allText = questions.map(q =>
      [q.text, ...q.options.map(o => o.label)].join(' ').toLowerCase()
    ).join(' ');
    const coversUsage = allText.includes('sleep') || allText.includes('lounge') || allText.includes('sit');
    expect(coversUsage).toBe(true);
  });

  it('questions cover aesthetic preference', async () => {
    const questions = await getQuizQuestions();
    const allText = questions.map(q =>
      [q.text, ...q.options.map(o => o.label)].join(' ').toLowerCase()
    ).join(' ');
    const coversAesthetic = allText.includes('modern') || allText.includes('style') || allText.includes('rustic');
    expect(coversAesthetic).toBe(true);
  });

  it('questions cover firmness preference', async () => {
    const questions = await getQuizQuestions();
    const allText = questions.map(q =>
      [q.text, ...q.options.map(o => o.label)].join(' ').toLowerCase()
    ).join(' ');
    const coversFirmness = allText.includes('firm') || allText.includes('soft') || allText.includes('comfort');
    expect(coversFirmness).toBe(true);
  });
});

// ── getRecommendation ─────────────────────────────────────────────────────────

describe('getRecommendation', () => {
  const validAnswers = { q1: 'medium', q2: 'mid-range', q3: 'both', q4: 'modern', q5: 'medium' };

  it('returns productId, productName, reason, and score for valid answers', async () => {
    const result = await getRecommendation(validAnswers);
    expect(typeof result.productId).toBe('string');
    expect(typeof result.productName).toBe('string');
    expect(typeof result.reason).toBe('string');
    expect(typeof result.score).toBe('number');
  });

  it('score is a positive number', async () => {
    const result = await getRecommendation(validAnswers);
    expect(result.score).toBeGreaterThan(0);
  });

  it('productId and productName are non-empty strings', async () => {
    const result = await getRecommendation(validAnswers);
    expect(result.productId.length).toBeGreaterThan(0);
    expect(result.productName.length).toBeGreaterThan(0);
  });

  it('reason is a non-empty string', async () => {
    const result = await getRecommendation(validAnswers);
    expect(result.reason.length).toBeGreaterThan(0);
  });

  // Edge case: all first options
  it('all-first-options returns a valid recommendation', async () => {
    const allFirst = { q1: 'small', q2: 'budget', q3: 'sleep', q4: 'modern', q5: 'soft' };
    const result = await getRecommendation(allFirst);
    expect(result).toHaveProperty('productId');
    expect(result.score).toBeGreaterThan(0);
  });

  // Edge case: all last options
  it('all-last-options returns a valid recommendation', async () => {
    const allLast = { q1: 'large', q2: 'luxury', q3: 'lounge', q4: 'eclectic', q5: 'firm' };
    const result = await getRecommendation(allLast);
    expect(result).toHaveProperty('productId');
    expect(result.score).toBeGreaterThan(0);
  });

  // Missing answers
  it('returns error:missing_answers when answers is null', async () => {
    const result = await getRecommendation(null);
    expect(result.error).toBe('missing_answers');
  });

  it('returns error:missing_answers when answers is undefined', async () => {
    const result = await getRecommendation(undefined);
    expect(result.error).toBe('missing_answers');
  });

  it('returns error:missing_answers when answers is empty object', async () => {
    const result = await getRecommendation({});
    expect(result.error).toBe('missing_answers');
  });

  it('returns error:missing_answers when answers is missing required keys', async () => {
    const result = await getRecommendation({ q1: 'small', q2: 'budget' });
    expect(result.error).toBe('missing_answers');
  });

  it('returns error:missing_answers when answers is a non-object', async () => {
    const result = await getRecommendation('small|budget|sleep|modern|soft');
    expect(result.error).toBe('missing_answers');
  });

  it('returns error:missing_answers when answers is an array', async () => {
    const result = await getRecommendation(['small', 'budget', 'sleep', 'modern', 'soft']);
    expect(result.error).toBe('missing_answers');
  });

  // Tie-breaking: same input always → same output
  it('is deterministic — identical answers always return same product', async () => {
    const answers = { q1: 'medium', q2: 'mid-range', q3: 'both', q4: 'classic', q5: 'medium' };
    const r1 = await getRecommendation(answers);
    const r2 = await getRecommendation(answers);
    expect(r1.productId).toBe(r2.productId);
    expect(r1.score).toBe(r2.score);
  });

  // Different answer profiles lead to different top products
  it('sleep-focused large-room luxury profile returns a different product than budget small-room', async () => {
    const luxurySleeper = { q1: 'large', q2: 'luxury', q3: 'sleep', q4: 'rustic', q5: 'firm' };
    const budgetLounge = { q1: 'small', q2: 'budget', q3: 'lounge', q4: 'eclectic', q5: 'soft' };
    const r1 = await getRecommendation(luxurySleeper);
    const r2 = await getRecommendation(budgetLounge);
    expect(r1.productId).not.toBe(r2.productId);
  });

  // Murphy cab bed wins for small-room + premium + sleep
  it('small room + premium + sleep preference scores murphy cabinet bed highest', async () => {
    const answers = { q1: 'small', q2: 'premium', q3: 'sleep', q4: 'modern', q5: 'firm' };
    const result = await getRecommendation(answers);
    expect(result.productId).toBe('murphy-cabinet-bed-queen');
  });

  // Platform bed wins for large-room + luxury + sleep + rustic + firm
  it('large room + luxury + sleep + rustic + firm scores platform bed highest', async () => {
    const answers = { q1: 'large', q2: 'luxury', q3: 'sleep', q4: 'rustic', q5: 'firm' };
    const result = await getRecommendation(answers);
    expect(result.productId).toBe('platform-bed-queen');
  });

  // Unknown answer values fall back gracefully (zero score for unknown)
  it('unknown answer values do not throw — returns a product', async () => {
    const weirdAnswers = { q1: 'castle', q2: 'free', q3: 'never', q4: 'vibes', q5: 'yes' };
    const result = await getRecommendation(weirdAnswers);
    expect(result).toHaveProperty('productId');
    expect(result).not.toHaveProperty('error');
  });
});
