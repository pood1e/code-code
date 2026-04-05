import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    include: ['test/**/*.test.ts'],
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    // Run each test file serially since they share the same NestJS app instance
    fileParallelism: false,
    sequence: {
      setupFiles: 'list'
    }
  },
  plugins: [
    // SWC supports emitDecoratorMetadata which is required by NestJS DI
    swc.vite()
  ]
});
