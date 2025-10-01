import type { Page } from '@playwright/test';

class Utility {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async closeBanner() {
    await this.page.addLocatorHandler(
      this.page.getByRole('banner').getByRole('button', { name: 'Cancel' }),
      async loc => {
          try {
              // Wait for element to be stable before clicking
              await loc.waitFor({state: 'visible', timeout: 1000});
              await loc.click({timeout: 2000, force: true});
          } catch (error) {
              // If banner is already gone or unstable, ignore the error
              // This prevents the handler from interfering with other interactions
          }
      }
    );
  }

  async closeDevToolbar(): Promise<void> {
    await this.page.getByRole('button', { name: 'Close Toolbar' }).click({ timeout: 3000 }).catch(() => {});
  }
}

export { Utility }
