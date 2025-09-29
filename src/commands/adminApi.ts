import type {APIRequestContext, APIResponse} from '@playwright/test';
import variables from '../fixtures/variables.json' with {type: "json"};

export interface AdminApiOptions {
    auth?: boolean;
    multipart?: Record<string, any>;
    headers?: Record<string, string>;
    refreshToken?: boolean;  // Force new token generation, bypassing cache
    credentials?: {
        username?: string;
        password?: string;
        scope?: string;
    };
}

class AdminApi {
    private readonly request: APIRequestContext;
    private tokens?: Map<string, string>;
    private defaultCredentials?: {
        username?: string;
        password?: string;
        scope?: string;
    };

    constructor(request: APIRequestContext, defaultCredentials?: { username?: string; password?: string; scope?: string }) {
        this.request = request;
        this.defaultCredentials = defaultCredentials;
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

        // Merge custom headers if provided
        if (options.headers) {
            Object.assign(headers, options.headers);
        }

        const requestOptions: any = {headers};

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
            const username = options.credentials?.username || this.defaultCredentials?.username || variables.swAdmin;
            const password = options.credentials?.password || this.defaultCredentials?.password || variables.swPass;
            const scope = options.credentials?.scope || this.defaultCredentials?.scope || 'write';
            const refreshToken = options.refreshToken || false;

            headers.Authorization = `Bearer ${await this.getToken(username, password, scope, refreshToken)}`;
        }

        // Don't throw on error responses - let tests handle status codes
        return this.request[method](`/api${url}`, requestOptions);
    }

    async getToken(username = variables.swAdmin, password = variables.swPass, scope = 'write', refreshToken = false): Promise<string> {
        // Initialize tokens map if not exists
        if (!this.tokens) {
            this.tokens = new Map();
        }

        // Create composite cache key from username, password, and scope
        const cacheKey = `${username}:${password}:${scope}`;

        // Check if we already have a token for this combination (unless forced refresh)
        if (!refreshToken && this.tokens.has(cacheKey)) {
            return this.tokens.get(cacheKey)!;
        }

        const payload = {
            client_id: variables.swClientId,
            grant_type: 'password',
            scope,
            username,
            password,
        };

        // Create a separate request context for token requests to avoid circular dependency
        const tokenRequest = await this.request.post('/api/oauth/token', {
            headers: {
                'Content-Type': 'application/json',
            },
            data: payload
        });

        const data = await tokenRequest.json();

        if (!data || !data.access_token) {
            throw new Error('Failed to retrieve access token.');
        }

        // Cache token by composite key
        this.tokens.set(cacheKey, data.access_token);
        return data.access_token;
    }

    async post(url: string, payload?: unknown, options: AdminApiOptions = {}): Promise<APIResponse> {
        return await this._request('post', url, payload, {auth: true, ...options});
    }

    async patch(url: string, payload?: unknown, options: AdminApiOptions = {}): Promise<APIResponse> {
        return await this._request('patch', url, payload, {auth: true, ...options});
    }

    async del(url: string): Promise<APIResponse> {
        return await this._request('delete', url, undefined, {auth: true});
    }

    async sync(payload: unknown): Promise<void> {
        await this.post('/_action/sync', payload);
    }

    async get(url: string, options: AdminApiOptions = {}): Promise<APIResponse> {
        return await this._request('get', url, undefined, {auth: true, ...options});
    }

    /**
     * Reserved for specific calls that require 'user-verified' Bearer scope
     */
    async postVerified(url: string, payload?: unknown, options: AdminApiOptions = {}): Promise<APIResponse> {
        return await this._request('post', url, payload, {
            credentials: {
                scope: 'user-verified',
            },
            auth: true,
            ...options
        });
    }

    /**
     * Reserved for specific calls that require 'user-verified' Bearer scope
     */
    async delVerified(url: string, options: AdminApiOptions = {}): Promise<APIResponse> {
        return await this._request('delete', url, undefined, {
            credentials: {
                scope: 'user-verified',
            },
            auth: true,
            ...options,
        });
    }

    /**
     * Creates a new AdminApi instance with different default credentials.
     * Useful for testing with restricted users.
     */
    withCredentials(username: string, password: string, scope = 'write'): AdminApi {
        return new AdminApi(this.request, {username, password, scope});
    }
}

export {AdminApi}
