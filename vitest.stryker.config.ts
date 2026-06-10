import { defineConfig } from 'vitest/config';

// Vitest config stripped-down cho Stryker - không có coverage thresholds
// Stryker tự quản lý test execution, không cần coverage provider
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // Stryker sẽ inject mutants, không cần coverage
    // Bỏ include filter để Stryker tự detect test files
    testTimeout: 60_000,
  },
});
