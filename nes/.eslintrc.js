module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'plugin:react/recommended',
    'airbnb',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    'react',
    '@typescript-eslint',
  ],
  ignorePatterns: [
    '**/*.js',
    '**/*.test.ts'
  ],
  rules: {
    'no-bitwise': 0,
    'no-console': 0,
    'indent': [2, 4],
    'no-underscore-dangle': 0,
    'no-plusplus': 0,
    'import/prefer-default-export': 0 
  },
};
