module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/backend/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/db/schema.sql',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
};
