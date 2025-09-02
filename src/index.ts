import { test as uiTest, expect as uiExpect } from './fixtures/ui.js';
import { test as dbTest, expect as dbExpect } from './fixtures/db.js';

// Re-export with original names
export { uiTest as test, uiExpect as expect };
export { dbTest, dbExpect };

// UI namespace export
export const ui = { test: uiTest, expect: uiExpect } as const;

// DB namespace export
export const db = { test: dbTest, expect: dbExpect } as const;

// Commands
export { AdminApi } from './commands/adminApi.js';
export { AdminLogin } from './commands/adminLogin.js';
export { StorefrontApi } from './commands/storefrontApi.js';
export { Utility } from './commands/utility.js';

// global variables
export { default as variables } from './fixtures/variables.json' with { type: "json" };

// Types
export type { TestFixtures, SalesChannel } from './fixtures/ui.js';
export type { MyFixtures } from './fixtures/db.js';
