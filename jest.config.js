module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  maxWorkers: 1,
  workerIdleMemoryLimit: '512MB',
  testTimeout: 30000,
  resetModules: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/database/migrations/*.ts',
    '!src/routes/monitor.routes.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'json-summary', 'lcov', 'html'],
  transformIgnorePatterns: [
    'node_modules/(?!(puppeteer|puppeteer-core|@puppeteer|exceljs)/)',
  ],
  moduleNameMapper: {
    '^puppeteer$': '<rootDir>/tests/__mocks__/puppeteer.js',
  },
  setupFiles: ['<rootDir>/tests/setup-before-env.js'],
  globalSetup: '<rootDir>/tests/global-setup.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
