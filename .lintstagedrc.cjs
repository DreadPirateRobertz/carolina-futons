/** @type {import('lint-staged').Config} */
module.exports = {
  '*.{js,ts}': [
    // eslint --fix auto-stages corrected files; --max-warnings=0 treats warnings as errors
    'eslint --fix --max-warnings=0',
    // Function form prevents lint-staged from appending staged filenames
    // as positional args — vitest --changed must run standalone.
    () => 'vitest run --changed --passWithNoTests',
  ],
};
