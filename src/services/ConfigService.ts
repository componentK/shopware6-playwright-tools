import type {AdminApi} from '../commands/adminApi.js';

export interface SystemConfigEntry {
    id?: string;
    configurationKey: string;
    configurationValue: unknown;
}

export class ConfigService {
    private readonly adminApi: AdminApi;

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
}


