# @componentk/shopware6-playwright-tools

[![npm version](https://badge.fury.io/js/%40componentk%2Fshopware6-playwright-tools.svg)](https://badge.fury.io/js/%40componentk%2Fshopware6-playwright-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Playwright testing utilities specifically designed for Shopware 6 plugins. This package provides comprehensive testing tools for API testing, admin panel automation, storefront testing, and database operations.

## Features

- **Service Classes**: High-level APIs for common operations (flows, customers, cart, products, config, snippets, tags,
  orders, emails)
- **Automatic Cleanup**: Service classes handle test isolation and cleanup automatically
- **API Testing**: Complete Admin API and Storefront API clients with authentication (fallback for custom operations)
- **Admin Automation**: Automated admin panel login and interaction utilities
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
    test('API test example', async ({customerService, flowService, cartService}) => {
        // Use Service classes for common operations
        const customer = await customerService.registerCustomer();
        await flowService.createRule({name: 'Test Rule', priority: 1, conditions: []});
        const contextToken = await cartService.createNewCart();
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

### Service Classes (Recommended)

**Use Service classes as your primary approach** for interacting with Shopware. They provide:

- High-level, domain-specific APIs
- Automatic cleanup and test isolation
- Built-in error handling and validation
- Type-safe interfaces
- Consistent patterns across your tests

Service classes handle cleanup automatically after each test, ensuring test isolation. Only use raw API
calls (`adminApi`/`storefrontApi`) when you need to perform operations not covered by the Service classes.

#### CustomerService

Customer registration, login, and management:

```typescript
import {test, expect} from '@componentk/shopware6-playwright-tools';

test('Customer operations', async ({customerService}) => {
    // Register a new customer
    const customer = await customerService.registerCustomer({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
    });
    // Returns: { customerId, email, contextToken }

    // Clone existing customer
    const clonedId = await customerService.cloneMainCustomer({
        email: 'clone@example.com'
    });

    // Login customer
    const contextToken = await customerService.loginCustomer('test@example.com', 'password');

    // Cleanup is automatic after test
});
```

#### FlowService

Flow Builder rule and flow management:

```typescript
import { test, expect } from '@componentk/shopware6-playwright-tools';

test('Flow operations', async ({flowService}) => {
  // Create a rule
    const ruleId = await flowService.createRule({
        id: 'static-uuid-here',
    name: 'Test Rule',
    priority: 1,
    conditions: []
  });

    // Create a flow
    const flowId = await flowService.createFlow({
        id: 'flow-uuid-here',
        name: 'Test Flow',
        eventName: 'checkout.order.placed',
        priority: 1,
        active: true,
        sequences: [
            flowService.buildSequence('action.add.order.tag', {tagId: 'tag-123'})
        ]
    });

    // Cleanup is automatic after test (deletes flows, then rules)
});
```

#### CartService

Cart operations and order creation:

```typescript
import {test, expect, variables} from '@componentk/shopware6-playwright-tools';

test('Cart operations', async ({cartService, customerService}) => {
    // Register customer and get context token
    const customer = await customerService.registerCustomer();

    // Create new cart
    const contextToken = await cartService.createNewCart();

    // Add items to cart
    await cartService.addLineItems(contextToken, [{
        referencedId: variables.catalogProductMainId,
        quantity: 1,
        type: 'product'
    }]);

    // Get cart
    const cart = await cartService.getCart(contextToken);

    // Create order (with optional documents)
    const orderId = await cartService.createOrder(contextToken, {
        'document1': '/path/to/file.pdf'
    });

    // Cleanup is automatic after test
});
```

#### ProductService

Product cloning and management:

```typescript
import {test, expect, variables} from '@componentk/shopware6-playwright-tools';

test('Product operations', async ({productService}) => {
    // Clone a product
    const clonedProductId = await productService.cloneProduct(variables.catalogProductMainId, {
        id: 'static-product-uuid',
        name: 'Cloned Product',
        productNumber: 'CLONED-001'
    });

    // Cleanup is automatic after test
});
```

#### ConfigService

System configuration management with automatic restoration:

```typescript
import {test, expect} from '@componentk/shopware6-playwright-tools';

test('Config operations', async ({configService}) => {
    // Set config value (automatically restores original after test)
    await configService.setConfig('MyPlugin.config.key', {
        enabled: true,
        value: 'test'
    });

    // Install multiple config entries
    await configService.install([
        {
            configurationKey: 'MyPlugin.config.key1',
            configurationValue: {enabled: true}
        },
        {
            configurationKey: 'MyPlugin.config.key2',
            configurationValue: {enabled: false}
        }
    ]);

    // Original configs are automatically restored after test
});
```

#### SnippetService

Snippet creation and management:

```typescript
import {test, expect} from '@componentk/shopware6-playwright-tools';

test('Snippet operations', async ({snippetService}) => {
    // Create a snippet
    const snippetId = await snippetService.createSnippet(
        'MyPlugin.label.key',
        'Label Text',
        'en-GB'
    );

    // Cleanup is automatic after test
});
```

#### TagService

Tag creation and assignment:

```typescript
import {test, expect} from '@componentk/shopware6-playwright-tools';

test('Tag operations', async ({tagService, orderService}) => {
    // Create a tag
    const tagId = await tagService.createTag('Test Tag', 'static-tag-uuid');

    // Assign tag to order
    await tagService.assignTagToOrder('order-id', tagId);

    // Verify order has no specific tags
    await orderService.verifyOrderHasNoTags('order-id', [tagId]);

    // Cleanup is automatic after test
});
```

#### OrderService

Order operations and transaction management:

```typescript
import {test, expect} from '@componentk/shopware6-playwright-tools';

test('Order operations', async ({orderService}) => {
    // Get order tags
    const tags = await orderService.getOrderTags('order-id');

    // Verify order has no tags
    await orderService.verifyOrderHasNoTags('order-id', ['tag-id-1', 'tag-id-2']);

    // Get transaction IDs
    const transactionIds = await orderService.getOrderTransactionIds('order-id');

    // Transition transaction to remind state
    await orderService.transitionTransactionToRemind('transaction-id');
});
```

#### EmailService

Email testing utilities (supports Mailpit and Mailcatcher):

```typescript
import {test, expect} from '@componentk/shopware6-playwright-tools';

test('Email operations', async ({emailService}) => {
    // Wait for email by recipient
    const email = await emailService.waitForEmail('customer@example.com');

    // Wait for email with content match
    const email2 = await emailService.waitForEmail(undefined, 'Welcome to our store');

    // Wait for email with subject tokens
    const email3 = await emailService.waitForEmailWithSubjectTokens({
        recipient: 'customer@example.com',
        subjectTokens: ['Order', 'Confirmation'],
        timeoutMs: 5000
    });

    // Get emails by recipient
    const emails = await emailService.getEmailsByRecipient('customer@example.com');

    // Clear inbox
    await emailService.clearInbox();
});
```

### Fallback: Raw API Access

When you need to perform operations not covered by Service classes, use `adminApi` or `storefrontApi` directly:

#### AdminApi

Complete Admin API client with automatic authentication:

```typescript
import {test, expect} from '@componentk/shopware6-playwright-tools';

test('Custom admin operations', async ({adminApi}) => {
    // Only use when Service classes don't provide the needed functionality
    const response = await adminApi.get('/custom-endpoint');
  const data = await response.json();

    await adminApi.patch('/entity/123', {field: 'value'});
    await adminApi.del('/entity/123');

    // Sync operations for bulk operations
  await adminApi.sync({
      'create-entities': {
          entity: 'entity',
      action: 'upsert',
          payload: [entityData]
    }
  });
});
```

#### StorefrontApi

Storefront API client with access key management:

```typescript
import { test, expect } from '@componentk/shopware6-playwright-tools';

test('Custom storefront operations', async ({storefrontApi}) => {
    // Only use when Service classes don't provide the needed functionality
    const response = await storefrontApi.post('/custom-endpoint', {
        data: 'value'
  }, {
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
                                         // Service classes (recommended)
                                         customerService,
                                         cartService,
                                         flowService,
                                         productService,
                                         configService,
                                         snippetService,
                                         tagService,
                                         orderService,
                                         emailService,
                                         // Raw API clients (fallback only)
                                         adminApi,
                                         storefrontApi,
                                         // UI utilities
                                         adminLogin,
                                         utility
}) => {
    // Prefer Service classes over raw API calls
    const customer = await customerService.registerCustomer();
    const flowId = await flowService.createFlow(flowConfig);

    // Use raw API only for custom operations
    const customData = await adminApi.get('/custom-endpoint');
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

// Default sample product IDs
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

    test('should perform API operation', async ({
                                                    flowService,
                                                    customerService,
                                                    cartService
                                                }) => {
        // Use Service classes - cleanup is automatic
        const ruleId = await flowService.createRule(ruleData);
        const customer = await customerService.registerCustomer();
        const contextToken = await cartService.createNewCart();

        // Service classes handle cleanup automatically after test
  });

    test('custom operation not covered by Service classes', async ({adminApi}) => {
        // Only use raw API for operations not provided by Service classes
        const response = await adminApi.get('/custom-endpoint');
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

- 📖 [Documentation](https://github.com/componentK/shopware6-playwright-tools#readme)
- 🐛 [Issue Tracker](https://github.com/componentK/shopware6-playwright-tools/issues)
- 💬 [Discussions](https://github.com/componentK/shopware6-playwright-tools/discussions)

