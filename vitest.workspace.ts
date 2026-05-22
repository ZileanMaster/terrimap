import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    // L0-L3: node environment (giữ nguyên như cũ)
    extends: './vitest.config.ts',
    test: {
      name: 'node',
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      exclude: ['src/**'],
    },
  },
  {
    // L4: jsdom environment cho React components
    extends: './vite.config.ts',
    test: {
      name: 'browser',
      environment: 'jsdom',
      include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
      setupFiles: ['src/test-setup.tsx'],
      globals: true,
    },
  },
])
