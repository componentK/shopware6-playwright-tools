import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface StorefrontApiOptions {
  headers?: Record<string, string>;
  multipart?: Record<string, any>;
}

class StorefrontApi {
  private readonly request: APIRequestContext;
  private accessKey: string;

  constructor(request: APIRequestContext) {
    this.request = request;
    this.accessKey = '';
  }

  setAccessKey(accessKey: string): void {
    this.accessKey = accessKey;
  }

  private async _request(
    method: 'post' | 'get' | 'delete' | 'patch', 
    url: string, 
    payload?: unknown, 
    options: StorefrontApiOptions = {}
  ): Promise<APIResponse> {
    const headers: Record<string, string> = {
      'sw-access-key': this.accessKey,
      'Accept': 'application/json',
      ...options.headers
    };

    const requestOptions: any = { headers };

    // Handle multipart data
    if (options.multipart) {
      requestOptions.multipart = options.multipart;
      // Don't set Content-Type for multipart - let Playwright handle it
    } else if (method === 'post' || method === 'patch' || (method === 'delete' && payload)) {
      headers['Content-Type'] = 'application/json';
      if (payload) {
        requestOptions.data = payload;
      }
    }

    const resp = await this.request[method](`/store-api${url}`, requestOptions);

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

  async post(endpoint: string, payload?: unknown, options: StorefrontApiOptions = {}): Promise<APIResponse> {
    return await this._request('post', endpoint, payload, options);
  }

  async get(endpoint: string, options: StorefrontApiOptions = {}): Promise<APIResponse> {
    return await this._request('get', endpoint, undefined, options);
  }

  async del(endpoint: string, payload?: unknown, options: StorefrontApiOptions = {}): Promise<APIResponse> {
    return await this._request('delete', endpoint, payload, options);
  }

  async patch(endpoint: string, payload?: unknown, options: StorefrontApiOptions = {}): Promise<APIResponse> {
    return await this._request('patch', endpoint, payload, options);
  }
}

export { StorefrontApi }
