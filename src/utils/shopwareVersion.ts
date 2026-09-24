/**
 * Shopware version helpers for dual-line (6.6 / 6.7) test fixtures.
 */

type AdminApiLike = {
    get: (path: string) => Promise<{ status: () => number; json: () => Promise<any> }>;
};

let cachedCoreVersion: string | null = null;

/**
 * Read Shopware core version from Admin API `/_info/config` (cached per process).
 */
export async function fetchShopwareCoreVersion(adminApi: AdminApiLike): Promise<string> {
    if (cachedCoreVersion) {
        return cachedCoreVersion;
    }

    const res = await adminApi.get('/_info/config');
    if (res.status() !== 200) {
        throw new Error(`Failed to read Shopware config: HTTP ${res.status()}`);
    }

    const body = await res.json();
    const version =
        body?.version ??
        body?.shopwareVersion ??
        body?.core?.version ??
        body?.settings?.version;

    if (typeof version !== 'string' || version.length === 0) {
        throw new Error('Shopware version missing from /_info/config response');
    }

    cachedCoreVersion = version.replace(/^v/, '');
    return cachedCoreVersion;
}

export function isAtLeast(current: string, minimum: string): boolean {
    const parse = (v: string): number[] => v.split('.').map((p) => parseInt(p, 10) || 0);
    const a = parse(current);
    const b = parse(minimum);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const d = (a[i] ?? 0) - (b[i] ?? 0);
        if (d !== 0) {
            return d > 0;
        }
    }
    return true;
}

export async function isShopwareAtLeast(adminApi: AdminApiLike, minimum: string): Promise<boolean> {
    const current = await fetchShopwareCoreVersion(adminApi);
    return isAtLeast(current, minimum);
}

/** Reset cache (tests only). */
export function resetShopwareVersionCache(): void {
    cachedCoreVersion = null;
}
