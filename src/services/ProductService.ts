import {AdminApi} from '../index.js';
import {expect} from '@playwright/test';
import {v4 as uuidv4} from 'uuid';

export interface ProductCloneOverwrites {
    id?: string;
    name?: string;
    productNumber?: string;

    [key: string]: any;
}

export class ProductService {
    private readonly adminApi: AdminApi;
    private readonly cleanupProductIds: string[] = [];

    constructor(adminApi: AdminApi) {
        this.adminApi = adminApi;
    }

    /**
     * Clone a product using the Shopware clone endpoint.
     * Allows passing a static UUID in overwrites.id for deterministic tests.
     */
    async cloneProduct(sourceProductId: string, overwrites: ProductCloneOverwrites = {}): Promise<string> {
        const productId = (overwrites.id ?? uuidv4()).replace(/-/g, '');

        const payload = {
            overwrites: {
                id: productId,
                ...overwrites,
            },
            cloneChildren: false,
        };

        const response = await this.adminApi.post(`/_action/clone/product/${sourceProductId}`, payload);
        expect(response.status()).toBe(200);

        this.cleanupProductIds.push(productId);

        return productId;
    }

    /**
     * Delete a cloned product by ID (best-effort).
     */
    async deleteProduct(productId: string): Promise<void> {
        await this.adminApi.del(`/product/${productId}`).catch(() => {
            // ignore if it doesn't exist
        });

        const index = this.cleanupProductIds.indexOf(productId);
        if (index !== -1) {
            this.cleanupProductIds.splice(index, 1);
        }
    }

    /**
     * Cleanup all cloned products created during the test.
     */
    async cleanup(): Promise<void> {
        const ids = [...this.cleanupProductIds];

        for (const id of ids) {
            await this.deleteProduct(id);
        }
    }
}


