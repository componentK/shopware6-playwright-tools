import {AdminApi} from '../index.js';
import {expect} from '@playwright/test';

export interface OrderCreationOptions {
    customerId: string;
    productId?: string;
    quantity?: number;
    price?: number;
}

export class OrderService {
    private readonly adminApi: AdminApi;

    constructor(adminApi: AdminApi) {
        this.adminApi = adminApi;
    }

    /**
     * Get tags assigned to an order
     */
    async getOrderTags(orderId: string): Promise<string[]> {
        const filter = {
            ids: orderId,
            associations: {
                tags: {},
            }
        }
        const response = await this.adminApi.post(`/search/order`, filter);
        await expect(response.status()).toBe(200);

        const order = await response.json();
        await expect(order.total).toEqual(1)
        return order.data[0]?.tags?.map((tag: any) => tag.id) || [];
    }

    /**
     * Verify that an order has no specific tags
     */
    async verifyOrderHasNoTags(orderId: string, tagIds: string[]): Promise<void> {
        const orderTags = await this.getOrderTags(orderId);

        for (const tagId of tagIds) {
            await expect(orderTags).not.toContain(tagId);
        }
    }

    /**
     * Remove an order
     */
    async removeOrder(orderId: string): Promise<void> {
        await this.adminApi.del(`/order/${orderId}`).catch(() => {
            // Ignore errors if order doesn't exist
        });
    }

    /**
     * Get order transaction IDs for an order
     */
    async getOrderTransactionIds(orderId: string): Promise<string[]> {
        const filter = {
            ids: orderId,
            associations: {
                transactions: {}
            }
        };
        const response = await this.adminApi.post('/search/order', filter);
        await expect(response.status()).toBe(200);

        const order = await response.json();
        await expect(order.total).toEqual(1);
        return order.data[0]?.transactions?.map((transaction: any) => transaction.id) || [];
    }

    /**
     * Transition an order transaction to remind state
     */
    async transitionTransactionToRemind(transactionId: string): Promise<void> {
        const response = await this.adminApi.post(`/_action/order_transaction/${transactionId}/state/remind`, {});
        await expect(response.status()).toBe(200);
    }
}
