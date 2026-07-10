/**
 * Commercial subscription plan exposed by the backend billing catalog.
 */
export class SubscriptionPlan {
    /**
     * Creates a subscription plan entity.
     *
     * @param {Object} options
     */
    constructor({
        id = 0,
        code = '',
        displayName = '',
        description = '',
        monthlyPriceCents = 0,
        currency = 'PEN',
        stripePriceId = null,
        recommended = false,
        recommendedLabel = null,
        visible = true,
        usageLimits = {},
        featureFlags = {},
        includedFeatures = [],
    } = {}) {
        this.id = Number(id);
        this.code = String(code);
        this.displayName = displayName;
        this.description = description;
        this.monthlyPriceCents = Number(monthlyPriceCents);
        this.currency = currency;
        this.stripePriceId = stripePriceId;
        this.recommended = Boolean(recommended);
        this.recommendedLabel = recommendedLabel;
        this.visible = visible !== false;
        this.usageLimits = {
            maxLocations: usageLimits.maxLocations ?? null,
            maxAssets: usageLimits.maxAssets ?? null,
            maxIotDevices: usageLimits.maxIotDevices ?? null,
            maxUsers: usageLimits.maxUsers ?? null,
            historyRetentionDays: usageLimits.historyRetentionDays ?? null,
        };
        this.featureFlags = {
            allowsExports: Boolean(featureFlags.allowsExports),
            allowsMaintenance: Boolean(featureFlags.allowsMaintenance),
            allowsAiGuidance: Boolean(featureFlags.allowsAiGuidance),
            allowsAiReportSummary: Boolean(featureFlags.allowsAiReportSummary),
        };
        this.includedFeatures = Array.isArray(includedFeatures) ? includedFeatures : [];
    }

    /**
     * Whether the plan requires provider checkout.
     *
     * @returns {boolean}
     */
    get isPaid() {
        return this.monthlyPriceCents > 0;
    }
}
