import {OrganizationSubscription} from '@/billing/domain/model/organization-subscription-entity.js';
import {SubscriptionPlanAssembler} from '@/billing/infrastructure/subscription-plan.assembler.js';

/**
 * Maps organization subscription API resources into domain entities.
 */
export class OrganizationSubscriptionAssembler {
    /**
     * Maps an API resource into an organization subscription entity.
     *
     * @param {Object} resource
     * @returns {OrganizationSubscription|null}
     */
    static toEntityFromResource(resource = {}) {
        if (!resource || Object.keys(resource).length === 0) return null;

        const usage = read(resource, ['usage', 'Usage'], {});
        const plan = read(resource, ['plan', 'Plan'], null);
        const entitlements = read(resource, ['entitlements', 'Entitlements'], []);

        return new OrganizationSubscription({
            id: read(resource, ['id', 'Id'], 0),
            organizationId: read(resource, ['organizationId', 'OrganizationId'], 0),
            status: read(resource, ['status', 'Status'], 'active'),
            provider: read(resource, ['provider', 'Provider'], 'LOCAL'),
            providerCustomerId: read(resource, ['providerCustomerId', 'ProviderCustomerId'], null),
            providerSubscriptionId: read(resource, ['providerSubscriptionId', 'ProviderSubscriptionId'], null),
            currentPeriodStart: read(resource, ['currentPeriodStart', 'CurrentPeriodStart'], null),
            currentPeriodEnd: read(resource, ['currentPeriodEnd', 'CurrentPeriodEnd'], null),
            cancelAtPeriodEnd: read(resource, ['cancelAtPeriodEnd', 'CancelAtPeriodEnd'], false),
            metadata: read(resource, ['metadata', 'Metadata'], null),
            plan: plan ? SubscriptionPlanAssembler.toEntityFromResource(plan) : null,
            usage: {
                locations: read(usage, ['locations', 'Locations'], 0),
                assets: read(usage, ['assets', 'Assets'], 0),
                iotDevices: read(usage, ['iotDevices', 'IotDevices', 'IoTDevices'], 0),
                users: read(usage, ['users', 'Users'], 0),
            },
            entitlements: Array.isArray(entitlements)
                ? entitlements.map(entitlement => this.toEntitlementFromResource(entitlement))
                : [],
        });
    }

    /**
     * Maps an API response into an organization subscription entity.
     *
     * @param {import('axios').AxiosResponse<Object>} response
     * @returns {OrganizationSubscription|null}
     */
    static toEntityFromResponse(response) {
        if (response.status !== 200) return null;
        return this.toEntityFromResource(response.data);
    }

    /**
     * Maps a backend entitlement resource into a display-safe object.
     *
     * @param {Object} resource
     * @returns {Object}
     */
    static toEntitlementFromResource(resource = {}) {
        return {
            key: read(resource, ['key', 'Key'], ''),
            category: read(resource, ['category', 'Category'], ''),
            enabled: Boolean(read(resource, ['enabled', 'Enabled'], false)),
            limit: read(resource, ['limit', 'Limit'], null),
            used: read(resource, ['used', 'Used'], null),
            remaining: read(resource, ['remaining', 'Remaining'], null),
            lockedReason: read(resource, ['lockedReason', 'LockedReason'], null),
        };
    }
}

/**
 * Reads a value from a resource using possible keys.
 *
 * @param {Object} source
 * @param {string[]} keys
 * @param {*} fallback
 * @returns {*}
 */
function read(source, keys, fallback = undefined) {
    if (!source || typeof source !== 'object') return fallback;

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
    }

    return fallback;
}
