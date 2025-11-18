import {expect, type Page, test as base} from '@playwright/test'
import {AdminLogin} from '../commands/adminLogin.js'
import {Utility} from '../commands/utility.js'
import {AdminApi} from '../commands/adminApi.js'
import {StorefrontApi} from '../commands/storefrontApi.js'
import {CustomerService} from '../services/CustomerService.js'
import {CartService} from '../services/CartService.js'
import {OrderService} from '../services/OrderService.js'
import {TagService} from '../services/TagService.js'
import {FlowService} from '../services/FlowService.js'
import {EmailService} from '../services/EmailService.js'
import {ConfigService} from '../services/ConfigService.js'
import {ProductService} from '../services/ProductService.js'
import {SnippetService} from '../services/SnippetService.js'

export type TestFixtures = {
    page: Page
    adminLogin: AdminLogin
    utility: Utility
    adminApi: AdminApi
    storefrontApi: StorefrontApi
    salesChannelAccessKey: string
    customerService: CustomerService
    cartService: CartService
    orderService: OrderService
    tagService: TagService
    flowService: FlowService
    emailService: EmailService
    configService: ConfigService
    productService: ProductService
    snippetService: SnippetService
}

export type SalesChannel = {
    salesChannelData: {
        id: string
        accessKey: string
    }
}

const test = base.extend<TestFixtures, SalesChannel>({
    salesChannelData: [
        async ({playwright}, use) => {
            const requestContext = await playwright.request.newContext()
            const adminApi = new AdminApi(requestContext)
            const searchData = {
                filter: [
                    {
                        type: 'equals',
                        field: 'name',
                        value: 'Storefront'
                    }
                ]
            }

            const response = await adminApi.post('/search/sales-channel', searchData)
            expect(response.status()).toBe(200)

            const responseData = await response.json()
            const salesChannel = responseData.data[0]
            expect(salesChannel.name).toBe('Storefront')

            await use({
                id: salesChannel.id,
                accessKey: salesChannel.accessKey
            })
        },
        {scope: 'worker'}
    ],

    adminLogin: async ({page}, use) => {
        await use(new AdminLogin(page))
    },
    utility: async ({page}, use) => {
        await use(new Utility(page))
    },
    adminApi: async ({request}, use) => {
        await use(new AdminApi(request))
    },

    storefrontApi: async ({request, salesChannelData}, use) => {
        const storefrontApi = new StorefrontApi(request)
        storefrontApi.setAccessKey(salesChannelData.accessKey)
        await use(storefrontApi)
    },

    // do not create baseURL fixture, it's passed from the tsconfig.json
    customerService: async ({adminApi, storefrontApi, baseURL}, use) => {
        const customerService = new CustomerService(adminApi, storefrontApi, baseURL || '')
        await use(customerService)

        // Cleanup after each test
        await customerService.cleanup()
    },

    cartService: async ({storefrontApi, adminApi}, use) => {
        const cartService = new CartService(storefrontApi, adminApi)
        await use(cartService)

        // Cleanup after each test
        await cartService.cleanup()
    },

    orderService: async ({adminApi}, use) => {
        const orderService = new OrderService(adminApi)
        await use(orderService)
    },

    tagService: async ({adminApi}, use) => {
        const tagService = new TagService(adminApi)
        await use(tagService)

        // Cleanup after each test
        await tagService.cleanup()
    },

    flowService: async ({adminApi}, use) => {
        const flowService = new FlowService(adminApi)
        await use(flowService)

        // Cleanup after each test
        await flowService.cleanup()
    },

    emailService: async ({}, use) => {
        const emailService = new EmailService()
        await use(emailService)
    },

    configService: async ({adminApi}, use) => {
        const configService = new ConfigService(adminApi)
        await use(configService)

        // restore original after each test
        await configService.restore()
    },

    productService: async ({adminApi}, use) => {
        const productService = new ProductService(adminApi)
        await use(productService)

        await productService.cleanup()
    },

    snippetService: async ({adminApi}, use) => {
        const snippetService = new SnippetService(adminApi)
        await use(snippetService)

        await snippetService.cleanup()
    }
})

export {test, expect}
