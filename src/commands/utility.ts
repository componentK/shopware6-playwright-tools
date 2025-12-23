import type {Page} from '@playwright/test';

class Utility {
    private readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async closeBanner() {
        const cancelButton = this.page.getByRole('banner').getByRole('button', {name: 'Cancel'});
        await cancelButton.click({timeout: 3000, force: true}).catch(() => {
        });
    }

    async closeDevToolbar(): Promise<void> {
        await this.page.locator('button.sf-toolbar-toggle-button [title="Close Toolbar"]').click({timeout: 3000}).catch(() => {
        });
    }

    // more reliable way to remove the dev toolbar at the bottom of the page
    async removeDevToolbar(): Promise<void> {
        await this.page.locator('div.sf-toolbar').evaluate(
            node => node.remove()
        );
    }

    // Dismiss any notification banners that might be blocking interactions
    async dismissNotificationBanner(): Promise<void> {
        try {
            // Wait for notifications container to be visible (if any notifications exist)
            const notificationsContainer = this.page.locator('.sw-notifications');
            const isVisible = await notificationsContainer.isVisible({timeout: 1000}).catch(() => false);

            if (!isVisible) {
                return; // No notifications to dismiss
            }

            // Find all closable notification banners
            const notifications = notificationsContainer.locator('.mt-banner--closable');
            const count = await notifications.count();

            // Close each notification by clicking its close button
            for (let i = count - 1; i >= 0; i--) {
                const notification = notifications.nth(i);
                // Try multiple selectors for the close button
                const closeButton = notification.locator('.mt-banner__close, button[aria-label*="close" i], button[title*="close" i]').first();
                await closeButton.click({timeout: 1000}).catch(() => {
                    // Notification might have auto-dismissed or doesn't have a close button
                });
            }

            // Wait for notifications to fully disappear
            await this.page.waitForTimeout(300);
        } catch (error) {
            // Silently fail if there are no notifications or they can't be dismissed
        }
    }
}

export {Utility}
