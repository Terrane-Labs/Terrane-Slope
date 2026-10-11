import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@terrane-labs/domain': path.resolve(__dirname, '../domain/src/index.ts'),
      '@terrane-labs/geometry': path.resolve(__dirname, '../geometry/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});
