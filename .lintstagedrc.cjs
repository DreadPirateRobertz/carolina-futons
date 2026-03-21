/** @type {import('lint-staged').Config} */
module.exports = {
  '*.{js,ts}': (stagedFiles) => {
    // packages/ has its own TypeScript ESLint config — exclude from root lint.
    const rootFiles = stagedFiles.filter((f) => !f.includes('/packages/'));
    if (rootFiles.length === 0) return [];
    // eslint --fix auto-stages corrected files; --max-warnings=0 treats warnings as errors
    return `eslint --fix --max-warnings=0 ${rootFiles.map((f) => `"${f}"`).join(' ')}`;
  },
  // vitest --changed must run standalone (no filenames appended as args)
  '*.{js,ts,tsx}': () => 'vitest run --changed --passWithNoTests',
};
