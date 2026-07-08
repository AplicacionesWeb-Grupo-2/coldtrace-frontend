import {SubscriptionPlan} from '@/billing/domain/model/subscription-plan-entity.js';

/**
 * Maps subscription plan API resources into domain entities.
 */
export class SubscriptionPlanAssembler {
    /**
     * Maps an API resource into a subscription plan entity.
     *
     * @param {Object} resource
     * @returns {SubscriptionPlan}
     */
    static toEntityFromResource(resource = {}) {
        const usageLimits = read(resource, ['usageLimits', 'UsageLimits'], {});
        const featureFlags = read(resource, ['featureFlags', 'FeatureFlags'], {});
        const includedFeatures = read(resource, ['includedFeatures', 'IncludedFeatures'], []);

        return new SubscriptionPlan({
            id: read(resource, ['id', 'Id'], 0),
            code: read(resource, ['code', 'Code'], ''),
            displayName: read(resource, ['displayName', 'DisplayName'], ''),
            description: read(resource, ['description', 'Description'], ''),
            monthlyPriceCents: read(resource, ['monthlyPriceCents', 'MonthlyPriceCents'], 0),
            currency: read(resource, ['currency', 'Currency'], 'PEN'),
            stripePriceId: read(resource, ['stripePriceId', 'StripePriceId'], null),
            recommended: read(resource, ['recommended', 'Recommended'], false),
            recommendedLabel: read(resource, ['recommendedLabel', 'RecommendedLabel'], null),
            visible: read(resource, ['visible', 'Visible'], true),
            usageLimits: {
                maxLocations: read(usageLimits, ['maxLocations', 'MaxLocations'], null),
                maxAssets: read(usageLimits, ['maxAssets', 'MaxAssets'], null),
                maxIotDevices: read(usageLimits, ['maxIotDevices', 'MaxIotDevices'], null),
                maxUsers: read(usageLimits, ['maxUsers', 'MaxUsers'], null),
                historyRetentionDays: read(usageLimits, ['historyRetentionDays', 'HistoryRetentionDays'], null),
            },
            featureFlags: {
                allowsExports: read(featureFlags, ['allowsExports', 'AllowsExports'], false),
                allowsMaintenance: read(featureFlags, ['allowsMaintenance', 'AllowsMaintenance'], false),
                allowsAiGuidance: read(featureFlags, ['allowsAiGuidance', 'AllowsAiGuidance'], false),
                allowsAiReportSummary: read(featureFlags, ['allowsAiReportSummary', 'AllowsAiReportSummary'], false),
            },
            includedFeatures: Array.isArray(includedFeatures) ? includedFeatures : [],
        });
    }

    /**
     * Maps an API response into subscription plan entities.
     *
     * @param {import('axios').AxiosResponse<Array|Object>} response
     * @returns {SubscriptionPlan[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = Array.isArray(response.data) ? response.data : response.data.subscriptionPlans ?? [];
        return resources.map(resource => this.toEntityFromResource(resource));
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
