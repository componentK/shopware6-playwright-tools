import type { APIRequestContext } from '@playwright/test';

declare class AdminApi {
  private readonly request: APIRequestContext;
  private token: string | null;

  constructor(request: APIRequestContext);

  private _request(method: 'post' | 'delete' | 'patch' | 'get', url: string, payload?: unknown, options?: { auth?: boolean; multipart?: Record<string, any> }): Promise<any>;

  post(url: string, payload?: unknown, options?: { headers?: Record<string, string>; multipart?: Record<string, any> }): Promise<any>;
  patch(url: string, payload?: unknown, options?: { headers?: Record<string, string>; multipart?: Record<string, any> }): Promise<any>;
  del(url: string): Promise<any>;
  sync(payload: unknown): Promise<void>;
  get(url: string): Promise<any>;

  getToken(username?: string, password?: string): Promise<string>;
}

export { AdminApi };
