import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@geokinematics/domain': path.resolve(__dirname, '../domain/src/index.ts'),
      '@geokinematics/geometry': path.resolve(__dirname, '../geometry/src/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
