# Playwright API Test Development Guide

## 1. Overview

This guide documents the process and conventions for creating Playwright API end-to-end tests for Shopware 6 plugins. The tests are designed to validate Shopware's Flow Builder functionality, focusing on custom rules, events, and actions.

The core principle is to simulate API interactions that trigger Flow Builder events and verify that the configured actions are executed correctly based on the rules applied to the cart or customer state.

## 2. Folder Structure

A strict, hierarchical folder structure is used to organize tests clearly and predictably. The structure directly reflects the event, action, rule, and rule container being tested.

The root directory for these tests is `tests/playwright/api/`.

```
tests/playwright/api/
└── e:<event-name>/
    └── a:<action-name>/
        └── r:<rule-name>/
            └── rc:<container-name>/
                └── <test-case-name>/
                    ├── <test-case-name>.spec.ts
                    ├── rule.json
                    └── flow.json
```

-   `e:<event-name>`: The Shopware event that triggers the flow. The name used here must match the `eventName` in the `flow.json` file.
-   `a:<action-name>`: The action executed by the flow. The name corresponds to the `actionName` in `flow.json`.
-   `r:<rule-name>`: The custom rule being tested (e.g., `r:ckAcfLineItemPayload`).
-   `rc:<container-name>`: **Crucially**, this level specifies the rule container that wraps the core condition. The container determines which line items the rule is applied to.
    -   `rc:changed`: Uses `ckChangedLineItemContainer`. The rule applies only to the line item being added or changed.
    -   `rc:removed`: Uses `ckRemovedLineItemContainer`. The rule applies only to the line item being removed.
    -   `rc:all`: Uses `allLineItemsContainer`. The rule requires **all** line items in the cart to match the condition.
    -   `rc:any`: No specific container is used. The rule is a direct child of the `andContainer`. The flow triggers if **at least one** line item in the cart matches the condition.
-   `<test-case-name>`: A descriptive name for the specific scenario being tested (e.g., `boolean-match`, `number-gte`).

## 3. Fixture Files (`rule.json` & `flow.json`)

Each test case has its own `rule.json` and `flow.json`. These files contain the exact JSON payloads used to create the necessary entities via the Admin API before the test runs.

### 3.1. UUID Generation

**All `id` and `parentId` fields in these files MUST be valid, unique UUIDs.** Using placeholder strings, duplicate UUIDs, or self-referencing `parentId`s will cause API errors.

To generate valid UUIDs, use the provided script as documented in `uuid-generation.mdc`. Just search the project for the file.

From the `tests` directory, run:
```bash
# Generate a specific number of UUIDs (e.g., 8)
pnpm run uuid:generate -- -n 8
```

### 3.2. Structure and Content

The structure of these files is strict and must be followed precisely.
Copy existing rule/flow.json payloads, and do not modify without permission "keys" in the payload. Only change values.

-   **`rule.json`**:
    -   The conditions must be nested within an `orContainer` -> `andContainer` structure.
    -   The specific rule container (e.g., `allLineItemsContainer`) is nested within the `andContainer`.
    -   The actual rule condition (e.g., `ckAcfLineItemPayload`) is a child of the rule container.
-   **`flow.json`**:
    -   The `eventName` must match a valid event name.
    -   The `sequences` array connects the rule to the action.
    -   The action sequence must have a `parentId` pointing to the rule sequence's `id`.
    -   The `trueCase` property must be a **boolean** (`true` or `false`), not an integer. It should only be present on action sequences, not rule sequences.
    -   **Action `config`**: The `config: {}` object for each action is highly specific. Its keys and values must be exact. The best practice is to copy the `config` from a working test that uses the same action. If an action is new, trace its Vue component via `custom/plugins/AdvFlowEvents/src/Resources/app/administration/src/decorator/flow-builder-service-decoration.js` to determine the correct data structure.

## 4. Test Spec Files (`*.spec.ts`)

### 4.1. Setup and Teardown

-   **`test.beforeAll`**: This hook is responsible for setting up the test environment.
    1.  **Cleanup**: It's critical to first attempt to delete the rule and flow using their IDs. This prevents `InsertCommand` errors from previous failed test runs. Use `.catch(() => {})` to ignore errors if the entities don't exist.
    2.  **Creation**: Create the rule and then the flow using `adminApi.post`.
-   **`test.afterAll`**: This hook cleans up by deleting the flow and rule created for the test.
-   **`test.beforeEach`**: For `e:cart-loaded` events, it's critical to create the cart **before** creating the flow and rule. This prevents the flow from being triggered immediately upon creation, which would add items to the cart before the test logic runs. For other events, create a new guest cart and extracts the `sw-context-token`. This ensures each test runs with an isolated cart.
-   **`test.afterEach`**: Deletes the guest cart created in `beforeEach`.

### 4.2. Test Logic and Assertions

-   **Asynchronous Flow Execution**: A key learning is that Flow Builder actions are often asynchronous. The API response from the triggering action (e.g., `POST /checkout/cart/line-item`) may not contain the final cart state. **Always perform a subsequent `GET /checkout/cart`** to fetch the updated state before making assertions.
-   **Helper Functions**: Use the `hasActionItems` helper function to consistently check for the presence and count of action-added line items.
-   **Product IDs**: Do not create products during tests. Use existing product UUIDs from `custom/plugins/AdvFlowEvents/tests/fixtures/variables.json`.

### 4.3. Example Test Snippet (`any` container logic)
```typescript
test('should add product every time a valid item is updated', async ({ storefrontApi }) => {
  // Add initial item with valid payload, which should immediately trigger the action
  let cart = await storefrontApi.post('/checkout/cart/line-item', {
    items: [{ referencedId: mainProductId, quantity: 1, type: 'product', payload: { my_date: '2025-01-01T12:00:00+00:00' } }]
  }, { headers: { 'sw-context-token': contextToken } }).then(resp => resp.json())

  // Assert that the initial POST triggered the action
  expect(cart.lineItems).toHaveLength(2) // Main item + 1 action item
  await hasActionItems(cart, actionProductId, 1)

  // First PATCH update should trigger another action
  let mainLineItem = cart.lineItems.find((item: any) => item.referencedId === mainProductId)
  await storefrontApi.patch('/checkout/cart/line-item', {
    items: [{ id: mainLineItem.id, quantity: 2 }]
  }, { headers: { 'sw-context-token': contextToken } })

  // Re-fetch the cart and assert the new state
  cart = await storefrontApi.get('/checkout/cart', { headers: { 'sw-context-token': contextToken } }).then(resp => resp.json())
  expect(cart.lineItems).toHaveLength(3) // Main item + 2 action items
  await hasActionItems(cart, actionProductId, 2)
})
```

## 5. Running Tests

Tests are run from within the `custom/plugins/AdvFlowEvents/tests` directory.

```bash
# Run all API tests
pnpm run e2e:api

# Run a specific test file
pnpm run e2e:api -- playwright/api/e:cart-changed/a:add-product/r:ckAcfLineItemPayload/rc:any/datetime-match/datetime-match.spec.ts
```

## 6. Key Context Files

For accurate test creation, always refer to these files:

-   **Event Names**: `custom/plugins/AdvFlowEvents/tests/.cursor/rules/flow-events.mdc`
-   **Action Names**: `custom/plugins/AdvFlowEvents/tests/.cursor/rules/flow-actions.mdc`
-   **UUID Generation**: `custom/plugins/AdvFlowEvents/.cursor/rules/playwright/uuid-generation.mdc`
-   **Product IDs**: `custom/plugins/AdvFlowEvents/tests/fixtures/variables.json`
