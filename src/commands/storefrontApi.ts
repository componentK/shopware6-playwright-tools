import type { APIRequestContext } from '@playwright/test';

class StorefrontApi {
  private readonly request: APIRequestContext;
  private accessKey: string;

  constructor(request: APIRequestContext) {
    this.request = request;
    // Default access key - can be overridden
    this.accessKey = 'SWSCTGVQEG8XDTBUV3BZQLY2QG';
  }

  setAccessKey(accessKey: string) {
    this.accessKey = accessKey;
  }

  private async _request(method: 'post' | 'get' | 'delete' | 'patch', url: string, payload?: unknown, options: { headers?: Record<string, string> } = {}): Promise<any> {
    const headers: Record<string, string> = {
      'sw-access-key': this.accessKey,
      'Accept': 'application/json',
      ...options.headers
    };

    if (method === 'post' || method === 'patch' || (method === 'delete' && payload)) {
      headers['Content-Type'] = 'application/json';
    }

    const requestOptions: any = { headers };
    if (payload) {
      requestOptions.data = payload;
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

  async post(endpoint: string, payload: unknown, options: { headers?: Record<string, string> } = {}): Promise<any> {
    return await this._request('post', endpoint, payload, options);
  }

  async get(endpoint: string, options: { headers?: Record<string, string> } = {}): Promise<any> {
    return await this._request('get', endpoint, undefined, options);
  }

  async del(endpoint: string, payload?: unknown, options: { headers?: Record<string, string> } = {}): Promise<any> {
    return await this._request('delete', endpoint, payload, options);
  }

  async patch(endpoint: string, payload: unknown, options: { headers?: Record<string, string> } = {}): Promise<any> {
    return await this._request('patch', endpoint, payload, options);
  }
}

export { StorefrontApi }
