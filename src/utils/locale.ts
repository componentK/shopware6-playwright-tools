import {expect} from '@playwright/test';
import type {AdminApi} from '../commands/adminApi.js';

/**
 * Resolve a Shopware `locale.id` from a language entity name (e.g. `"English"`).
 * Used when building admin user payloads that require `localeId`.
 */
export async function getLocaleIdByLanguageName(
    adminApi: AdminApi,
    languageName: string,
): Promise<string> {
    const response = await adminApi.post('/search/language', {
        filter: [
            {
                type: 'equals',
                field: 'name',
                value: languageName,
            },
        ],
        limit: 1,
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    const localeId = data.data?.[0]?.localeId as string | undefined;
    expect(localeId, `Could not find locale ID for language "${languageName}"`).toBeTruthy();
    return localeId!;
}

/** Convenience for ACL / English admin users. */
export async function getEnglishLocaleId(adminApi: AdminApi): Promise<string> {
    return getLocaleIdByLanguageName(adminApi, 'English');
}

/**
 * Resolve a Shopware `locale.id` from a locale code (e.g. `"de-DE"`, `"en-GB"`).
 */
export async function getLocaleIdByCode(
    adminApi: AdminApi,
    localeCode: string,
): Promise<string> {
    const response = await adminApi.post('/search/locale', {
        filter: [
            {
                type: 'equals',
                field: 'code',
                value: localeCode,
            },
        ],
        limit: 1,
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    const localeId = data.data?.[0]?.id as string | undefined;
    expect(localeId, `Could not find locale ID for code "${localeCode}"`).toBeTruthy();
    return localeId!;
}
