import {AdminApi} from '../commands/adminApi.js';
import variables from '../fixtures/variables.json' with {type: 'json'};
import {expect} from '@playwright/test';
import {v4 as uuidv4} from 'uuid';

const LIVE_VERSION_ID = '0fa91ce3e96a4bc2be4bd9ce752c3425';

export interface OrderCreationOptions {
    customerId: string;
    productId?: string;
    quantity?: number;
    price?: number;
    /** Deliveries on the same address and line. Defaults to 1. */
    deliveryCount?: number;
}

export interface CreatedOrder {
    id: string;
    orderNumber: string;
    deliveryIds: string[];
}

export class OrderService {
    private readonly adminApi: AdminApi;
    private readonly createdOrderIds: string[] = [];
    private readonly stateIds = new Map<string, string>();

    constructor(adminApi: AdminApi) {
        this.adminApi = adminApi;
    }

    /**
     * Create an order through the Admin API for an existing customer.
     * The order has one product line and one or more deliveries with empty tracking codes.
     */
    async createOrder(options: OrderCreationOptions): Promise<CreatedOrder> {
        const quantity = options.quantity ?? 1;
        const unitPrice = options.price ?? 10;
        const deliveryCount = options.deliveryCount ?? 1;
        expect(deliveryCount, 'deliveryCount').toBeGreaterThan(0);

        const customer = await this.loadCustomer(options.customerId);
        const address = customer.defaultBillingAddress;
        expect(address?.id, 'customer default billing address').toBeTruthy();
        expect(address.countryId, 'customer billing country').toBeTruthy();

        const salesChannel = await this.loadSalesChannel(customer.salesChannelId);
        const productId = options.productId ?? variables.catalogProductMainId;
        const product = await this.loadProduct(productId);

        const orderId = this.hexId();
        const orderNumber = `PW${this.hexId().slice(0, 10)}`;
        const addressId = this.hexId();
        const lineItemId = this.hexId();
        const transactionId = this.hexId();
        const deliveryIds = Array.from({length: deliveryCount}, () => this.hexId());
        const totalPrice = unitPrice * quantity;
        const linePrice = this.calculatedPrice(unitPrice, totalPrice, quantity);
        const zeroPrice = this.calculatedPrice(0, 0, 1);
        const now = this.shopwareDate();

        const orderAddress = {
            id: addressId,
            salutationId: address.salutationId ?? customer.salutationId,
            firstName: address.firstName,
            lastName: address.lastName,
            street: address.street,
            zipcode: address.zipcode,
            city: address.city,
            countryId: address.countryId,
            company: address.company ?? null,
            department: address.department ?? null,
            phoneNumber: address.phoneNumber ?? null,
        };

        const payload = {
            id: orderId,
            orderNumber,
            currencyId: salesChannel.currencyId,
            currencyFactor: 1,
            languageId: salesChannel.languageId,
            salesChannelId: salesChannel.id,
            orderDateTime: now,
            stateId: await this.stateId('order.state'),
            itemRounding: {decimals: 2, interval: 0.01, roundForNet: true},
            totalRounding: {decimals: 2, interval: 0.01, roundForNet: true},
            price: {
                netPrice: totalPrice,
                totalPrice,
                positionPrice: totalPrice,
                rawTotal: totalPrice,
                taxStatus: 'gross',
                calculatedTaxes: [],
                taxRules: [],
            },
            shippingCosts: zeroPrice,
            billingAddressId: addressId,
            primaryOrderDeliveryId: deliveryIds[0],
            primaryOrderTransactionId: transactionId,
            orderCustomer: {
                customerId: customer.id,
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                salutationId: customer.salutationId,
                customerNumber: customer.customerNumber,
            },
            addresses: [orderAddress],
            lineItems: [
                {
                    id: lineItemId,
                    identifier: productId,
                    referencedId: productId,
                    productId,
                    productVersionId: LIVE_VERSION_ID,
                    quantity,
                    label: product.name,
                    type: 'product',
                    good: true,
                    removable: true,
                    stackable: true,
                    position: 1,
                    states: [],
                    payload: {productNumber: product.productNumber},
                    price: linePrice,
                    priceDefinition: {
                        type: 'quantity',
                        price: unitPrice,
                        quantity,
                        taxRules: [],
                        isCalculated: true,
                        listPrice: null,
                        referencePriceDefinition: null,
                    },
                },
            ],
            deliveries: deliveryIds.map((deliveryId) => ({
                id: deliveryId,
                stateId: undefined as string | undefined,
                shippingMethodId: salesChannel.shippingMethodId,
                shippingOrderAddressId: addressId,
                shippingDateEarliest: now,
                shippingDateLatest: now,
                shippingCosts: zeroPrice,
                trackingCodes: [] as string[],
                positions: [
                    {
                        orderLineItemId: lineItemId,
                        price: linePrice,
                    },
                ],
            })),
            transactions: [
                {
                    id: transactionId,
                    paymentMethodId: customer.defaultPaymentMethodId ?? salesChannel.paymentMethodId,
                    amount: linePrice,
                    stateId: await this.stateId('order_transaction.state'),
                },
            ],
        };

        const deliveryStateId = await this.stateId('order_delivery.state');
        for (const delivery of payload.deliveries) {
            delivery.stateId = deliveryStateId;
        }

        const response = await this.adminApi.post('/order', payload);
        if (response.status() !== 204 && response.status() !== 200) {
            const body = await response.text();
            expect(response.status(), body).toBe(204);
        }

        this.createdOrderIds.push(orderId);
        return this.loadCreatedOrder(orderId);
    }

    /**
     * Replace a delivery's tracking codes. An empty list clears them.
     */
    async updateOrderDeliveryTrackingCodes(deliveryId: string, codes: string[]): Promise<void> {
        const response = await this.adminApi.patch(`/order-delivery/${deliveryId}`, {
            trackingCodes: codes,
        });
        if (response.status() !== 204 && response.status() !== 200) {
            const body = await response.text();
            expect(response.status(), body).toBe(204);
        }
    }

    async cleanup(): Promise<void> {
        await Promise.all(this.createdOrderIds.splice(0).map((orderId) => this.removeOrder(orderId)));
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

    private async loadCreatedOrder(orderId: string): Promise<CreatedOrder> {
        const response = await this.adminApi.post('/search/order', {
            ids: [orderId],
            associations: {deliveries: {}},
        });
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.total).toBe(1);
        const order = body.data[0];
        return {
            id: order.id,
            orderNumber: order.orderNumber,
            deliveryIds: (order.deliveries ?? []).map((delivery: {id: string}) => delivery.id),
        };
    }

    private async loadCustomer(customerId: string): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        salutationId: string;
        customerNumber: string;
        salesChannelId: string;
        defaultPaymentMethodId?: string;
        defaultBillingAddress: {
            id: string;
            salutationId?: string;
            firstName: string;
            lastName: string;
            street: string;
            zipcode: string;
            city: string;
            countryId: string;
            company?: string;
            department?: string;
            phoneNumber?: string;
        };
    }> {
        const response = await this.adminApi.post('/search/customer', {
            ids: [customerId],
            associations: {defaultBillingAddress: {}},
        });
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.total, `customer ${customerId}`).toBe(1);
        return body.data[0];
    }

    private async loadSalesChannel(salesChannelId: string): Promise<{
        id: string;
        currencyId: string;
        languageId: string;
        shippingMethodId: string;
        paymentMethodId: string;
    }> {
        const response = await this.adminApi.get(`/sales-channel/${salesChannelId}`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        const salesChannel = body.data;
        expect(salesChannel.currencyId, 'sales channel currency').toBeTruthy();
        expect(salesChannel.languageId, 'sales channel language').toBeTruthy();
        expect(salesChannel.shippingMethodId, 'sales channel shipping method').toBeTruthy();
        expect(salesChannel.paymentMethodId, 'sales channel payment method').toBeTruthy();
        return salesChannel;
    }

    private async loadProduct(productId: string): Promise<{name: string; productNumber: string}> {
        const response = await this.adminApi.get(`/product/${productId}`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        const product = body.data;
        const name = product.translated?.name ?? product.name;
        expect(name, `product ${productId} name`).toBeTruthy();
        return {name, productNumber: product.productNumber};
    }

    private async stateId(machineTechnicalName: string): Promise<string> {
        const cached = this.stateIds.get(machineTechnicalName);
        if (cached) {
            return cached;
        }

        const response = await this.adminApi.post('/search/state-machine-state', {
            limit: 1,
            filter: [
                {type: 'equals', field: 'technicalName', value: 'open'},
                {type: 'equals', field: 'stateMachine.technicalName', value: machineTechnicalName},
            ],
        });
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.total, `open state for ${machineTechnicalName}`).toBeGreaterThan(0);
        const id = body.data[0].id as string;
        this.stateIds.set(machineTechnicalName, id);
        return id;
    }

    private calculatedPrice(unitPrice: number, totalPrice: number, quantity: number): {
        unitPrice: number;
        totalPrice: number;
        quantity: number;
        calculatedTaxes: [];
        taxRules: [];
    } {
        return {
            unitPrice,
            totalPrice,
            quantity,
            calculatedTaxes: [],
            taxRules: [],
        };
    }

    private shopwareDate(date = new Date()): string {
        const pad = (value: number, length = 2) => String(value).padStart(length, '0');
        return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
    }

    private hexId(): string {
        return uuidv4().replace(/-/g, '');
    }
}
