import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/helpers/setup.js'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    sequence: { concurrent: false },
    testTimeout: 15000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5433/studyplanner_test',
      TEST_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5433/studyplanner_test',
      SESSION_SECRET: 'test-secret-that-is-at-least-32-bytes-long-for-tests!!',
      SESSION_MAX_AGE: '2592000',
      PORT: '0',
      TRUST_PROXY: '0',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        'src/index.js',
        'src/db/migrate.js',
        'src/db/seed.js',
      ],
      thresholds: {
        lines: 85,
      },
    },
  },
});
