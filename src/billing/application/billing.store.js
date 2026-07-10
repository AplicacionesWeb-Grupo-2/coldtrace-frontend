import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {BillingApi} from '@/billing/infrastructure/billing-api.js';
import {OrganizationSubscriptionAssembler} from '@/billing/infrastructure/organization-subscription.assembler.js';
import {SubscriptionPlanAssembler} from '@/billing/infrastructure/subscription-plan.assembler.js';

const billingApi = new BillingApi();
const planOrder = ['base', 'operations', 'compliance-ai'];

/**
 * Pinia store that coordinates billing application state and use cases.
 *
 * @returns {import('pinia').StoreDefinition}
 */
const useBillingStore = defineStore('billing', () => {
    const plans = ref([]);
    const subscription = ref(null);
    const errors = ref([]);
    const loading = ref(false);
    const checkoutPlanCode = ref(null);
    const portalLoading = ref(false);
    const lastPlanProblem = ref(null);
    const lastBillingError = ref(null);
    const plansLoaded = ref(false);
    const subscriptionLoaded = ref(false);

    const visiblePlans = computed(() =>
        plans.value
            .filter(plan => plan.visible)
            .sort((firstPlan, secondPlan) => planIndex(firstPlan.code) - planIndex(secondPlan.code)),
    );
    const currentPlan = computed(() => subscription.value?.plan ?? visiblePlans.value[0] ?? null);
    const currentPlanCode = computed(() => currentPlan.value?.code ?? null);
    const upgradePlans = computed(() =>
        visiblePlans.value.filter(plan => plan.isPaid && plan.code !== currentPlanCode.value),
    );
    const lockedEntitlements = computed(() =>
        (subscription.value?.entitlements ?? []).filter(entitlement => !entitlement.enabled),
    );

    /**
     * Loads plan catalog from the API.
     *
     * @returns {Promise<*>}
     */
    async function fetchPlans() {
        const response = await billingApi.getSubscriptionPlans();
        plans.value = SubscriptionPlanAssembler.toEntitiesFromResponse(response);
        plansLoaded.value = true;
        return plans.value;
    }

    /**
     * Loads current organization subscription from the API.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    async function fetchSubscription(organizationId) {
        const response = await billingApi.getOrganizationSubscription(organizationId);
        subscription.value = OrganizationSubscriptionAssembler.toEntityFromResponse(response);
        subscriptionLoaded.value = !!organizationId;
        return subscription.value;
    }

    /**
     * Loads billing page data from the API.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    async function fetchBillingData(organizationId) {
        loading.value = true;
        errors.value = [];
        lastPlanProblem.value = null;
        lastBillingError.value = null;

        try {
            const [loadedPlans, loadedSubscription] = await Promise.all([
                fetchPlans(),
                fetchSubscription(organizationId),
            ]);

            return {plans: loadedPlans, subscription: loadedSubscription};
        } catch (error) {
            errors.value.push(error);
            lastPlanProblem.value = planProblemFromError(error);
            lastBillingError.value = billingErrorFrom(error);
            throw error;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Starts provider checkout for the selected paid plan.
     *
     * @param {number|string} organizationId
     * @param {string} targetPlanCode
     * @returns {Promise<*>}
     */
    async function createCheckoutSession(organizationId, targetPlanCode) {
        checkoutPlanCode.value = targetPlanCode;
        lastPlanProblem.value = null;
        lastBillingError.value = null;

        try {
            const response = await billingApi.createCheckoutSession(organizationId, targetPlanCode);
            return {
                provider: response.data.provider ?? response.data.Provider,
                sessionId: response.data.sessionId ?? response.data.SessionId,
                checkoutUrl: response.data.checkoutUrl ?? response.data.CheckoutUrl,
                targetPlanCode: response.data.targetPlanCode ?? response.data.TargetPlanCode,
            };
        } catch (error) {
            lastPlanProblem.value = planProblemFromError(error);
            lastBillingError.value = billingErrorFrom(error);
            throw error;
        } finally {
            checkoutPlanCode.value = null;
        }
    }

    /**
     * Starts provider customer portal session for the organization.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    async function createCustomerPortalSession(organizationId) {
        portalLoading.value = true;
        lastPlanProblem.value = null;
        lastBillingError.value = null;

        try {
            const response = await billingApi.createCustomerPortalSession(organizationId);
            return {
                provider: response.data.provider ?? response.data.Provider,
                sessionId: response.data.sessionId ?? response.data.SessionId,
                portalUrl: response.data.portalUrl ?? response.data.PortalUrl,
                organizationId: response.data.organizationId ?? response.data.OrganizationId,
            };
        } catch (error) {
            lastPlanProblem.value = planProblemFromError(error);
            lastBillingError.value = billingErrorFrom(error);
            throw error;
        } finally {
            portalLoading.value = false;
        }
    }

    /**
     * Finds an entitlement by key.
     *
     * @param {string} key
     * @returns {Object|null}
     */
    function entitlementByKey(key) {
        return subscription.value?.entitlementByKey(key) ?? null;
    }

    /**
     * Finds a plan by stable code.
     *
     * @param {string} code
     * @returns {*}
     */
    function planByCode(code) {
        return visiblePlans.value.find(plan => plan.code === code) ?? null;
    }

    return {
        plans,
        subscription,
        errors,
        loading,
        checkoutPlanCode,
        portalLoading,
        lastPlanProblem,
        lastBillingError,
        plansLoaded,
        subscriptionLoaded,
        visiblePlans,
        currentPlan,
        currentPlanCode,
        upgradePlans,
        lockedEntitlements,
        fetchPlans,
        fetchSubscription,
        fetchBillingData,
        createCheckoutSession,
        createCustomerPortalSession,
        entitlementByKey,
        planByCode,
    };
});

/**
 * Determines display ordering for a plan code.
 *
 * @param {string} code
 * @returns {number}
 */
function planIndex(code) {
    const index = planOrder.indexOf(code);
    return index === -1 ? planOrder.length : index;
}

/**
 * Extracts backend plan-limit details from ProblemDetails responses.
 *
 * @param {*} error
 * @returns {Object|null}
 */
function planProblemFromError(error) {
    const data = error?.response?.data;
    if (!data || !data.entitlementKey) return null;

    return {
        organizationId: data.organizationId,
        planCode: data.planCode,
        subscriptionStatus: data.subscriptionStatus,
        entitlementKey: data.entitlementKey,
        entitlementCategory: data.entitlementCategory,
        entitlementEnabled: data.entitlementEnabled,
        limit: data.limit,
        used: data.used,
        remaining: data.remaining,
        lockedReason: data.lockedReason,
        requiredPlanCode: data.requiredPlanCode,
    };
}

/**
 * Normalizes billing request failures for presentation feedback.
 *
 * @param {*} error
 * @returns {{code: string, status: number, detail: string}}
 */
function billingErrorFrom(error) {
    const status = Number(error?.response?.status ?? 0);
    const detail = detailFromError(error);

    if (status === 401) return {code: 'session-error', status, detail};
    if (status === 409) return {code: 'conflict-error', status, detail};
    if (status === 502 || status === 503) return {code: 'provider-error', status, detail};
    if (error?.message === 'Organization is required to create a checkout session.' ||
        error?.message === 'Organization is required to create a customer portal session.') {
        return {code: 'organization-error', status, detail};
    }

    return {code: 'request-error', status, detail};
}

/**
 * Extracts a readable message from ProblemDetails or plain API errors.
 *
 * @param {*} error
 * @returns {string}
 */
function detailFromError(error) {
    const data = error?.response?.data;
    if (typeof data === 'string' && data.trim()) return data.trim();

    const detail = data?.detail ?? data?.message ?? data?.title;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();

    if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
    return 'Unexpected billing error.';
}

export default useBillingStore;
