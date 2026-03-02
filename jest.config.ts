import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Points to the Next.js app root so next/jest can read next.config.ts and .env files
  dir: './',
});

const customJestConfig: Config = {
  testEnvironment: 'jest-environment-jsdom',

  // Runs after the test framework (jest-jasmine2/jest-circus) is installed
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Path alias mirrors tsconfig.json: "@/*" -> "./app/*"
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/app/$1',
  },

  // Only find tests inside __tests__/
  testMatch: ['<rootDir>/__tests__/**/*.(test|spec).(ts|tsx)'],

  // Coverage only from source files (not generated code)
  collectCoverageFrom: [
    'app/lib/utils.ts',
    'app/lib/permissions.ts',
    'app/lib/definitions.ts',
    'app/lib/services/apiService.ts',
    'app/lib/queries/clients.ts',
    'app/lib/queries/brands.ts',
    'app/lib/queries/managers.ts',
    'app/lib/queries/users.ts',
    'app/hooks/useGetItems.ts',
    'app/hooks/useItemsMutation.tsx',
  ],

  // Allow SWC to transform lucide-react (ESM-only package)
  transformIgnorePatterns: [
    '/node_modules/(?!(lucide-react)/)',
  ],
};

export default createJestConfig(customJestConfig);
