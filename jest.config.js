module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests/unit"],
  testRegex: ".*unit.test.ts",
  moduleFileExtensions: ["js", "ts", "node"],
  testResultsProcessor: "jest-sonar-reporter",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  coverageDirectory: "./coverage",
  collectCoverage: true,
  testURL: "http://localhost",
};
