const config = require('./jest.config');
config.testRegex = '\\.int\\.ts';
console.info('Running Integration Tests');
module.exports = config;
