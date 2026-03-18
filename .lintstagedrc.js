/** @type {import('lint-staged').Config} */
export default {
  '*.{js,ts}': [
    'eslint --fix',
    // Function form prevents lint-staged from appending staged filenames
    // as positional args — vitest --changed must run standalone.
    () => 'vitest run --changed --passWithNoTests',
  ],
};
