import type {Locator, Page} from '@playwright/test';

/**
 * Shopware admin `user_config` / `/_info/config-me` key for the one-time 2026 UI-shell
 * announcement modal (`sw-ui-shell-update-2026-modal`). Value shape: `{ seen: true }`.
 *
 * Prefer {@link AdminApi.markUiShellUpdate2026Seen} so the modal never opens.
 *
 * @see vendor/.../sw-ui-shell-update-2026-modal/index.ts `UI_SHELL_UPDATE_2026_SEEN_CONFIG_KEY`
 */
export const UI_SHELL_UPDATE_2026_SEEN_CONFIG_KEY = 'core.uiShellUpdate2026ModalSeen';

/**
 * Dockware/dev admin overlays that intercept clicks: Symfony profiler bar and Shopware
 * leave-guard. Does **not** handle the UI-shell update modal — seed
 * {@link UI_SHELL_UPDATE_2026_SEEN_CONFIG_KEY} via Admin API instead.
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

/** Customer detail smart-bar Edit — avoids matching user-menu labels that contain “Edit(or)”. */
export function customerDetailEditButton(page: Page): Locator {
    return page.locator('button.sw-customer-detail__open-edit-mode-action').first();
}

/**
 * Customer list bulk-edit control in the list content (not the admin user-menu toggle
 * whose accessible name can also start with “Bulk Edit”).
 */
export function customerListBulkEditAction(page: Page): Locator {
    return page
        .locator('.sw-customer-list, .sw-customer-list__content')
        .getByRole('button', {name: 'Bulk edit', exact: true})
        .or(
            page
                .locator('.sw-customer-list, .sw-customer-list__content')
                .getByRole('link', {name: 'Bulk edit', exact: true}),
        )
        .first();
}
