module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['node_mdules', 'build'],
  collectCoverage: true,
  coverageDirectory: 'coverage'
};