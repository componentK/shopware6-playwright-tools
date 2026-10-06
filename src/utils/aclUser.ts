import type {AdminApi} from '../commands/adminApi.js';
import variables from '../fixtures/variables.json' with {type: 'json'};

export type AclUserPayload = {
    username: string;
    password: string;
    [key: string]: unknown;
};

export type CreateAclUserOptions = {
    /** Defaults to `variables.swAdmin`. */
    creatorUsername?: string;
    /** Defaults to `variables.swPass`. */
    creatorPassword?: string;
};

/**
 * Create an admin user via `/user` (user-verified scope), then mark the 6.7.15+ UI-shell
 * update modal as seen for that user once — so first login does not open the announcement.
 *
 * Call from plugin ACL fixtures after building a unique user payload. Pair with
 * `adminApi.markUiShellUpdate2026Seen()` once in `global.setup` for the default admin.
 */
export async function createAclUser(
    adminApi: AdminApi,
    userPayload: AclUserPayload,
    options: CreateAclUserOptions = {},
): Promise<void> {
    const creator = adminApi.withCredentials(
        options.creatorUsername ?? variables.swAdmin,
        options.creatorPassword ?? variables.swPass,
        'user-verified',
    );
    await creator.post('/user', userPayload);
    await adminApi
        .withCredentials(userPayload.username, userPayload.password)
        .markUiShellUpdate2026Seen();
}
