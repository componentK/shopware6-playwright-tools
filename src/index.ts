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

// Services
export {CustomerService} from './services/CustomerService.js';
export {CartService} from './services/CartService.js';
export {OrderService} from './services/OrderService.js';
export {TagService} from './services/TagService.js';
export {FlowService} from './services/FlowService.js';
export {EmailService} from './services/EmailService.js';
export {ConfigService} from './services/ConfigService.js';

// Types
export type { TestFixtures, SalesChannel } from './fixtures/ui.js';
export type { MyFixtures } from './fixtures/db.js';
export type { AdminApiOptions } from './commands/adminApi.js';
export type { StorefrontApiOptions } from './commands/storefrontApi.js';
export type {CustomerRegistrationOptions, CustomerRegistrationResult} from './services/CustomerService.js';
export type {CartLineItem} from './services/CartService.js';
export type {OrderCreationOptions} from './services/OrderService.js';
export type {FlowConfig, FlowSequence} from './services/FlowService.js';
export type {SystemConfigEntry} from './services/ConfigService.js';
