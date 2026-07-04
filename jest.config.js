/**
 * Unit tests target pure logic (nutrition math, unit normalization, AI schema
 * validation), so they run in a plain Node environment with the Expo Babel
 * preset — no React Native runtime required. If component tests are added
 * later, create a second Jest project using the full `jest-expo` preset.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
