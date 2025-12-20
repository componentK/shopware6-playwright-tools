import {AdminApi, StorefrontApi, variables} from '../index.js';
import {expect} from '@playwright/test';
import * as fs from 'fs';
import {v4 as uuidv4} from 'uuid';

export interface CustomerRegistrationOptions {
    email?: string;
    firstName?: string;
    lastName?: string;
    storefrontUrl?: string;
    street?: string;
    zipcode?: string;
    city?: string;
    salutationId?: string;
    countryId?: string;
    documents?: Record<string, string>;
    guest?: boolean;
}

export interface CustomerRegistrationResult {
    customerId: string;
    email: string;
    contextToken: string;
}

export class CustomerService {
    private readonly adminApi: AdminApi;
    private readonly storefrontApi: StorefrontApi;
    private readonly baseUrl: string;
    private readonly cleanupCustomers: string[] = [];
    private defaultSalutationId?: string;
    private defaultCountryId?: string;

    constructor(adminApi: AdminApi, storefrontApi: StorefrontApi, baseUrl: string) {
        this.adminApi = adminApi;
        this.storefrontApi = storefrontApi;
        this.baseUrl = baseUrl;
    }

    /**
     * Clears stored admin grid filters for the customer listing.
     * Shopware persists filters per-user via the user-config endpoint, which can make UI tests flaky
     * (e.g. the customer list unexpectedly showing only a subset of customers).
     */
    async resetCustomerGridFilters(): Promise<void> {
        const response = await this.adminApi.patch('/_info/config-me', {
            'grid.filter.customer': [],
        });
        expect(response.status()).toBe(204);
    }

    /**
     * Register a new customer via Storefront API
     */
    async registerCustomer(options: CustomerRegistrationOptions = {}): Promise<CustomerRegistrationResult> {
        const isGuest = options.guest !== false; // Default to guest
        const email = options.email || `${isGuest ? 'guest' : 'customer'}.${Date.now()}@example.com`;
        const firstName = options.firstName || (isGuest ? 'Guest' : 'Test');
        const lastName = options.lastName || (isGuest ? 'Customer' : 'User');
        const street = options.street || `${isGuest ? 'Guest' : 'Test'} Street 1`;
        const zipcode = options.zipcode || '12345';
        const city = options.city || `${isGuest ? 'Guest' : 'Test'} City`;
        const salutationId = options.salutationId || await this.getDefaultSalutationId();
        const countryId = options.countryId || await this.getDefaultCountryId();
        const storefrontUrl = options.storefrontUrl || this.baseUrl;

        const multipart: Record<string, string | fs.ReadStream> = {
            guest: isGuest ? 'true' : 'false',
            storefrontUrl,
            salutationId,
            firstName,
            lastName,
            email,
            acceptedDataProtection: '1',
            'billingAddress[salutationId]': salutationId,
            'billingAddress[firstName]': firstName,
            'billingAddress[lastName]': lastName,
            'billingAddress[street]': street,
            'billingAddress[zipcode]': zipcode,
            'billingAddress[city]': city,
            'billingAddress[countryId]': countryId,
        };

        // Add password for regular customers
        if (!isGuest) {
            multipart.password = 'TestPassword123!';
        }

        // this is VerificationDocumentsPlugin specific
        if (options.documents) {
            Object.entries(options.documents).forEach(([key, filePath]) => {
                multipart[`verificationDocuments[${key}]`] = fs.createReadStream(filePath);
            });
        }

        const registerResponse = await this.storefrontApi.post('/account/register', undefined, {
            multipart,
        });

        if (registerResponse.status() !== 200) {
            const errorData = await registerResponse.json().catch(() => ({error: 'Could not parse error response'}));
            console.log('Registration failed with status:', registerResponse.status(), 'Error:', errorData);
        }

        expect(registerResponse.status()).toBe(200);
        const registerData = await registerResponse.json();

        const contextTokenHeader = registerResponse.headers()['sw-context-token'];
        expect(contextTokenHeader).toBeTruthy();

        // Registration endpoint returns two context tokens separated by comma:
        // - First token: guest session token (old)
        // - Second token: new customer session token (use this one)
        // Reference: https://shopware.stoplight.io/docs/store-api/aa7ea5e14dea6-registering-a-customer
        const contextTokens = (contextTokenHeader as string).split(',').map(token => token.trim());
        const newCustomerContextToken = contextTokens.length > 1 ? contextTokens[contextTokens.length - 1] : contextTokens[0];

        const customerId: string | undefined =
            registerData?.customer?.id ?? registerData?.data?.id ?? registerData?.id;

        expect(customerId, 'Customer ID should be present after registration').toBeDefined();

        if (!customerId) {
            throw new Error('Registration did not return a customer ID');
        }

        // Track for cleanup
        this.cleanupCustomers.push(customerId);

        return {
            customerId,
            email,
            contextToken: newCustomerContextToken,
        };
    }

    /**
     * NOTE! This does not get a new contextToken, so cart manipulations might throw 409 code errors
     */
    async cloneMainCustomer(overwrites: {
        id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        password?: string;
    } = {}): Promise<string> {
        const customerId = overwrites.id || this.generateCustomerId();
        const customerEmail = overwrites.email || `test.customer.${Date.now()}@example.com`;
        const password = overwrites.password || 'TestPassword123!';

        const cloneResponse = await this.adminApi.post(`/_action/clone/customer/${variables.customerMainId}`, {
            overwrites: {
                id: customerId,
                firstName: overwrites.firstName || 'Test',
                lastName: overwrites.lastName || 'Customer',
                email: customerEmail,
                password,
                ...overwrites
            },
            cloneChildren: false
        });

        expect(cloneResponse.status()).toBe(200);

        this.cleanupCustomers.push(customerId);

        return customerId;
    }

    /**
     * Login a customer and get context token
     */
    async loginCustomer(email: string, password: string = 'TestPassword123!'): Promise<string> {
        const loginResponse = await this.storefrontApi.post('/account/login', {
            username: email,
            password: password
        });
        expect(loginResponse.status()).toBe(200);

        const contextTokenHeader = loginResponse.headers()['sw-context-token'];
        expect(contextTokenHeader).toBeTruthy();

        return contextTokenHeader as string;
    }

    /**
     * Retrieve a context token for an existing customer, logging them in if necessary
     */
    async getCustomerContextToken(customerId: string, email?: string): Promise<string> {
        const customerEmail = email ?? await this.getCustomerEmail(customerId);

        return this.loginCustomer(customerEmail);
    }

    /**
     * Get all orders for a customer
     */
    async getCustomerOrders(customerId: string): Promise<string[]> {
        const response = await this.adminApi.post('/search/order', {
            filter: [
                {
                    type: 'equals',
                    field: 'customerId',
                    value: customerId
                }
            ],
            fields: ['id'],
            limit: 100
        });

        expect(response.status()).toBe(200);
        const data = await response.json();

        return data.data?.map((order: any) => order.id) || [];
    }

    async deleteCustomerByEmail(email: string): Promise<void> {
        try {
            const searchResponse = await this.adminApi.post('/search/customer', {
                filter: [
                    {
                        type: 'equals',
                        field: 'email',
                        value: email
                    }
                ],
                limit: 1
            });

            if (searchResponse.status() !== 200) {
                return;
            }

            const searchData = await searchResponse.json().catch(() => null);
            const customerId = searchData?.data?.[0]?.id;

            if (customerId) {
                await this.adminApi.del(`/customer/${customerId}`).catch(() => {
                    // ignore cleanup errors
                });
            }
        } catch {
            // ignore cleanup errors
        }
    }

    /**
     * Remove a customer by ID
     */
    async removeCustomer(customerId: string): Promise<void> {
        await this.adminApi.del(`/customer/${customerId}`).catch(() => {
            // Ignore errors if customer doesn't exist
        });
        // Remove from cleanup list if it was there
        const index = this.cleanupCustomers.indexOf(customerId);
        if (index > -1) {
            this.cleanupCustomers.splice(index, 1);
        }
    }

    /**
     * Clean up all customers created during the test session
     */
    async cleanup(): Promise<void> {
        // Clean up tracked customers
        const ids = [...this.cleanupCustomers];
        for (const customerId of ids) {
            await this.removeCustomer(customerId);
        }
        this.cleanupCustomers.length = 0;
    }

    /**
     * Get the list of customers pending cleanup
     */
    getPendingCleanup(): string[] {
        return [...this.cleanupCustomers];
    }

    /**
     * Generate a unique customer ID (Shopware-compatible UUID)
     */
    private generateCustomerId(): string {
        return uuidv4().replace(/-/g, '');
    }

    private async getDefaultSalutationId(): Promise<string> {
        if (this.defaultSalutationId) {
            return this.defaultSalutationId;
        }

        const response = await this.adminApi.post('/search/salutation', {
            filter: [
                {
                    type: 'equals',
                    field: 'salutationKey',
                    value: 'mr',
                },
            ],
            limit: 1,
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        const salutationId: string | undefined = data?.data?.[0]?.id;
        if (!salutationId) {
            throw new Error('Unable to resolve default salutation ID');
        }

        this.defaultSalutationId = salutationId;

        return salutationId;
    }

    private async getDefaultCountryId(): Promise<string> {
        if (this.defaultCountryId) {
            return this.defaultCountryId;
        }

        const response = await this.adminApi.post('/search/country', {
            filter: [
                {
                    type: 'equals',
                    field: 'iso',
                    value: 'DE',
                },
            ],
            limit: 1,
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        const countryId: string | undefined = data?.data?.[0]?.id;
        if (!countryId) {
            throw new Error('Unable to resolve default country ID');
        }

        this.defaultCountryId = countryId;

        return countryId;
    }

    private async getCustomerEmail(customerId: string): Promise<string> {
        const customerResponse = await this.adminApi.get(`/customer/${customerId}`);
        expect(customerResponse.status()).toBe(200);
        const customerData = await customerResponse.json();

        return customerData.data.email;
    }
}
