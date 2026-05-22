import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'types/**/*.ts',
        'lib/**/*.ts',
        'services/**/*.ts',
        'facades/**/*.ts',
      ],
      exclude: [
        'types/**/*.test.ts',
        'lib/**/*.test.ts',
        'services/index.ts',
        'facades/index.ts',
        'facades/errors.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        // L0 schema (types/): pure data definitions, phải đạt 100% tuyệt đối
        'types/**': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        // L1 logic (lib/): cho phép 95% để accommodate fail-fast sentinel paths
        // (zoneDiameter throw khi result non-finite, validateAll assert cuối)
        // Các paths này intentionally không thể trigger từ unit test bình thường
        // vì chúng chỉ fire khi có lỗi programming ở layer khác.
        'lib/**': {
          lines: 95,
          functions: 100,
          branches: 90,
          statements: 95,
        },
      },
    },
    // Chạy fuzz test với timeout đủ lớn (1000 samples fast-check)
    testTimeout: 60_000,
  },
});
