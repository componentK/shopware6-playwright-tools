import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface AdminApiOptions {
  auth?: boolean;
  multipart?: Record<string, any>;
  headers?: Record<string, string>;
}

class AdminApi {
  private readonly request: APIRequestContext;
  private token: string | null = null;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  private async _request(
    method: 'post' | 'delete' | 'patch' | 'get', 
    url: string, 
    payload?: unknown, 
    options: AdminApiOptions = {}
  ): Promise<APIResponse> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const requestOptions: any = { headers };

    // Handle multipart data
    if (options.multipart) {
      requestOptions.multipart = options.multipart;
      // Don't set Content-Type for multipart - let Playwright handle it
    } else {
      headers['Content-Type'] = 'application/json';
      if (payload) {
        requestOptions.data = payload;
      }
    }

    if (options.auth !== false) {
      headers.Authorization = `Bearer ${await this.getToken()}`;
    }

    const resp = await this.request[method](`/api${url}`, requestOptions);

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

    const resp = await this._request('post', '/oauth/token', payload, { auth: false });
    const data = await resp.json();

    if (!data || !data.access_token) {
      throw new Error('Failed to retrieve access token.');
    }

    this.token = data.access_token;
    return data.access_token;
  }

  async post(url: string, payload?: unknown, options: AdminApiOptions = {}): Promise<APIResponse> {
    return await this._request('post', url, payload, { ...options, auth: true });
  }

  async patch(url: string, payload?: unknown, options: AdminApiOptions = {}): Promise<APIResponse> {
    return await this._request('patch', url, payload, { ...options, auth: true });
  }

  async del(url: string): Promise<APIResponse> {
    return await this._request('delete', url, undefined, { auth: true });
  }

  async sync(payload: unknown): Promise<void> {
    await this.post('/_action/sync', payload);
  }

  async get(url: string): Promise<APIResponse> {
    return await this._request('get', url, undefined, { auth: true });
  }
}

export { AdminApi }

