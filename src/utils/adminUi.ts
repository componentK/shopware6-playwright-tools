import {expect, type Locator, type Page} from '@playwright/test';

const ADMIN_NAV_TIMEOUT = 30_000;
const ADMIN_READY_TIMEOUT = 25_000;
const ADMIN_VIEW_TIMEOUT = 20_000;

/** Customer detail root (`sw-page` root is a real `div`; class also appears on inner regions — keep both for stability). */
function customerDetailPageRoot(page: Page) {
    return page.locator('div.sw-page.sw-customer-detail');
}

/** Flow list page root. */
function flowListPageRoot(page: Page) {
    return page.locator('.sw-flow-list');
}

async function bootAdminDesktop(page: Page): Promise<void> {
    await page.goto('/admin', {waitUntil: 'load', timeout: ADMIN_NAV_TIMEOUT});
    await expect
        .poll(
            async () => {
                const desktopCount = await page.locator('.sw-desktop').count();
                if (desktopCount > 0) {
                    return 'legacy-desktop';
                }

                const menuCount = await page.locator('.sw-admin-menu').count();
                if (menuCount > 0) {
                    return 'admin-shell';
                }

                return 'pending';
            },
            {timeout: ADMIN_READY_TIMEOUT, message: 'Expected Shopware administration shell to be available'},
        )
        .not.toBe('pending');
}

type ShopwarePush =
    | { name: string; params?: Record<string, string>; query?: Record<string, string> }
    | { path: string; query?: Record<string, string> };

/** Customer list content wrapper — stable across Shopware versions (grid or empty state). */
function customerListContentRoot(page: Page) {
    return page.locator('.sw-customer-list__content');
}

/** Hash navigation — avoids flaky `page.evaluate` router access after login redirects. */
export async function gotoAdminHash(page: Page, hashRoute: string): Promise<void> {
    const normalized = hashRoute.startsWith('/') ? hashRoute : `/${hashRoute}`;

    if (!page.url().includes('/admin')) {
        await bootAdminDesktop(page);
    } else {
        await expectAdministrationShell(page);
    }

    await page.goto(`/admin#${normalized}`, {
        waitUntil: 'domcontentloaded',
        timeout: ADMIN_NAV_TIMEOUT,
    });
}

async function isShopwareAdminRouterReady(page: Page): Promise<boolean> {
    try {
        return await page.evaluate(() => {
            const win = window as unknown as {
                Shopware?: { Application?: { view?: { router?: { push?: unknown } } } };
            };
            return Boolean(win.Shopware?.Application?.view?.router?.push);
        });
    } catch {
        return false;
    }
}

async function waitForShopwareAdminRouter(page: Page): Promise<void> {
    await expect
        .poll(async () => isShopwareAdminRouterReady(page), {
            timeout: ADMIN_READY_TIMEOUT,
            message: 'Expected Shopware.Application.view.router to be available',
        })
        .toBe(true);
}

/** Fallback for routes where cold hash links render an empty shell (role detail). */
async function shopwareApplicationRouterPush(page: Page, location: ShopwarePush): Promise<void> {
    await expectAdministrationShell(page);
    await waitForShopwareAdminRouter(page);

    await expect
        .poll(
            async () => {
                try {
                    await page.evaluate(async (loc) => {
                        type R = { push: (x: object) => Promise<unknown> };
                        const win = window as unknown as { Shopware?: { Application?: { view?: { router?: R } } } };
                        const router = win.Shopware?.Application?.view?.router;
                        if (!router?.push) {
                            throw new Error('Shopware.Application.view.router is not available');
                        }
                        await router.push(loc as object);
                    }, location);
                    return true;
                } catch {
                    return false;
                }
            },
            {
                timeout: ADMIN_NAV_TIMEOUT,
                message: `Expected Shopware router navigation to ${JSON.stringify(location)}`,
            },
        )
        .toBe(true);
}

/** Left administration menu — stable readiness signal (works when sidebar labels differ or load slowly). */
export async function expectAdministrationShell(page: Page): Promise<void> {
    await expect(page.locator('.sw-admin-menu')).toBeVisible({timeout: ADMIN_READY_TIMEOUT});
}

export async function gotoCustomerIndexReady(page: Page, indexHashParams = ''): Promise<void> {
    const suffix =
        indexHashParams === '' ? '' : indexHashParams.startsWith('?') ? indexHashParams : `?${indexHashParams}`;

    await gotoAdminHash(page, `/sw/customer/index${suffix}`);

    await page.waitForURL((url) => url.hash.includes('/customer/index'), {timeout: ADMIN_NAV_TIMEOUT});
    await expectAdministrationShell(page);
    await expect(customerListContentRoot(page)).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
    await expect(
        page.locator('.sw-customer-list-grid, .sw-customer-list__content .mt-empty-state').first(),
    ).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
}

/** Demo customer (Max Mustermann) — search so the row is found on populated shops. */
export async function gotoCustomerIndexWithDemoCustomer(page: Page): Promise<void> {
    await gotoCustomerIndexReady(page, 'term=Mustermann&limit=25&page=1');
    await expect(page.getByText('Mustermann, Max')).toBeVisible({timeout: 15000});
}

export async function gotoFlowIndexReady(page: Page, indexHashParams = ''): Promise<void> {
    const suffix =
        indexHashParams === '' ? '' : indexHashParams.startsWith('?') ? indexHashParams : `?${indexHashParams}`;

    await gotoAdminHash(page, `/sw/flow/index/flows${suffix}`);

    await page.waitForURL((url) => url.hash.includes('/flow/index'), {timeout: ADMIN_NAV_TIMEOUT});
    await expectAdministrationShell(page);
    await expect(flowListPageRoot(page)).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
    await expect(
        page.locator('.sw-flow-list__grid, .sw-flow-list__empty-state').first(),
    ).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
}

export function flowListRow(page: Page, name: string): Locator {
    return page.locator('.sw-data-grid__row').filter({hasText: name}).first();
}

/** General tab on customer detail (Account card — title is not always a semantic heading). */
export async function gotoCustomerDetailBase(page: Page, customerId: string): Promise<void> {
    const id = customerId.toLowerCase();
    await gotoAdminHash(page, `/sw/customer/detail/${id}/base`);
    await page.waitForURL((url) => url.hash.includes(`/customer/detail/${id}/`), {timeout: ADMIN_NAV_TIMEOUT});
    await expectAdministrationShell(page);
    await expect(customerDetailPageRoot(page)).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
    await expect(page.locator('.sw-customer-detail-base')).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
}

/** Documents tab route; waits for documents card. */
export async function gotoCustomerDocumentsTab(page: Page, customerId: string): Promise<void> {
    const id = customerId.toLowerCase();
    await gotoCustomerDetailBase(page, customerId);
    const tab = page.getByTestId('vdocs-tab');
    await expect(tab).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
    await tab.click();
    await page.waitForURL((url) => url.hash.includes(`/customer/detail/${id}/documents`), {timeout: ADMIN_NAV_TIMEOUT});
    await expect(page.getByTestId('vdocs-documents-card')).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
}

/**
 * Role editor “General” tab (plugin ACL labels). In 6.7+ this lives under Settings → System.
 * Cold deep-links can render an empty shell; boot `/admin` first. Role detail often uses `noNavigation` — do not wait on `.sw-admin-menu`.
 */
export async function gotoRolePermissionsGeneralTab(page: Page, roleId: string): Promise<void> {
    const id = roleId.toLowerCase();
    await bootAdminDesktop(page);
    await shopwareApplicationRouterPush(page, {name: 'sw.users.permissions.role.detail.general', params: {id}});
    await page.waitForURL((url) => url.hash.includes(`/role.detail/${id}/general`), {timeout: ADMIN_NAV_TIMEOUT});
    await expect(page.locator('div.sw-page.sw-users-permissions-role-detail')).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
    await expect(page.locator('.sw-users-permissions-role-view-general')).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
}

/** Poll until a freshly created customer row appears (indexing / grid refresh lag in CI). */
export async function waitForCustomerListRow(
    page: Page,
    displayName: string,
    email: string,
    timeout = 30_000,
): Promise<Locator> {
    const row = page.locator('tr').filter({hasText: displayName}).filter({hasText: email});
    let refreshCount = 0;

    await expect
        .poll(
            async () => {
                if (await row.count()) {
                    return (await row.first().isVisible()) ? 'visible' : 'pending';
                }

                if (refreshCount < 2) {
                    refreshCount++;
                    await page.reload({waitUntil: 'domcontentloaded'});
                    await expect(customerListContentRoot(page)).toBeVisible({timeout: ADMIN_VIEW_TIMEOUT});
                }

                return 'missing';
            },
            {timeout, message: `Expected customer list row for ${displayName} (${email})`},
        )
        .toBe('visible');

    return row.first();
}
