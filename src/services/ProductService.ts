import {AdminApi} from '../commands/adminApi.js';
import variables from '../fixtures/variables.json' with {type: 'json'};
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
    private variantBlueXlId?: string;
    private productWithPropertiesSId?: string;

    constructor(adminApi: AdminApi) {
        this.adminApi = adminApi;
    }

    async getVariantBlueXlId(): Promise<string> {
        if (!this.variantBlueXlId) {
            this.variantBlueXlId = await this.getProductIdByNumber('SWDEMO10005.2');
        }
        return this.variantBlueXlId;
    }

    async getProductWithPropertiesSId(): Promise<string> {
        if (!this.productWithPropertiesSId) {
            this.productWithPropertiesSId = await this.getProductIdByNumber('SWDEMO10007.1');
        }
        return this.productWithPropertiesSId;
    }

    async createGiftWrapProduct(salesChannelId?: string): Promise<void> {
        const channelId = salesChannelId ?? await this.resolveDefaultSalesChannelId();
        await this.adminApi.del(`/product/${variables.createdProductGiftWrapId}`).catch(() => undefined);

        const mainProductResponse = await this.adminApi.get(`/product/${variables.catalogProductMainId}`);
        expect(mainProductResponse.status()).toBe(200);
        const mainProduct = (await mainProductResponse.json()).data;
        const currencyResponse = await this.adminApi.get(`/sales-channel/${channelId}`);
        expect(currencyResponse.status()).toBe(200);
        const currencyId = (await currencyResponse.json()).data.currencyId;

        const response = await this.adminApi.sync({
            write: {
                entity: 'product',
                action: 'upsert',
                payload: [{
                    id: variables.createdProductGiftWrapId,
                    taxId: mainProduct.taxId,
                    featureSetId: mainProduct.featureSetId,
                    price: [{
                        currencyId,
                        net: 0.84033613445378,
                        linked: true,
                        gross: 1,
                    }],
                    productNumber: 'CK.GIFT.WRAP',
                    active: true,
                    stock: 999,
                    variantListingConfig: {},
                    shippingFree: true,
                    purchasePrices: [{
                        currencyId,
                        net: 0,
                        linked: true,
                        gross: 0,
                    }],
                    name: 'API: Gift Wrapping (invisible)',
                    visibilities: [{
                        salesChannelId: channelId,
                        visibility: 10,
                    }],
                }],
            },
        });
        expect(response.status()).toBe(200);
    }

    async deleteGiftWrapProduct(): Promise<void> {
        await this.adminApi.del(`/product/${variables.createdProductGiftWrapId}`).catch(() => undefined);
    }

    /**
     * Resolve a product ID by product number via Admin API search.
     */
    async getProductIdByNumber(productNumber: string): Promise<string> {
        const response = await this.adminApi.post('/search/product', {
            filter: [{
                type: 'equals',
                field: 'productNumber',
                value: productNumber,
            }],
            limit: 1,
        });
        expect(response.status()).toBe(200);
        const data = await response.json();
        const productId: string | undefined = data?.data?.[0]?.id;
        if (!productId) {
            throw new Error(`Product not found for productNumber: ${productNumber}`);
        }
        return productId;
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

    private async resolveDefaultSalesChannelId(): Promise<string> {
        const response = await this.adminApi.post('/search/sales-channel', {limit: 1});
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.data?.length, 'expected at least one sales channel').toBeGreaterThan(0);
        return data.data[0].id;
    }
}


