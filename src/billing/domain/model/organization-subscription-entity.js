/**
 * Current billing state and entitlements for an organization.
 */
export class OrganizationSubscription {
    /**
     * Creates an organization subscription entity.
     *
     * @param {Object} options
     */
    constructor({
        id = 0,
        organizationId = 0,
        status = 'active',
        provider = 'LOCAL',
        providerCustomerId = null,
        providerSubscriptionId = null,
        currentPeriodStart = null,
        currentPeriodEnd = null,
        cancelAtPeriodEnd = false,
        metadata = null,
        plan = null,
        usage = {},
        entitlements = [],
    } = {}) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.status = status;
        this.provider = provider;
        this.providerCustomerId = providerCustomerId;
        this.providerSubscriptionId = providerSubscriptionId;
        this.currentPeriodStart = currentPeriodStart;
        this.currentPeriodEnd = currentPeriodEnd;
        this.cancelAtPeriodEnd = Boolean(cancelAtPeriodEnd);
        this.metadata = metadata;
        this.plan = plan;
        this.usage = {
            locations: Number(usage.locations ?? 0),
            assets: Number(usage.assets ?? 0),
            iotDevices: Number(usage.iotDevices ?? 0),
            users: Number(usage.users ?? 0),
        };
        this.entitlements = Array.isArray(entitlements) ? entitlements : [];
    }

    /**
     * Finds an entitlement by stable key.
     *
     * @param {string} key
     * @returns {Object|null}
     */
    entitlementByKey(key) {
        return this.entitlements.find(entitlement => entitlement.key === key) ?? null;
    }
}
