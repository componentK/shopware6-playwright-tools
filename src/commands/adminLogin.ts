import { Locator, Page, expect } from '@playwright/test';

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

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    // necessary check to avoid issues with locationHandler
    await expect(this.page.locator('.sw-usage-data-consent-banner__content-headline')).toBeVisible({ timeout: 10000 });
  }
}

export { AdminLogin }
