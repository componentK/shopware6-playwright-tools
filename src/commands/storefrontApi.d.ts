import type { APIRequestContext } from '@playwright/test';

declare class StorefrontApi {
  private readonly request: APIRequestContext;
  private accessKey: string;

  constructor(request: APIRequestContext);
  setAccessKey(accessKey: string): void;

  private _request(method: 'post' | 'get' | 'delete' | 'patch', url: string, payload?: unknown, options?: { headers?: Record<string, string>; multipart?: Record<string, any> }): Promise<any>;

  post(endpoint: string, payload?: unknown, options?: { headers?: Record<string, string>; multipart?: Record<string, any> }): Promise<any>;
  get(endpoint: string, options?: { headers?: Record<string, string> }): Promise<any>;
  del(endpoint: string, payload?: unknown, options?: { headers?: Record<string, string> }): Promise<any>;
  patch(endpoint: string, payload?: unknown, options?: { headers?: Record<string, string>; multipart?: Record<string, any> }): Promise<any>;
}

export { StorefrontApi };
