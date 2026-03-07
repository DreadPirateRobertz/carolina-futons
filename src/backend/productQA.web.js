/**
 * @module productQA
 * @description Product Q&A system for product pages. Customers ask questions,
 * admins answer, community votes on helpfulness. Drives SEO via FAQ schema
 * and conversion by answering pre-purchase objections.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `ProductQuestions` with fields:
 *   productId (Text, indexed) - Product ID
 *   memberId (Text, indexed) - Question author
 *   memberName (Text) - Display name
 *   question (Text) - The question text
 *   answer (Text) - Admin answer (null if unanswered)
 *   answeredBy (Text) - Admin who answered
 *   answeredAt (Date) - When answered
 *   helpfulVotes (Number) - Count of helpful votes
 *   voters (Text) - JSON array of member IDs who voted
 *   status (Text, indexed) - 'pending'|'answered'|'flagged'|'hidden'
 *   flagCount (Number) - Number of flags
 *   flaggedBy (Text) - JSON array of member IDs who flagged
 *   _createdDate (Date) - Auto
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const MAX_QUESTION_LENGTH = 500;
const MAX_ANSWER_LENGTH = 2000;
const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const FLAG_THRESHOLD = 3; // auto-hide after this many flags
const VALID_STATUSES = ['pending', 'answered', 'flagged', 'hidden'];

// ── Helpers ──────────────────────────────────────────────────────────

async function getMember() {
  try {
    return await currentMember.getMember();
  } catch {
    return null;
  }
}

function safeParse(json) {
  try { return JSON.parse(json); } catch { return []; }
}

// ── submitQuestion ───────────────────────────────────────────────────

/**
 * Submits a new question about a product.
 * @param {string} productId - Product ID
 * @param {string} questionText - The question
 */
export const submitQuestion = webMethod(Permissions.SiteMember, async (productId, questionText) => {
  try {
    if (!validateId(productId)) return { success: false, error: 'Invalid product ID' };

    const question = sanitize(questionText, MAX_QUESTION_LENGTH);
    if (!question || question.length < 10) {
      return { success: false, error: 'Question must be at least 10 characters' };
    }

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    // Rate limit: max 5 questions per product per member
    const existingCount = await wixData.query('ProductQuestions')
      .eq('productId', productId)
      .eq('memberId', member._id)
      .count();

    if (existingCount >= 5) {
      return { success: false, error: 'Maximum 5 questions per product' };
    }

    const memberName = member.contactDetails?.firstName
      ? `${member.contactDetails.firstName} ${(member.contactDetails.lastName || '').charAt(0)}.`
      : 'Customer';

    const inserted = await wixData.insert('ProductQuestions', {
      productId,
      memberId: member._id,
      memberName: sanitize(memberName, 50),
      question,
      answer: null,
      answeredBy: null,
      answeredAt: null,
      helpfulVotes: 0,
      voters: '[]',
      status: 'pending',
      flagCount: 0,
      flaggedBy: '[]',
    });

    return { success: true, data: { _id: inserted._id, question } };
  } catch (err) {
    return { success: false, error: 'Failed to submit question' };
  }
});

// ── answerQuestion ───────────────────────────────────────────────────

/**
 * Admin answers a question.
 * @param {string} questionId - Question ID
 * @param {string} answerText - The answer
 */
export const answerQuestion = webMethod(Permissions.Admin, async (questionId, answerText) => {
  try {
    if (!validateId(questionId)) return { success: false, error: 'Invalid question ID' };

    const answer = sanitize(answerText, MAX_ANSWER_LENGTH);
    if (!answer || answer.length < 5) {
      return { success: false, error: 'Answer must be at least 5 characters' };
    }

    const question = await wixData.get('ProductQuestions', questionId);
    if (!question) return { success: false, error: 'Question not found' };

    await wixData.update('ProductQuestions', {
      ...question,
      answer,
      answeredBy: 'Carolina Futons',
      answeredAt: new Date(),
      status: 'answered',
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to answer question' };
  }
});

// ── getProductQuestions ───────────────────────────────────────────────

/**
 * Returns paginated Q&A for a product. Public-facing.
 * @param {string} productId - Product ID
 * @param {Object} opts - { page, pageSize, answeredOnly, searchText }
 * @param {string} [opts.searchText] - Filter questions containing this text (sanitized, case-insensitive)
 */
export const getProductQuestions = webMethod(Permissions.Anyone, async (productId, opts = {}) => {
  try {
    if (!productId || typeof productId !== 'string') {
      return { success: false, error: 'Invalid product ID' };
    }

    const cleanProductId = sanitize(productId, 50);
    const page = Math.max(1, Math.round(Number(opts.page) || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.round(Number(opts.pageSize) || PAGE_SIZE)));

    let query = wixData.query('ProductQuestions')
      .eq('productId', cleanProductId)
      .ne('status', 'hidden');

    if (opts.answeredOnly) {
      query = query.eq('status', 'answered');
    }

    // Text search in question field
    if (opts.searchText && typeof opts.searchText === 'string') {
      const searchTerm = sanitize(opts.searchText, 100).toLowerCase();
      if (searchTerm) {
        query = query.contains('question', searchTerm);
      }
    }

    query = query.descending('helpfulVotes')
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    const result = await query.find();

    const questions = result.items.map(q => ({
      _id: q._id,
      question: q.question,
      answer: q.answer,
      memberName: q.memberName,
      answeredBy: q.answeredBy,
      answeredAt: q.answeredAt,
      helpfulVotes: q.helpfulVotes || 0,
      status: q.status,
      createdDate: q._createdDate,
    }));

    return {
      success: true,
      data: {
        questions,
        page,
        pageSize,
        totalCount: result.totalCount,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load questions' };
  }
});

// ── voteHelpful ──────────────────────────────────────────────────────

/**
 * Votes a question/answer as helpful. One vote per member.
 * @param {string} questionId - Question ID
 */
export const voteHelpful = webMethod(Permissions.SiteMember, async (questionId) => {
  try {
    if (!validateId(questionId)) return { success: false, error: 'Invalid question ID' };

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const question = await wixData.get('ProductQuestions', questionId);
    if (!question) return { success: false, error: 'Question not found' };

    const voters = safeParse(question.voters);
    if (voters.includes(member._id)) {
      return { success: false, error: 'Already voted' };
    }

    voters.push(member._id);

    await wixData.update('ProductQuestions', {
      ...question,
      helpfulVotes: (question.helpfulVotes || 0) + 1,
      voters: JSON.stringify(voters),
    });

    return { success: true, data: { helpfulVotes: (question.helpfulVotes || 0) + 1 } };
  } catch (err) {
    return { success: false, error: 'Failed to vote' };
  }
});

// ── flagQuestion ─────────────────────────────────────────────────────

/**
 * Flags a question as inappropriate. Auto-hides after threshold.
 * @param {string} questionId - Question ID
 */
export const flagQuestion = webMethod(Permissions.SiteMember, async (questionId) => {
  try {
    if (!validateId(questionId)) return { success: false, error: 'Invalid question ID' };

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const question = await wixData.get('ProductQuestions', questionId);
    if (!question) return { success: false, error: 'Question not found' };

    const flaggedBy = safeParse(question.flaggedBy);
    if (flaggedBy.includes(member._id)) {
      return { success: false, error: 'Already flagged' };
    }

    flaggedBy.push(member._id);
    const newFlagCount = (question.flagCount || 0) + 1;
    const newStatus = newFlagCount >= FLAG_THRESHOLD ? 'hidden' : question.status;

    await wixData.update('ProductQuestions', {
      ...question,
      flagCount: newFlagCount,
      flaggedBy: JSON.stringify(flaggedBy),
      status: newStatus,
    });

    return { success: true, data: { flagCount: newFlagCount, hidden: newStatus === 'hidden' } };
  } catch (err) {
    return { success: false, error: 'Failed to flag question' };
  }
});

// ── getUnanswered ────────────────────────────────────────────────────

/**
 * Returns unanswered questions for admin review.
 * @param {Object} opts - { page, pageSize }
 */
export const getUnanswered = webMethod(Permissions.Admin, async (opts = {}) => {
  try {
    const page = Math.max(1, Math.round(Number(opts.page) || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.round(Number(opts.pageSize) || PAGE_SIZE)));

    const result = await wixData.query('ProductQuestions')
      .eq('status', 'pending')
      .ascending('_createdDate')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .find();

    return {
      success: true,
      data: {
        questions: result.items.map(q => ({
          _id: q._id,
          productId: q.productId,
          question: q.question,
          memberName: q.memberName,
          flagCount: q.flagCount || 0,
          createdDate: q._createdDate,
        })),
        page,
        pageSize,
        totalCount: result.totalCount,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load unanswered questions' };
  }
});

// ── getQASchema ──────────────────────────────────────────────────────

/**
 * Generates FAQ structured data (JSON-LD) for answered questions.
 * @param {string} productId - Product ID
 */
export const getQASchema = webMethod(Permissions.Anyone, async (productId) => {
  try {
    if (!productId || typeof productId !== 'string') {
      return { success: false, error: 'Invalid product ID' };
    }

    const result = await wixData.query('ProductQuestions')
      .eq('productId', sanitize(productId, 50))
      .eq('status', 'answered')
      .descending('helpfulVotes')
      .limit(20)
      .find();

    if (result.items.length === 0) {
      return { success: true, data: { schema: null } };
    }

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: result.items.map(q => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: q.answer,
        },
      })),
    };

    return { success: true, data: { schema, questionCount: result.items.length } };
  } catch (err) {
    return { success: false, error: 'Failed to generate schema' };
  }
});
