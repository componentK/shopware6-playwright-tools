import {Locator, Page} from '@playwright/test';

class AdminLogin {
  private readonly page: Page;
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('[name="sw-field--username"]');
    this.passwordInput = page.locator('[name="sw-field--password"]');
    this.submitButton = page.getByRole('button', { name: 'Log in' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin');
  }

  async login(username: string = 'admin', password: string = 'shopware'): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
      // Wait for navigation to complete (either dashboard or banner)
      await this.page.waitForURL(/.*dashboard|.*banner/, {timeout: 15000});
  }
}

export { AdminLogin }
