// Mock for wix-blog-backend
// Simulates the Wix Blog backend API (posts.listPosts, posts.getPost).

let _posts = [];
let _total = 0;
let _listError = null;
let _getError = null;

function makePaging(items, offset) {
  return {
    metaData: { count: items.length, offset, total: _total },
  };
}

export const posts = {
  /** listPosts({ paging: { limit, offset }, filter, sort, fieldsets }) */
  listPosts: async ({ paging = {} } = {}) => {
    if (_listError) throw _listError;
    const limit = paging.limit ?? 10;
    const offset = paging.offset ?? 0;
    const page = _posts.slice(offset, offset + limit);
    return {
      posts: page,
      ...makePaging(page, offset),
    };
  },

  /** getPost(postId, { fieldsets }) */
  getPost: async (postId) => {
    if (_getError) throw _getError;
    const found = _posts.find(p => p._id === postId || p.slug === postId);
    if (!found) throw Object.assign(new Error('Post not found'), { code: 404 });
    return { post: found };
  },
};

/** Seed posts. All are treated as published (status filtering is done in impl). */
export function __setPosts(items) {
  _posts = items;
  _total = items.length;
}

/** Set total independently of seeded items (for testing pagination metadata). */
export function __setTotal(n) {
  _total = n;
}

/** Make the next listPosts call throw. */
export function __setListError(err) {
  _listError = err;
}

/** Make the next getPost call throw. */
export function __setGetError(err) {
  _getError = err;
}

export function __reset() {
  _posts = [];
  _total = 0;
  _listError = null;
  _getError = null;
}
