// CommonJS entry point for @componentk/playwright-tools
const ui = require('./dist/fixtures/ui.js');
const db = require('./dist/fixtures/db.js');
const adminApi = require('./dist/commands/adminApi.js');
const adminLogin = require('./dist/commands/adminLogin.js');
const storefrontApi = require('./dist/commands/storefrontApi.js');
const utility = require('./dist/commands/utility.js');
const variables = require('./src/fixtures/variables.json');

module.exports = {
  test: ui.test,
  expect: ui.expect,
  dbTest: db.test,
  dbExpect: db.expect,
  AdminApi: adminApi.AdminApi,
  AdminLogin: adminLogin.AdminLogin,
  StorefrontApi: storefrontApi.StorefrontApi,
  Utility: utility.Utility,
  variables
};
