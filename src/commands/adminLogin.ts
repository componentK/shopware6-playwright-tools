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
    // Under parallel admin load the login form can take >5s to mount. Wait for either
    // the form or an already-authenticated shell before deciding.
    const loginForm = this.usernameInput;
    const shell = this.page.locator('.sw-admin-menu, .sw-desktop').first();
    await Promise.race([
      loginForm.waitFor({state: 'visible', timeout: 30_000}),
      shell.waitFor({state: 'visible', timeout: 30_000}),
    ]);

    if (await loginForm.isVisible().catch(() => false)) {
      await loginForm.fill(username);
      await this.passwordInput.fill(password);
      await this.submitButton.click();
    }

    await shell.waitFor({state: 'visible', timeout: 30_000});
  }
}

export { AdminLogin }
