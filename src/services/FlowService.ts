import {AdminApi} from '../index.js';
import {expect} from '@playwright/test';
import {v4 as uuidv4} from 'uuid';

export interface FlowSequence {
    id: string;
    actionName?: string;
    config?: Record<string, any>;
    ruleId?: string;
    parentId?: string;
    position: number;
    trueCase: boolean;
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
     */
    async cleanup(): Promise<void> {
        for (const flowId of this.cleanupFlows) {
            await this.deleteFlow(flowId);
        }
        this.cleanupFlows.length = 0;

        for (const ruleId of this.cleanupRules) {
            await this.deleteRule(ruleId);
        }
        this.cleanupRules.length = 0;
    }

    /**
     * Get the list of flows pending cleanup
     */
    getPendingCleanupFlows(): string[] {
        return [...this.cleanupFlows];
    }

    /**
     * Get the list of rules pending cleanup
     */
    getPendingCleanupRules(): string[] {
        return [...this.cleanupRules];
    }
}
