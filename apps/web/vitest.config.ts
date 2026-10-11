import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@terrane-labs/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
      '@terrane-labs/geometry': path.resolve(__dirname, '../../packages/geometry/src/index.ts'),
      '@terrane-labs/kinematics': path.resolve(__dirname, '../../packages/kinematics/src/index.ts'),
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
