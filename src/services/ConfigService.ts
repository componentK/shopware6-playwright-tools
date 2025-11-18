import type {AdminApi} from '../commands/adminApi.js';
import {v4 as uuidv4} from 'uuid';

export interface SystemConfigEntry {
    id?: string;
    configurationKey: string;
    configurationValue: unknown;
}

export class ConfigService {
    private readonly adminApi: AdminApi;
    private readonly originalConfigs: Map<string, { id: string; value: any }> = new Map();

    constructor(adminApi: AdminApi) {
        this.adminApi = adminApi;
    }

    async install(configEntries: SystemConfigEntry[]): Promise<void> {
        if (!Array.isArray(configEntries) || configEntries.length === 0) {
            console.warn('⚠️ ConfigManager.install called without configuration entries');
            return;
        }

        const filteredEntries = configEntries.filter(entry => typeof entry?.configurationKey === 'string');
        if (filteredEntries.length === 0) {
            console.warn('⚠️ ConfigManager.install received entries without configurationKey');
            return;
        }

        const keysToManage = filteredEntries.map(entry => entry.configurationKey);

        let deletePayload: Array<{ id: string }> = [];
        const upsertPayload: SystemConfigEntry[] = [...filteredEntries];

        try {
            const searchResponse = await this.adminApi.post('/search/system-config', {
                filter: [
                    {
                        type: 'equalsAny',
                        field: 'configurationKey',
                        value: keysToManage.join('|')
                    }
                ],
                limit: Math.max(500, keysToManage.length)
            });

            if (searchResponse.ok()) {
                const searchResult = await searchResponse.json().catch(() => null);
                const existingData: any[] = Array.isArray(searchResult?.data) ? searchResult.data : [];

                if (existingData.length > 0) {
                    const idByKey = new Map<string, string>();

                    deletePayload = existingData
                        .filter((item: any) => item?.id && typeof item.configurationKey === 'string')
                        .map((item: any) => {
                            idByKey.set(item.configurationKey, item.id);
                            return {id: item.id};
                        });

                    for (let index = 0; index < upsertPayload.length; index += 1) {
                        const entry = upsertPayload[index];
                        if (!entry.id) {
                            const existingId = idByKey.get(entry.configurationKey);
                            if (existingId) {
                                upsertPayload[index] = {...entry, id: existingId};
                            }
                        }
                    }
                }
            } else {
                console.warn('  ⚠️ Failed to search for existing system config entries. Status:', searchResponse.status());
            }
        } catch (error) {
            console.warn('  ⚠️ Error while searching for system config entries:', error);
        }

        const syncPayload: Record<string, { entity: string; action: string; payload: Array<any> }> = {};

        if (deletePayload.length > 0) {
            syncPayload['delete-system-config'] = {
                entity: 'system_config',
                action: 'delete',
                payload: deletePayload
            };
        }

        syncPayload['write-system-config'] = {
            entity: 'system_config',
            action: 'upsert',
            payload: upsertPayload
        };

        const syncResponse = await this.adminApi.sync(syncPayload);

        if (syncResponse.status() !== 200) {
            console.warn('  ⚠️ System config sync did not complete successfully. Status:', syncResponse.status());
            const errorPayload = await syncResponse.json().catch(() => null);
            if (errorPayload) {
                console.warn('  ⚠️ System config sync error payload:', errorPayload);
            }
        }
    }

    /**
     * Set a config value, tracking the original value for restoration
     */
    async setConfig(key: string, value: any): Promise<void> {
        // Search for existing config
        const searchResponse = await this.adminApi.post('/search/system-config', {
            filter: [{
                type: 'equals',
                field: 'configurationKey',
                value: key
            }]
        });

        let configId: string | undefined;
        let originalValue: any = undefined;

        if (searchResponse.ok()) {
            const result = await searchResponse.json();
            const existingConfig = result?.data?.[0];

            if (existingConfig) {
                configId = existingConfig.id;
                originalValue = existingConfig.configurationValue;
            }
        }

        // Check if we already have this key tracked
        const tracked = this.originalConfigs.get(key);
        if (tracked) {
            // Use the tracked ID
            configId = tracked.id;
        } else {
            // Not tracked yet, need to determine ID and store original
            if (!configId) {
                // No existing config, generate new ID
                configId = uuidv4().replace(/-/g, '');
            }
            // Store original value for restoration (configId is guaranteed to be string here)
            this.originalConfigs.set(key, {id: configId as string, value: originalValue});
        }

        // Upsert the config with new value (configId is guaranteed to be string here)
        await this.install([{
            id: configId as string,
            configurationKey: key,
            configurationValue: value
        }]);
    }

    /**
     * Restore all tracked configs to their original values
     */
    async restore(): Promise<void> {
        if (this.originalConfigs.size === 0) {
            return;
        }

        const restorePayload: SystemConfigEntry[] = [];
        const deletePayload: Array<{ id: string }> = [];

        for (const [key, {id, value}] of this.originalConfigs.entries()) {
            if (value === undefined) {
                // Original didn't exist, delete it
                deletePayload.push({id});
            } else {
                // Restore original value
                restorePayload.push({
                    id,
                    configurationKey: key,
                    configurationValue: value
                });
            }
        }

        const syncPayload: Record<string, any> = {};

        if (deletePayload.length > 0) {
            syncPayload['delete-system-config'] = {
                entity: 'system_config',
                action: 'delete',
                payload: deletePayload
            };
        }

        if (restorePayload.length > 0) {
            syncPayload['write-system-config'] = {
                entity: 'system_config',
                action: 'upsert',
                payload: restorePayload
            };
        }

        if (Object.keys(syncPayload).length > 0) {
            await this.adminApi.sync(syncPayload);
        }

        // Clear tracked configs
        this.originalConfigs.clear();
    }
}
