// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  mutate: ['lib/geometry.ts'],
  coverageAnalysis: 'off',
  thresholds: { high: 80, low: 60, break: 50 },
  reporters: ['html', 'clear-text', 'json'],
  jsonReporter: { fileName: 'reports/mutation-geometry.json' },
  vitest: {
    configFile: 'vitest.stryker.config.ts',
  },
  // Timeout cao vì fuzz tests chạy 1000 samples
  timeoutMS: 60000,
  timeoutFactor: 3,
  // Giảm concurrency để tránh OOM với nhiều test runners song song
  concurrency: 2,
};
