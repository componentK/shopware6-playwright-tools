import {StorefrontApi} from '../commands/storefrontApi.js';
import {expect} from '@playwright/test';

export interface CartLineItem {
    id?: string;
    type: 'product';
    referencedId: string;
    quantity?: number;
}

export class CartService {
    private readonly storefrontApi: StorefrontApi;

    constructor(storefrontApi: StorefrontApi) {
        this.storefrontApi = storefrontApi;
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
     * @returns Order ID
     */
    async createOrder(contextToken: string): Promise<string> {
        const orderResponse = await this.storefrontApi.post('/checkout/order', {}, {
            headers: {'sw-context-token': contextToken}
        });
        expect(orderResponse.status()).toBe(200);

        const orderData = await orderResponse.json();
        const orderId = orderData?.id;
        expect(orderId, 'Order ID should be present in response').toBeTruthy();

        return orderId;
    }
}

