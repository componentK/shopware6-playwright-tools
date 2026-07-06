import {AdminApi} from '../commands/adminApi.js';
import {expect} from '@playwright/test';
import {v4 as uuidv4} from 'uuid';

export interface FlowSequence {
    id: string;
    actionName?: string;
    config?: Record<string, any>;
    ruleId?: string;
    parentId?: string;
    position: number;
    /** Present on branch/action sequences; omitted on rule-only nodes from API dumps. */
    trueCase?: boolean;
    displayGroup: number;
}

export interface FlowConfig {
    id: string;
    name: string;
    eventName: string;
    priority: number;
    active: boolean;
    sequences: FlowSequence[];
}

export class FlowService {
    private readonly adminApi: AdminApi;
    private readonly cleanupFlows: string[] = [];
    private readonly cleanupRules: string[] = [];

    constructor(adminApi: AdminApi) {
        this.adminApi = adminApi;
    }

    /**
     * Replace an existing flow (delete + create). Does not track for automatic cleanup.
     */
    async upsertFlow(flowConfig: FlowConfig | Record<string, unknown>): Promise<string> {
        const flowId = flowConfig.id as string;
        await this.adminApi.del(`/flow/${flowId}`).catch(() => undefined);
        const response = await this.adminApi.post('/flow', flowConfig);
        expect(response.status()).toBe(204);
        return flowId;
    }

    /**
     * Replace an existing rule (delete + create). Does not track for automatic cleanup.
     */
    async upsertRule(ruleData: Record<string, unknown>): Promise<string> {
        const ruleId = ruleData.id as string;
        await this.adminApi.del(`/rule/${ruleId}`).catch(() => undefined);
        const response = await this.adminApi.post('/rule', ruleData);
        expect(response.status()).toBe(204);
        return ruleId;
    }

    /**
     * Delete a flow and optionally its linked rule. Does not affect cleanup tracking lists.
     */
    async deleteFlowAndRule(flowId: string, ruleId?: string): Promise<void> {
        await this.deleteFlow(flowId);
        if (ruleId) {
            await this.deleteRule(ruleId);
        }
    }

    /**
     * Replace an existing promotion (delete + create) and assign it to a sales channel.
     */
    async upsertPromotion(promotion: Record<string, unknown>, salesChannelId: string): Promise<string> {
        const promotionId = promotion.id as string;
        await this.adminApi.del(`/promotion/${promotionId}`).catch(() => undefined);
        const payload = {
            ...promotion,
            salesChannels: [{salesChannelId, priority: 1}],
        };
        const response = await this.adminApi.post('/promotion', payload);
        expect(response.status()).toBe(204);
        return promotionId;
    }

    /**
     * Patch product placeholder IDs inside flow sequence configs.
     */
    static patchProductIds(
        flow: Record<string, unknown>,
        productIdMap: Record<string, string>,
    ): Record<string, unknown> {
        const sequences = (flow.sequences as Array<Record<string, unknown>> | undefined)?.map((sequence) => {
            const config = sequence.config as Record<string, unknown> | undefined;
            if (!config?.id || typeof config.id !== 'string') {
                return sequence;
            }
            const mappedId = productIdMap[config.id];
            if (!mappedId) {
                return sequence;
            }
            return {
                ...sequence,
                config: {
                    ...config,
                    id: mappedId,
                },
            };
        });

        return {...flow, sequences};
    }

    /**
     * Patch tag IDs inside add-customer-tag flow action configs.
     */
    static patchTagIds(
        flow: Record<string, unknown>,
        tagId: string,
        tagName: string,
    ): Record<string, unknown> {
        const sequences = (flow.sequences as Array<Record<string, unknown>> | undefined)?.map((sequence) => {
            if (sequence.actionName !== 'action.add.customer.tag') {
                return sequence;
            }
            const config = sequence.config as Record<string, unknown> | undefined;
            return {
                ...sequence,
                config: {
                    ...config,
                    tagIds: {[tagId]: tagName},
                },
            };
        });

        return {...flow, sequences};
    }

    static patchPromoId(flow: Record<string, unknown>, promoId: string): Record<string, unknown> {
        return FlowService.patchProductIds(flow, {'__PROMO_ID__': promoId, '__PROMO2_ID__': promoId});
    }

    static patchRulePromoId(rule: Record<string, unknown>, promoId: string): Record<string, unknown> {
        return JSON.parse(JSON.stringify(rule).split('__PROMO_ID__').join(promoId)) as Record<string, unknown>;
    }

    /**
     * Create a flow with sequences
     */
    async createFlow(flowConfig: FlowConfig): Promise<string> {
        const response = await this.adminApi.post('/flow', flowConfig);
        await expect([204]).toContain(response.status());

        // Track for cleanup
        this.cleanupFlows.push(flowConfig.id);

        return flowConfig.id;
    }

    /**
     * Create a rule
     */
    async createRule(ruleData: any): Promise<string> {
        const ruleId = ruleData.id || uuidv4().replace(/-/g, '');

        const rulePayload = {
            id: ruleId,
            ...ruleData
        };

        const response = await this.adminApi.post('/rule', rulePayload);
        expect([200, 204]).toContain(response.status());

        const result = response.status() === 200 ? await response.json() : {data: {id: ruleId}};
        expect(result.data?.id).toBe(ruleId);

        // Track for cleanup
        this.cleanupRules.push(ruleId);

        return ruleId;
    }

    /**
     * Set active=false for all flows matching a Shopware Flow event name.
     * Does not delete flows or sequences — scenarios stay in the DB for inspection or re-activation.
     *
     * @returns Number of flows that were active and are now deactivated
     */
    async deactivateFlowsByEventName(eventName: string): Promise<number> {
        const searchResponse = await this.adminApi.post('/search/flow', {
            filter: [{type: 'equals', field: 'eventName', value: eventName}],
            limit: 500,
        });
        if (searchResponse.status() !== 200) {
            throw new Error(
                `Flow search failed for eventName "${eventName}": HTTP ${searchResponse.status()}`,
            );
        }
        const body = await searchResponse.json().catch(() => null);
        const rows: any[] = Array.isArray(body?.data) ? body.data : [];
        const toDeactivate = rows
            .map((raw) => this.normalizeFlowSearchRow(raw))
            .filter((f) => f.id && f.active);

        if (toDeactivate.length === 0) {
            return 0;
        }

        const payload = toDeactivate.map((f) => {
            const row: { id: string; active: boolean; versionId?: string } = {
                id: f.id,
                active: false,
            };
            if (f.versionId) {
                row.versionId = f.versionId;
            }
            return row;
        });

        const syncResponse = await this.adminApi.sync({
            'deactivate-flows-by-event': {
                entity: 'flow',
                action: 'upsert',
                payload,
            },
        });

        if ([200, 204].includes(syncResponse.status())) {
            return toDeactivate.length;
        }

        let patched = 0;
        for (const f of toDeactivate) {
            const patchResponse = await this.adminApi.patch(`/flow/${f.id}`, {active: false});
            if ([200, 204].includes(patchResponse.status())) {
                patched++;
            }
        }
        if (patched !== toDeactivate.length) {
            throw new Error(
                `Could not deactivate all flows for "${eventName}" (sync failed, PATCH patched ${patched}/${toDeactivate.length})`,
            );
        }
        return patched;
    }

    private normalizeFlowSearchRow(raw: any): { id: string; active: boolean; versionId?: string } {
        const id = raw?.id ?? raw?.attributes?.id ?? '';
        const active = raw?.active ?? raw?.attributes?.active ?? false;
        const versionId = raw?.versionId ?? raw?.attributes?.versionId;
        return {
            id: typeof id === 'string' ? id : String(id),
            active: Boolean(active),
            versionId: typeof versionId === 'string' ? versionId : undefined,
        };
    }

    /**
     * Delete a flow
     */
    async deleteFlow(flowId: string): Promise<void> {
        await this.adminApi.del(`/flow/${flowId}`).catch(() => {
            // Ignore errors if flow doesn't exist
        });
        // Remove from cleanup list if it was there
        const index = this.cleanupFlows.indexOf(flowId);
        if (index > -1) {
            this.cleanupFlows.splice(index, 1);
        }
    }

    /**
     * Delete a rule
     */
    async deleteRule(ruleId: string): Promise<void> {
        await this.adminApi.del(`/rule/${ruleId}`).catch(() => {
            // Ignore errors if rule doesn't exist
        });
        // Remove from cleanup list if it was there
        const index = this.cleanupRules.indexOf(ruleId);
        if (index > -1) {
            this.cleanupRules.splice(index, 1);
        }
    }

    /**
     * Helper to build a flow sequence
     */
    buildSequence(actionName: string, config: Record<string, any> = {}, options: Partial<FlowSequence> = {}): FlowSequence {
        return {
            id: uuidv4().replace(/-/g, ''),
            actionName,
            config,
            position: options.position || 1,
            trueCase: options.trueCase !== undefined ? options.trueCase : false,
            displayGroup: options.displayGroup || 1,
            ...options
        };
    }

    /**
     * Clean up all flows and rules created during the test session
     * Deletes flows first, then rules, to avoid foreign key constraint errors
     */
    async cleanup(): Promise<void> {
        // Delete all flows first (they reference rules)
        if (this.cleanupFlows.length > 0) {
            const flowsPayload = {
                'delete-flows': {
                    entity: 'flow',
                    action: 'delete',
                    payload: this.cleanupFlows.map((id) => ({id})),
                },
            };

            const flowsResponse = await this.adminApi.sync(flowsPayload);
            expect([200, 204]).toContain(flowsResponse.status());
        }

        // Then delete all rules
        if (this.cleanupRules.length > 0) {
            const rulesPayload = {
                'delete-rules': {
                    entity: 'rule',
                    action: 'delete',
                    payload: this.cleanupRules.map((id) => ({id})),
                },
            };

            const rulesResponse = await this.adminApi.sync(rulesPayload);
            expect([200, 204]).toContain(rulesResponse.status());
        }

        this.cleanupFlows.length = 0;
        this.cleanupRules.length = 0;
    }
}
