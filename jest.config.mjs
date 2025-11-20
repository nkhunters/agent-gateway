/** @type {import('jest').Config} */
export default {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest/presets/default-esm',

  // Set test environment to Node.js
  testEnvironment: 'node',

  // ESM configuration
  extensionsToTreatAsEsm: ['.ts'],

  // Root directory for tests
  roots: ['<rootDir>/tests', '<rootDir>/src'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/index.ts'
  ],

  // Coverage thresholds (optional, can be adjusted as project grows)
  // coverageThreshold: {
  //   global: {
  //     branches: 70,
  //     functions: 70,
  //     lines: 70,
  //     statements: 70
  //   }
  // },

  // Coverage directory
  coverageDirectory: 'coverage',

  // Max workers (set to 1 for compatibility with Node v18.13.0)
  maxWorkers: 1,

  // Transform configuration for ts-jest with ESM support
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        // Inline tsconfig options for Jest with ESM
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
        moduleResolution: 'node',
        module: 'ES2020'
      },
      diagnostics: {
        // Ignore warning about hybrid module kind
        ignoreCodes: [151002]
      }
    }]
  },

  // Module name mapper for ESM compatibility
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Clear mocks between tests
  clearMocks: true,

  // Automatically restore mocks between tests
  restoreMocks: true,

  // Verbose output
  verbose: true

  // Setup files to run before tests
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
