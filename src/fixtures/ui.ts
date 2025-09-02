import { test as base, expect } from '@playwright/test'
import { AdminLogin } from '../commands/adminLogin.js'
import { Utility } from '../commands/utility.js'
import { AdminApi } from '../commands/adminApi.js'
import { StorefrontApi } from '../commands/storefrontApi.js'

export type TestFixtures = {
  page: any
  adminLogin: AdminLogin
  utility: Utility
  adminApi: AdminApi
  storefrontApi: StorefrontApi
  salesChannelAccessKey: string
}

export type SalesChannel = {
  salesChannelData: {
    id: string
    accessKey: string
  }
}

const test = base.extend<TestFixtures, SalesChannel>({
  salesChannelData: [
    async ({ playwright }, use) => {
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
    { scope: 'worker' }
  ],

  adminLogin: async ({ page }, use) => {
    await use(new AdminLogin(page))
  },
  utility: async ({ page }, use) => {
    await use(new Utility(page))
  },
  adminApi: async ({ request }, use) => {
    await use(new AdminApi(request))
  },

  storefrontApi: async ({ request, salesChannelData }, use) => {
    const storefrontApi = new StorefrontApi(request)
    storefrontApi.setAccessKey(salesChannelData.accessKey)
    await use(storefrontApi)
  }
})

export { test, expect }
