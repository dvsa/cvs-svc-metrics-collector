module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: [
        "<rootDir>/src",
        "<rootDir>/tests/unit",
        "<rootDir>/tests/int"
    ],
    testRegex: ".*unit\.test\.ts",
    moduleFileExtensions: ["js", "ts"],
    testResultsProcessor: "jest-sonar-reporter",
    transform: {
        "^.+\\.ts$": "ts-jest"
    },
    coverageDirectory: "./coverage",
    collectCoverage: true,
    testURL: "http://localhost"
};
