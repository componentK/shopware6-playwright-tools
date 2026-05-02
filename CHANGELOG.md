## Changelog

### 1.6.3

- Added `packageManager` (pnpm 10.23.0); fix CommonJS entry comment to `@componentk/shopware6-playwright-tools`.
- Changed `FlowSequence.trueCase` to be optional
- Changed `getCart(contextToken, options?)` to accept optional `headers` and `query` (query appended to `/checkout/cart`). 
Changed `addLineItems(contextToken, items, options?)` to accept optional extra `headers`; `sw-context-token` is always merged in.
- Changed npm publish workflow uses OIDC (`permissions.id-token: write`), Node 24, `pnpm/action-setup` without a separate pnpm version (uses `packageManager` from package.json only), and `pnpm publish` without `NPM_TOKEN` secret env.

### 1.6.2

- Added new method for banner dismissal as a test

### 1.6.1

- Reverted utility > banner closer logic (due to gitlab CI issues)

### 1.6.0

- Added devToolbar removal
- Added admin customer list filter reset

### 1.5.1

- Fixed configService install method not restoring original values

### 1.5.0

- Added cleanup for cart service
- Added product service
- Added system_config individual setter & restore
- Added Snippet service
- Fixed customer service cleanup
- Fixed flow cleanup to remove flows before rules

### 1.4.0

- Added Service classes to help with common CRUD API calls
- Added email (mailcatcher & mailcatcher) listener and parser
- Added config service to set up system_config entries

### 1.3.0

- Removed AdminApi multi-key storage capabilities
- Removed unnecessary "user-verified" scope post and delete calls, use `withCredentials` instead

### 1.2.0
- Added multi-request possibility
- Added token caching per scope
- Fixed errors to be returned instead of thrown

### 1.1.0

- Added support for user-verified token generation
- Adjusted banner closing logic
- Adjusted waiting logic after admin login

### 1.0.0
- Initial release
- Admin API client with authentication
- Storefront API client with context management
- Database fixtures for direct DB access
- Admin login automation
- Utility functions for common tasks
- TypeScript definitions
- Comprehensive test fixtures
