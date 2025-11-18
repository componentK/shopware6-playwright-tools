import {AdminApi} from '../index.js';
import {expect} from '@playwright/test';
import {v4 as uuidv4} from 'uuid';

export class SnippetService {
    private readonly adminApi: AdminApi;
    private readonly cleanupSnippetIds: string[] = [];

    constructor(adminApi: AdminApi) {
        this.adminApi = adminApi;
    }

    /**
     * Resolve snippet set ID for a given locale ISO (e.g. en-GB).
     */
    private async getSnippetSetId(localeIso: string): Promise<string> {
        const response = await this.adminApi.post('/search/snippet-set', {
            filter: [
                {
                    type: 'equals',
                    field: 'iso',
                    value: localeIso,
                },
            ],
            limit: 1,
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.data?.length).toBeGreaterThan(0);

        return data.data[0].id;
    }

    /**
     * Create a snippet in the core snippet table for tests.
     *
     * Note: This operates on the core snippet entity, not app snippets.
     */
    async createSnippet(
        translationKey: string,
        value: string,
        localeIso: string = 'en-GB',
        author = 'playwright-test',
    ): Promise<string> {
        const snippetSetId = await this.getSnippetSetId(localeIso);
        const snippetId = uuidv4().replace(/-/g, '');

        const payload = {
            id: snippetId,
            translationKey,
            value,
            author,
            setId: snippetSetId,
        };

        const response = await this.adminApi.post('/snippet', payload);
        expect([200, 204]).toContain(response.status());

        this.cleanupSnippetIds.push(snippetId);

        return snippetId;
    }

    async deleteSnippet(snippetId: string): Promise<void> {
        await this.adminApi.del(`/snippet/${snippetId}`).catch(() => {
            // ignore if not found
        });

        const index = this.cleanupSnippetIds.indexOf(snippetId);
        if (index !== -1) {
            this.cleanupSnippetIds.splice(index, 1);
        }
    }

    async cleanup(): Promise<void> {
        if (this.cleanupSnippetIds.length === 0) {
            return;
        }

        const payload = {
            'delete-snippets': {
                entity: 'snippet',
                action: 'delete',
                payload: this.cleanupSnippetIds.map((id) => ({id})),
            },
        };

        const response = await this.adminApi.sync(payload);
        expect([200, 204]).toContain(response.status());

        this.cleanupSnippetIds.length = 0;
    }
}


