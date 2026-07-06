import {expect} from '@playwright/test';
import {AdminApi} from '../commands/adminApi.js';
import {StorefrontApi} from '../commands/storefrontApi.js';

export class ShopContextService {
    private readonly adminApi: AdminApi;
    private readonly storefrontApi: StorefrontApi;
    private defaultSalesChannelId?: string;
    private shippingMethodIds?: { standardId: string; expressId: string };
    private paymentMethodIds?: { invoiceId: string; codId: string };
    private languageIds?: { englishId: string; germanId: string };

    constructor(adminApi: AdminApi, storefrontApi: StorefrontApi) {
        this.adminApi = adminApi;
        this.storefrontApi = storefrontApi;
    }

    async getDefaultSalesChannelId(): Promise<string> {
        if (!this.defaultSalesChannelId) {
            const response = await this.adminApi.post('/search/sales-channel', {limit: 1});
            expect(response.status()).toBe(200);
            const data = await response.json();
            expect(data.data?.length, 'expected at least one sales channel').toBeGreaterThan(0);
            this.defaultSalesChannelId = data.data[0].id as string;
        }
        return this.defaultSalesChannelId;
    }

    async getShippingMethodIds(): Promise<{ standardId: string; expressId: string }> {
        if (!this.shippingMethodIds) {
            this.shippingMethodIds = {
                standardId: await this.searchEntityIdByName('shipping-method', 'Standard'),
                expressId: await this.searchEntityIdByName('shipping-method', 'Express'),
            };
        }
        return this.shippingMethodIds;
    }

    async getPaymentMethodIds(): Promise<{ invoiceId: string; codId: string }> {
        if (!this.paymentMethodIds) {
            this.paymentMethodIds = {
                invoiceId: await this.searchEntityIdByName('payment-method', 'Invoice'),
                codId: await this.searchEntityIdByName('payment-method', 'Cash on delivery'),
            };
        }
        return this.paymentMethodIds;
    }

    async getLanguageIds(): Promise<{ englishId: string; germanId: string }> {
        if (!this.languageIds) {
            this.languageIds = {
                englishId: await this.searchEntityIdByName('language', 'English'),
                germanId: await this.searchEntityIdByName('language', 'Deutsch'),
            };
        }
        return this.languageIds;
    }

    async patchStoreContext(contextToken: string, payload: Record<string, string>): Promise<void> {
        const response = await this.storefrontApi.patch('/context', payload, {
            headers: {'sw-context-token': contextToken},
        });
        expect(response.status()).toBe(200);
    }

    async clearCache(): Promise<void> {
        const response = await this.adminApi.del('/_action/cache-delayed');
        expect([200, 204]).toContain(response.status());
    }

    private async searchEntityIdByName(endpoint: string, name: string): Promise<string> {
        const response = await this.adminApi.post(`/search/${endpoint}`, {
            filter: [{type: 'equals', field: 'name', value: name}],
            limit: 1,
        });
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.data?.length, `expected ${endpoint} named "${name}"`).toBeGreaterThan(0);
        return data.data[0].id;
    }
}
