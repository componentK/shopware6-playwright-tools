import {AdminApi} from '../index.js';
import {expect} from '@playwright/test';
import {v4 as uuidv4} from 'uuid';

export class TagService {
    private readonly adminApi: AdminApi;
    private readonly cleanupTags: string[] = [];

    constructor(adminApi: AdminApi) {
        this.adminApi = adminApi;
    }

    /**
     * Create a new tag
     */
    async createTag(name: string, tagId?: string): Promise<string> {
        const resolvedTagId = (tagId ?? uuidv4()).replace(/-/g, '');

        const tagData = {
            id: resolvedTagId,
            name: name
        };

        const response = await this.adminApi.post('/tag', tagData);
        await expect(response.status()).toBe(204);

        // Track for cleanup
        this.cleanupTags.push(resolvedTagId);

        return resolvedTagId;
    }

    /**
     * Assign a tag to an order
     */
    async assignTagToOrder(orderId: string, tagId: string): Promise<void> {
        const response = await this.adminApi.post(`/order/${orderId}/tags`, {id: tagId});
        await expect(response.status()).toBe(204);
    }

    /**
     * Remove a tag
     */
    async deleteTag(tagId: string): Promise<void> {
        await this.adminApi.del(`/tag/${tagId}`).catch(() => {
            // Ignore errors if tag doesn't exist
        });
        // Remove from cleanup list if it was there
        const index = this.cleanupTags.indexOf(tagId);
        if (index > -1) {
            this.cleanupTags.splice(index, 1);
        }
    }

    /**
     * Clean up all tags created during the test session
     */
    async cleanup(): Promise<void> {
        const tagIds = [...this.cleanupTags];

        for (const tagId of tagIds) {
            await this.deleteTag(tagId);
        }
    }
}
