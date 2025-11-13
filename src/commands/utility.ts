import type { Page } from '@playwright/test';

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
}

export { Utility }
