import {expect, type Page} from '@playwright/test';
import {gotoAdminHash} from './adminUi.js';

/**
 * Dockware/dev admin often keeps the Symfony profiler bar; it intercepts clicks on rule fields.
 * Also dismisses Shopware's leave-guard modal when Escape/hash churn raised it.
 */
export async function neutralizeAdminOverlays(page: Page): Promise<void> {
    await page
        .addStyleTag({
            content: [
                '.sf-toolbar, .sf-minitoolbar, .sf-toolbarreset { pointer-events: none !important; opacity: 0 !important; }',
                '.sw-notifications { pointer-events: none !important; }',
            ].join(' '),
        })
        .catch(() => undefined);

    const discard = page.getByRole('button', {name: /^Discard changes$/});
    if (await discard.isVisible().catch(() => false)) {
        await discard.click().catch(() => undefined);
    }
    const keep = page.getByRole('button', {name: /^Keep editing$/});
    if (await keep.isVisible().catch(() => false)) {
        await keep.click().catch(() => undefined);
    }
}

/** Open Rule Builder create view and wait for the condition tree. */
export async function openRuleCreate(page: Page): Promise<void> {
    const save = page.getByRole('button', {name: /^Save$/});
    const tree = page.locator('.sw-condition-tree');

    for (let attempt = 0; attempt < 2; attempt++) {
        await gotoAdminHash(page, '/sw/settings/rule/create/base');
        await neutralizeAdminOverlays(page);

        await page.locator('.sw-notifications .mt-banner__close').first().click({timeout: 1500}).catch(() => undefined);

        const ready = await save.isVisible().catch(() => false);
        if (ready) {
            break;
        }
        if (attempt === 0) {
            await page.reload({waitUntil: 'domcontentloaded'});
        }
    }

    await neutralizeAdminOverlays(page);
    await expect(save).toBeVisible({timeout: 30000});
    await expect(tree).toBeVisible({timeout: 15000});
}

export type FillRuleBasicsOptions = {
    /** Priority field value (default `100`). */
    priority?: string;
    /**
     * When true (default), select Type → Flow Builder if the Type combobox is present.
     * Scoped to `.sw-select-result-list__content` so Automation nav is not clicked.
     */
    selectFlowBuilderType?: boolean;
};

/** Fill Name / Priority and optionally set Type to Flow Builder. */
export async function fillRuleBasics(
    page: Page,
    name: string,
    options: FillRuleBasicsOptions = {},
): Promise<void> {
    const priorityValue = options.priority ?? '100';
    const selectFlowBuilderType = options.selectFlowBuilderType !== false;

    await neutralizeAdminOverlays(page);
    await page.getByRole('textbox', {name: 'Name'}).fill(name);

    // 6.7.15 labels Priority without a trailing "*"; keep a loose match.
    const priority = page.getByRole('textbox', {name: /^Priority/});
    await priority.fill(priorityValue);

    if (!selectFlowBuilderType) {
        return;
    }

    const typeCombobox = page.getByRole('combobox', {name: 'Type'});
    if (!(await typeCombobox.isVisible().catch(() => false))) {
        return;
    }

    await typeCombobox.click({force: true});
    // Do not use page.getByText('Flow Builder') — Automation nav has the same label and wins .first().
    const typeResults = page.locator('.sw-select-result-list__content').last();
    await expect(typeResults).toBeVisible({timeout: 10000});
    await typeResults.getByText('Flow Builder', {exact: true}).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.sw-popover__wrapper.sw-select-result-list-popover-wrapper')).toHaveCount(0, {
        timeout: 5000,
    }).catch(() => undefined);
}

/** Open the first condition type select in the tree (scroll + retry; avoid bare Escape). */
export async function openConditionTypeSelect(page: Page): Promise<void> {
    await neutralizeAdminOverlays(page);

    const results = page.locator('.sw-select-result-list__content').last();
    const tree = page.locator('.sw-condition-tree');
    const typeSelect = tree.locator('.sw-condition-type-select').first();
    const placeholder = page.getByPlaceholder('Please select a condition...');

    await typeSelect.scrollIntoViewIfNeeded();

    for (let attempt = 0; attempt < 3; attempt++) {
        await neutralizeAdminOverlays(page);
        const popoverCount = await page.locator('.sw-popover__wrapper.sw-select-result-list-popover-wrapper').count();
        if (popoverCount > 0) {
            await page.keyboard.press('Escape').catch(() => undefined);
            await neutralizeAdminOverlays(page);
        }

        if (await placeholder.isVisible().catch(() => false)) {
            await placeholder.click({force: true});
        } else {
            await typeSelect.locator('input').first().click({force: true});
        }
        if (await results.isVisible().catch(() => false)) {
            break;
        }
        await typeSelect.click({force: true});
        if (await results.isVisible().catch(() => false)) {
            break;
        }
        await page.waitForTimeout(250);
    }

    await expect(results).toBeVisible({timeout: 10000});
}

/** Select a condition by visible label; optionally assert a group label is present. */
export async function selectConditionByLabel(page: Page, label: string, groupLabel?: string): Promise<void> {
    await openConditionTypeSelect(page);
    const results = page.locator('.sw-select-result-list__content').last();
    await expect(results).toContainText(label);
    if (groupLabel) {
        await expect(results).toContainText(groupLabel);
    }
    await results.locator('li').filter({hasText: label}).first().click();
    await expect(page.locator('.sw-condition-tree')).toContainText(label, {timeout: 10000});
}

export async function selectOperator(page: Page, label: string): Promise<void> {
    const operatorSelect = page.locator('.sw-condition-tree .sw-condition-operator-select').first();
    await expect(operatorSelect).toBeVisible({timeout: 10000});
    await operatorSelect.click();
    const results = page.locator('.sw-select-result-list__content').last();
    await expect(results).toContainText(label);
    await results.locator('li').filter({hasText: label}).first().click();
}

export async function selectProductInCondition(page: Page, productName: string): Promise<void> {
    const entitySelect = page
        .locator('.sw-condition-tree .sw-entity-multi-id-select, .sw-condition-tree .sw-entity-multi-select')
        .first();
    await expect(entitySelect).toBeVisible({timeout: 10000});
    await entitySelect.click();
    const input = entitySelect.locator('input').first();
    await input.fill(productName);
    const results = page.locator('.sw-select-result-list__content').last();
    await expect(results.locator('li').filter({hasText: productName}).first()).toBeVisible({timeout: 15000});
    await results.locator('li').filter({hasText: productName}).first().click();
}

/** Click Save and assert a successful rule create/update API response; returns rule id. */
export async function saveRuleExpectSuccess(page: Page, track?: {id?: string}): Promise<string> {
    const responsePromise = page.waitForResponse(
        (response) => {
            const url = response.url();
            return (
                url.includes('/api/')
                && (url.includes('/rule') || url.endsWith('rule'))
                && ['POST', 'PATCH'].includes(response.request().method())
            );
        },
        {timeout: 30000},
    );

    await page.getByRole('button', {name: /^Save$/}).click();
    const response = await responsePromise;
    const status = response.status();
    const body = await response.text();
    expect(status, `Rule save failed (${status}): ${body}`).toBeGreaterThanOrEqual(200);
    expect(status, `Rule save failed (${status}): ${body}`).toBeLessThan(300);
    expect(body).not.toContain('is not allowed');
    expect(body).not.toContain('WRITE_CONSTRAINT_VIOLATION');

    let ruleId: string | undefined;
    try {
        const json = JSON.parse(body) as {data?: {id?: string} | Array<{id?: string}>};
        if (Array.isArray(json.data) && json.data[0]?.id) {
            ruleId = json.data[0].id;
        } else if (json.data && !Array.isArray(json.data) && json.data.id) {
            ruleId = json.data.id;
        }
    } catch {
        // fall through to URL
    }

    const urlMatch = page.url().match(/\/sw\/settings\/rule\/detail\/([^/?#]+)/);
    ruleId = ruleId ?? urlMatch?.[1];
    if (ruleId && track) {
        track.id = ruleId;
    }

    await expect.poll(() => page.url(), {timeout: 15000}).toMatch(/\/sw\/settings\/rule\/detail\/[^/]+/);
    const match = page.url().match(/\/sw\/settings\/rule\/detail\/([^/?#]+)/);
    ruleId = ruleId ?? match?.[1];
    if (ruleId && track) {
        track.id = ruleId;
    }
    expect(ruleId).toBeTruthy();
    return ruleId!;
}

type AdminApiLike = {
    sync: (payload: unknown) => Promise<{status: () => number; text: () => Promise<string>}>;
    post: (url: string, payload?: unknown) => Promise<{status: () => number; json: () => Promise<unknown>}>;
};

export async function deleteRule(adminApi: AdminApiLike, ruleId: string): Promise<void> {
    const response = await adminApi.sync({
        rule: {
            entity: 'rule',
            action: 'delete',
            payload: [{id: ruleId}],
        },
    });
    expect([200, 204]).toContain(response.status());
}

/** Delete rules by exact name (OR filter). Safe for parallel suites when names are unique. */
export async function deleteRulesByName(adminApi: AdminApiLike, ruleNames: readonly string[]): Promise<void> {
    if (ruleNames.length === 0) {
        return;
    }

    const search = await adminApi.post('/search/rule', {
        filter: [
            {
                type: 'multi',
                operator: 'or',
                queries: ruleNames.map((value) => ({type: 'equals', field: 'name', value})),
            },
        ],
        limit: 100,
    });
    expect(search.status()).toBe(200);
    const payload = (await search.json()) as {
        data?: Array<{id?: string; attributes?: {name?: string}; links?: {self?: string}}>;
    };
    const ids = (payload.data ?? [])
        .map((row) => {
            if (typeof row.id === 'string' && row.id.length > 0) {
                return row.id;
            }
            const self = row.links?.self;
            const match = self?.match(/\/rule\/([^/?#]+)/);
            return match?.[1];
        })
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (ids.length === 0) {
        return;
    }

    const response = await adminApi.sync({
        rule: {
            entity: 'rule',
            action: 'delete',
            payload: ids.map((id) => ({id})),
        },
    });
    expect([200, 204]).toContain(response.status());
}
