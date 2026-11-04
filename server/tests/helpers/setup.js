'use strict';
// This file is loaded by vitest setupFiles before each test file.
// Env vars are already set via vitest.config.mjs env property.
// We run migrations once using globalSetup instead, to avoid re-running
// for every test file. The DB cleanup happens in each test file's beforeEach.
// Nothing needed here currently; placeholder for global test setup.
