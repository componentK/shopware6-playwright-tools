import {StorefrontApi, AdminApi} from '../index.js';
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
     * @returns Cart payload
     */
    async getCart(contextToken: string): Promise<any> {
        const cartResponse = await this.storefrontApi.get('/checkout/cart', {
            headers: {'sw-context-token': contextToken}
        });
        expect(cartResponse.status()).toBe(200);
        return await cartResponse.json();
    }

    /**
     * Add items to the cart.
     *
     * @param contextToken - Context token for the cart session
     * @param items - Array of line items to add to the cart
     * @returns Cart payload
     */
    async addLineItems(contextToken: string, items: CartLineItem[]): Promise<any> {
        const addItemResponse = await this.storefrontApi.post('/checkout/cart/line-item', {
            items: items
        }, {
            headers: {'sw-context-token': contextToken}
        });
        expect(addItemResponse.status()).toBe(200);
        return await addItemResponse.json();
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
