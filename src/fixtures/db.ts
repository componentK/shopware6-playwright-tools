import { test as base } from './ui.js'
import { createConnection, Connection } from 'mysql2/promise'
import { expect } from '@playwright/test'

export type MyFixtures = {
  db: Connection
}

const test = base.extend<MyFixtures>({
  db: async ({}, use) => {
    const connection = await createConnection({
      host: 'localhost',
      user: 'shopware',
      password: 'shopware',
      database: 'shopware'
    })

    await use(connection)

    await connection.end()
  }
})

export { test, expect }
