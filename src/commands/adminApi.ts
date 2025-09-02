import type { APIRequestContext } from '@playwright/test';

class AdminApi {
  private readonly request: APIRequestContext;
  private token: string | null = null;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  private async _request(method: 'post' | 'delete' | 'patch', url: string, payload?: unknown, auth = true): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (auth) {
      headers.Authorization = `Bearer ${await this.getToken()}`;
    }

    const options: any = { headers };
    if (payload) {
      options.data = payload;
    }

    const resp = await this.request[method](`/api${url}`, options);

    if (!resp.ok()) {
      let body: string;
      try {
        body = JSON.stringify(await resp.json());
      } catch {
        body = await resp.text();
      }
      throw new Error(`Request failed: ${resp.status()} ${body}`);
    }

    return resp;
  }

  async getToken(username = 'admin', password = 'shopware'): Promise<string> {
    if (this.token) return this.token;

    const payload = {
      client_id: 'administration',
      grant_type: 'password',
      scopes: 'write',
      username,
      password,
    };

    const resp = await this._request('post', '/oauth/token', payload, false);
    const data = await resp.json();

    if (!data || !data.access_token) {
      throw new Error('Failed to retrieve access token.');
    }

    this.token = data.access_token;
    return data.access_token;
  }

  async post(url: string, payload: unknown): Promise<any> {
    return await this._request('post', url, payload);
  }

  async patch(url: string, payload: unknown): Promise<any> {
    return await this._request('patch', url, payload);
  }

  async del(url: string): Promise<any> {
    return await this._request('delete', url);
  }

  async sync(payload: unknown): Promise<void> {
    await this.post('/_action/sync', payload);
  }
}

export { AdminApi }

