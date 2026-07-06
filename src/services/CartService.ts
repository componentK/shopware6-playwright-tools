import {StorefrontApi} from '../commands/storefrontApi.js';
import {AdminApi} from '../commands/adminApi.js';
import {expect} from '@playwright/test';
import * as fs from 'fs';

export interface CartLineItem {
    id?: string;
    type: 'product';
    referencedId: string;
    quantity?: number;
}

export class CartService {
    private readonly storefrontApi: StorefrontApi;
    private readonly adminApi?: AdminApi;
    private readonly cleanupOrders: string[] = [];

    constructor(storefrontApi: StorefrontApi, adminApi?: AdminApi) {
        this.storefrontApi = storefrontApi;
        this.adminApi = adminApi;
    }

    static getErrors(cart: { errors?: unknown }): unknown[] {
        if (!cart.errors) {
            return [];
        }
        return Array.isArray(cart.errors) ? cart.errors : Object.values(cart.errors as Record<string, unknown>);
    }

    static findMessageBySequenceId(
        cart: { errors?: Record<string, unknown> | unknown[] },
        sequenceId: string,
    ): Record<string, unknown> | undefined {
        const errors = cart.errors;
        if (!errors) {
            return undefined;
        }
        if (Array.isArray(errors)) {
            return errors.find((error) =>
                String((error as Record<string, unknown>).key ?? '').includes(sequenceId),
            ) as Record<string, unknown> | undefined;
        }
        return errors[`action-cart-message-${sequenceId}`] as Record<string, unknown> | undefined;
    }

    /**
     * Create a new cart for guest
     *
     * @returns Updated context token (may be different from the input token)
     */
    async createNewCart(): Promise<string> {
        const cartResponse = await this.storefrontApi.post('/checkout/cart');
        expect(cartResponse.status()).toBe(200);

        // Extract updated context token from response headers
        return cartResponse.headers()['sw-context-token'];
    }

    /**
     * Get the existing cart for the given context token.
     * This will load the existing cart without creating a new one.
     *
     * @param contextToken - Context token for the cart session
     * @param options - Optional configuration
     * @param options.headers - Additional headers to include (sw-context-token is always included)
     * @param options.query - Query parameters to append to the URL (e.g., '?customParam=test')
     * @returns Cart payload
     */
    async getCart(contextToken: string, options?: { headers?: Record<string, string>; query?: string }): Promise<any> {
        const headers: Record<string, string> = {
            'sw-context-token': contextToken,
            ...(options?.headers || {})
        };

        const url = options?.query
            ? `/checkout/cart${options.query.startsWith('?') ? options.query : `?${options.query}`}`
            : '/checkout/cart';

        const cartResponse = await this.storefrontApi.get(url, {
            headers
        });
        expect(cartResponse.status()).toBe(200);
        return await cartResponse.json();
    }

    /**
     * Add items to the cart.
     *
     * @param contextToken - Context token for the cart session
     * @param items - Array of line items to add to the cart
     * @param options - Optional configuration
     * @param options.headers - Additional headers to include (sw-context-token is always included)
     * @returns Cart payload
     */
    async addLineItems(contextToken: string, items: CartLineItem[], options?: { headers?: Record<string, string> }): Promise<any> {
        const headers: Record<string, string> = {
            'sw-context-token': contextToken,
            ...(options?.headers || {})
        };

        const addItemResponse = await this.storefrontApi.post('/checkout/cart/line-item', {
            items: items
        }, {
            headers
        });
        expect(addItemResponse.status()).toBe(200);
        return await addItemResponse.json();
    }

    /**
     * Update line item quantities or payloads in the cart.
     */
    async updateLineItems(
        contextToken: string,
        items: Array<{ id: string; quantity?: number; payload?: Record<string, unknown> }>,
        options?: { headers?: Record<string, string> },
    ): Promise<any> {
        const headers: Record<string, string> = {
            'sw-context-token': contextToken,
            ...(options?.headers || {}),
        };

        const response = await this.storefrontApi.patch('/checkout/cart/line-item', {items}, {headers});
        expect(response.status()).toBe(200);
        return response.json();
    }

    /**
     * Delete the current cart session and start a fresh cart.
     *
     * @returns Updated context token when Shopware rotates it
     */
    async clearCart(contextToken: string): Promise<string> {
        const options = {headers: {'sw-context-token': contextToken}};

        const deleteResponse = await this.storefrontApi.del('/checkout/cart', undefined, options);
        expect(deleteResponse.status()).toBe(204);

        return deleteResponse.headers()['sw-context-token'] ?? contextToken;
    }

    /**
     * Create an order from the current cart.
     *
     * @param contextToken - Context token for the cart session
     * @param documents - Optional documents to upload with the order (key-value pairs of document field names to file paths)
     * @returns Order ID
     */
    async createOrder(contextToken: string, documents?: Record<string, string>): Promise<string> {
        const requestOptions: any = {
            headers: {'sw-context-token': contextToken}
        };

        // If documents are provided, use multipart form data
        if (documents && Object.keys(documents).length > 0) {
            const multipart: Record<string, string | fs.ReadStream> = {};
            Object.entries(documents).forEach(([key, filePath]) => {
                multipart[`verificationDocuments[${key}]`] = fs.createReadStream(filePath);
            });
            requestOptions.multipart = multipart;
        }

        const orderResponse = await this.storefrontApi.post('/checkout/order', {}, requestOptions);
        expect(orderResponse.status()).toBe(200);

        const orderData = await orderResponse.json();
        const orderId = orderData?.id;
        expect(orderId, 'Order ID should be present in response').toBeTruthy();

        // Track for cleanup
        this.cleanupOrders.push(orderId);

        return orderId;
    }

    /**
     * Remove an order
     */
    async removeOrder(orderId: string): Promise<void> {
        if (!this.adminApi) {
            throw new Error('AdminApi is required for order removal');
        }
        await this.adminApi.del(`/order/${orderId}`).catch(() => {
            // Ignore errors if order doesn't exist
        });
        // Remove from cleanup list if it was there
        const index = this.cleanupOrders.indexOf(orderId);
        if (index > -1) {
            this.cleanupOrders.splice(index, 1);
        }
    }

    /**
     * Clean up all orders created during the test session
     */
    async cleanup(): Promise<void> {
        if (!this.adminApi) {
            // If AdminApi is not available, skip cleanup
            return;
        }
        const orderIds = [...this.cleanupOrders];
        for (const orderId of orderIds) {
            await this.removeOrder(orderId);
        }
    }
}
