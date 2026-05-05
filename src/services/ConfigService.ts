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

    private static unwrapSystemConfigValue(raw: unknown): unknown {
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && '_value' in raw) {
            return (raw as { _value: unknown })._value;
        }

        return raw;
    }

    private static valuesEqual(left: unknown, right: unknown): boolean {
        return JSON.stringify(left) === JSON.stringify(right);
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
        const deletePayload: Array<{ id: string }> = [];
        const deleteIds = new Set<string>();
        const upsertPayload: SystemConfigEntry[] = [];

        try {
            const searchResponse = await this.adminApi.post('/search/system-config', {
                filter: [
                    {
                        type: 'equalsAny',
                        field: 'configurationKey',
                        value: keysToManage
                    }
                ],
                limit: Math.max(500, keysToManage.length)
            });

            if (searchResponse.ok()) {
                const searchResult = await searchResponse.json().catch(() => null);
                const existingData: any[] = Array.isArray(searchResult?.data) ? searchResult.data : [];
                const rowsByKey = new Map<string, any[]>();
                for (const item of existingData) {
                    if (!item?.id || typeof item.configurationKey !== 'string') {
                        continue;
                    }

                    const bucket = rowsByKey.get(item.configurationKey);
                    if (bucket) {
                        bucket.push(item);
                    } else {
                        rowsByKey.set(item.configurationKey, [item]);
                    }
                }

                // Track original values for restoration only once
                for (const entry of filteredEntries) {
                    if (this.originalConfigs.has(entry.configurationKey)) {
                        continue;
                    }

                    const existingRows = rowsByKey.get(entry.configurationKey) || [];
                    const matchingById = entry.id ? existingRows.find((row: any) => row.id === entry.id) : undefined;
                    const rowToTrack = matchingById || existingRows[0];
                    if (rowToTrack?.id) {
                        this.originalConfigs.set(entry.configurationKey, {
                            id: rowToTrack.id,
                            value: ConfigService.unwrapSystemConfigValue(rowToTrack.configurationValue),
                        });
                    } else {
                        const configId = entry.id || uuidv4().replace(/-/g, '');
                        this.originalConfigs.set(entry.configurationKey, {id: configId, value: undefined});
                    }
                }

                for (const entry of filteredEntries) {
                    const existingRows = rowsByKey.get(entry.configurationKey) || [];

                    if (entry.id) {
                        for (const row of existingRows) {
                            if (row.id !== entry.id && !deleteIds.has(row.id)) {
                                deleteIds.add(row.id);
                                deletePayload.push({id: row.id});
                            }
                        }

                        const matchingRow = existingRows.find((row: any) => row.id === entry.id);
                        if (!matchingRow) {
                            upsertPayload.push(entry);
                            continue;
                        }

                        const currentValue = ConfigService.unwrapSystemConfigValue(matchingRow.configurationValue);
                        if (!ConfigService.valuesEqual(currentValue, entry.configurationValue)) {
                            upsertPayload.push(entry);
                        }

                        continue;
                    }

                    const row = existingRows[0];
                    if (!row) {
                        upsertPayload.push({...entry, id: uuidv4().replace(/-/g, '')});
                        continue;
                    }

                    const currentValue = ConfigService.unwrapSystemConfigValue(row.configurationValue);
                    if (!ConfigService.valuesEqual(currentValue, entry.configurationValue)) {
                        upsertPayload.push({...entry, id: row.id});
                    }
                }
            } else {
                console.warn('  ⚠️ Failed to search for existing system config entries. Status:', searchResponse.status());
                // Fallback: upsert all and track unknown originals.
                for (const entry of filteredEntries) {
                    const key = entry.configurationKey;
                    if (!this.originalConfigs.has(key)) {
                        const configId = entry.id || uuidv4().replace(/-/g, '');
                        this.originalConfigs.set(key, {id: configId, value: undefined});
                    }
                    upsertPayload.push({
                        ...entry,
                        id: entry.id || uuidv4().replace(/-/g, ''),
                    });
                }
            }
        } catch (error) {
            console.warn('  ⚠️ Error while searching for system config entries:', error);
            for (const entry of filteredEntries) {
                const configId = entry.id || uuidv4().replace(/-/g, '');
                if (!this.originalConfigs.has(entry.configurationKey)) {
                    this.originalConfigs.set(entry.configurationKey, {id: configId, value: undefined});
                }
                upsertPayload.push({...entry, id: configId});
            }
        }

        const syncPayload: Record<string, { entity: string; action: string; payload: Array<any> }> = {};

        if (deletePayload.length > 0) {
            syncPayload['delete-system-config'] = {
                entity: 'system_config',
                action: 'delete',
                payload: deletePayload
            };
        }

        if (upsertPayload.length > 0) {
            syncPayload['write-system-config'] = {
                entity: 'system_config',
                action: 'upsert',
                payload: upsertPayload
            };
        }

        if (Object.keys(syncPayload).length === 0) {
            return;
        }

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
