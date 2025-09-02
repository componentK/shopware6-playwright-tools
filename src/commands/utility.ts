import type { Page } from '@playwright/test';

class Utility {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async closeBanner() {
    await this.page.addLocatorHandler(
      this.page.locator('.mt-banner__close'),
      async loc => {
        await loc.click({ timeout: 2000 });
      }
    );
  }

  async closeDevToolbar(): Promise<void> {
    await this.page.getByRole('button', { name: 'Close Toolbar' }).click({ timeout: 1000 }).catch(() => {});
  }
}

export { Utility }
