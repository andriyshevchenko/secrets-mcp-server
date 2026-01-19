import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.test.js', 'node_modules/**', 'build/**', 'build-test/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'build/**',
        'build-test/**',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
      ],
    },
  },
});
