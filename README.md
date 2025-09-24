# @componentk/shopware6-playwright-tools

[![npm version](https://badge.fury.io/js/%40componentk%2Fshopware6-playwright-tools.svg)](https://badge.fury.io/js/%40componentk%2Fshopware6-playwright-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Playwright testing utilities specifically designed for Shopware 6 plugins. This package provides comprehensive testing tools for API testing, admin panel automation, storefront testing, and database operations.

## Features

- **API Testing**: Complete Admin API and Storefront API clients with authentication
- **Admin Automation**: Automated admin panel login and interaction utilities
- **Storefront Testing**: Storefront API client with context token management
- **Database Fixtures**: Direct database access for test data management
- **Utility Functions**: Common testing utilities and helpers
- **TypeScript Support**: Full TypeScript definitions included
- **Shopware 6 Optimized**: Built specifically for Shopware 6 testing patterns

## Installation

```bash
npm install @componentk/shopware6-playwright-tools
# or
yarn add @componentk/shopware6-playwright-tools
# or
pnpm add @componentk/shopware6-playwright-tools
```

## Quick Start

### Basic Setup

```typescript
import { test, expect, variables } from '@componentk/shopware6-playwright-tools';

test.describe('My Shopware Tests', () => {
  test('API test example', async ({ adminApi, storefrontApi }) => {
    // Your test code here
  });
});
```

### Default Configuration

The package comes with sensible defaults for Shopware 6 development environments:

- **Admin credentials**: `admin` / `shopware`
- **Database**: `localhost` / `shopware` / `shopware` / `shopware`
- **Client ID**: `administration`

These defaults work with standard Shopware 6 development setups and CI environments.

## TypeScript Support

The package provides comprehensive TypeScript definitions:

```typescript
import { 
  test, 
  expect, 
  variables,
  type TestFixtures,
  type AdminApiOptions,
  type StorefrontApiOptions 
} from '@componentk/shopware6-playwright-tools';

// All fixtures are properly typed
test('Typed test', async ({ adminApi, storefrontApi, page }: TestFixtures) => {
  // adminApi is typed as AdminApi
  // storefrontApi is typed as StorefrontApi  
  // page is typed as Page from Playwright
});
```

### Available Types

- `TestFixtures` - Main test fixtures interface
- `MyFixtures` - Database test fixtures interface
- `SalesChannel` - Sales channel data structure
- `AdminApiOptions` - Admin API request options
- `StorefrontApiOptions` - Storefront API request options

## API Reference

### AdminApi

Complete Admin API client with automatic authentication:

```typescript
import { test, expect } from '@componentk/shopware6-playwright-tools';

test('Admin API operations', async ({ adminApi }) => {
  // Create a rule
  const rule = await adminApi.post('/rule', {
    name: 'Test Rule',
    priority: 1,
    conditions: []
  });

  // Get data
  const response = await adminApi.get('/rule/123');
  const data = await response.json();

  // Update data
  await adminApi.patch('/rule/123', { name: 'Updated Rule' });

  // Delete data
  await adminApi.del('/rule/123');

  // Sync operations
  await adminApi.sync({
    'create-rules': {
      entity: 'rule',
      action: 'upsert',
      payload: [ruleData]
    }
  });
});
```

### StorefrontApi

Storefront API client with access key management:

```typescript
import { test, expect } from '@componentk/shopware6-playwright-tools';

test('Storefront API operations', async ({ storefrontApi }) => {
  // Login and get context token
  const loginResponse = await storefrontApi.post('/account/login', {
    username: 'customer@example.com',
    password: 'password'
  });
  const contextToken = loginResponse.headers()['sw-context-token'];

  // Add item to cart
  await storefrontApi.post('/checkout/cart/line-item', {
    items: [{
      referencedId: variables.catalogProductMainId,
      quantity: 1,
      type: 'product'
    }]
  }, {
    headers: { 'sw-context-token': contextToken }
  });

  // Get cart
  const cart = await storefrontApi.get('/checkout/cart', {
    headers: { 'sw-context-token': contextToken }
  });
});
```

### AdminLogin

Automated admin panel login:

```typescript
import { test, expect } from '@componentk/shopware6-playwright-tools';

test('Admin panel test', async ({ page, adminLogin }) => {
  await adminLogin.goto();
  await adminLogin.login(); // Uses default credentials (admin/shopware)
  
  // Or with custom credentials
  await adminLogin.login('custom_user', 'custom_password');
});
```

### Database Fixtures

Direct database access for test data management:

```typescript
import { dbTest, dbExpect } from '@componentk/shopware6-playwright-tools';

dbTest('Database operations', async ({ db }) => {
  // Execute raw SQL
  const [rows] = await db.execute('SELECT * FROM customer WHERE email = ?', ['test@example.com']);
  
  dbExpect(rows).toHaveLength(1);
});
```

### Utility Functions

Common testing utilities:

```typescript
import { test, expect } from '@componentk/shopware6-playwright-tools';

test('Utility functions', async ({ page, utility }) => {
  await utility.closeBanner();
  await utility.closeDevToolbar();
});
```

## Test Fixtures

The package provides several test fixtures that extend Playwright's base test:

### UI Test Fixture

```typescript
import { test, expect } from '@componentk/shopware6-playwright-tools';

test('UI test with fixtures', async ({ 
  page, 
  adminApi, 
  storefrontApi, 
  adminLogin, 
  utility 
}) => {
  // All fixtures are available
});
```

### Database Test Fixture

```typescript
import { dbTest, dbExpect } from '@componentk/shopware6-playwright-tools';

dbTest('Database test', async ({ db }) => {
  // Database operations
});
```

## Variables

Pre-defined test variables for common Shopware entities:

```typescript
import { variables } from '@componentk/shopware6-playwright-tools';

// Product IDs
variables.catalogProductMainId
variables.catalogProductFreeShip
variables.catalogProductAdvPricesId

// Customer IDs
variables.customerMainId
variables.customerGrpDefaultId

// Other entities
variables.catalogCategoryMen
variables.swClientId
variables.userEmail
```

## UUID Generation

Generate Shopware-compatible UUIDs for test data:

```bash
# Generate 15 UUIDs (default)
npm run uuid:generate

# Generate specific number
npm run uuid:generate -- -n 20
```

## Playwright Configuration

Example `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'api',
      testMatch: '**/*.api.spec.ts',
    },
    {
      name: 'admin-ui',
      testMatch: '**/*.admin.spec.ts',
    },
    {
      name: 'storefront-ui',
      testMatch: '**/*.storefront.spec.ts',
    },
  ],
});
```

## Advanced Usage

### Direct Class Instantiation

For advanced scenarios, you can instantiate the classes directly:

```typescript
import { AdminApi, StorefrontApi, AdminLogin, Utility } from '@componentk/shopware6-playwright-tools';

// Create API clients directly
const adminApi = new AdminApi(request);
const storefrontApi = new StorefrontApi(request);
storefrontApi.setAccessKey('your-access-key');

// Create utility classes
const adminLogin = new AdminLogin(page);
const utility = new Utility(page);
```

## Testing Patterns

### API Testing Pattern

```typescript
import { test, expect, variables } from '@componentk/shopware6-playwright-tools';

test.describe('API Tests', { tag: '@api' }, () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ adminApi }) => {
    // Setup test data
  });

  test.afterAll(async ({ adminApi }) => {
    // Cleanup test data
  });

  test.beforeEach(async ({ storefrontApi }) => {
    // Setup for each test
  });

  test('should perform API operation', async ({ storefrontApi }) => {
    // Test implementation
  });
});
```

### Admin UI Testing Pattern

```typescript
import { test, expect } from '@componentk/shopware6-playwright-tools';

test.describe('Admin UI Tests', { tag: '@admin' }, () => {
  test('should login to admin panel', async ({ page, adminLogin, utility }) => {
    await adminLogin.goto();
    await adminLogin.login();
    await utility.closeBanner();
    
    // Test admin functionality
  });
});
```

## Security Considerations

- **Credentials**: Never commit hardcoded credentials. Use environment variables.
- **Database Access**: Configure database credentials via environment variables.
- **API Keys**: Store sensitive API keys in environment variables.
- **Test Data**: Use test-specific data that can be safely deleted.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/componentk/ckou-playwright-tools#readme)
- 🐛 [Issue Tracker](https://github.com/componentk/ckou-playwright-tools/issues)
- 💬 [Discussions](https://github.com/componentk/ckou-playwright-tools/discussions)

