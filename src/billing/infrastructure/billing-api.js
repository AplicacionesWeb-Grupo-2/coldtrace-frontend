import {BaseApi} from '@/shared/infrastructure/base-api.js';

const subscriptionPlansEndpointPath = import.meta.env.VITE_SUBSCRIPTION_PLANS_ENDPOINT_PATH ?? '/subscription-plans';
const organizationSubscriptionEndpointPath = import.meta.env.VITE_ORGANIZATION_SUBSCRIPTION_ENDPOINT_PATH ?? '/subscription';
const billingCheckoutSessionsEndpointPath = import.meta.env.VITE_BILLING_CHECKOUT_SESSIONS_ENDPOINT_PATH ?? '/billing/checkout-sessions';
const billingPortalSessionsEndpointPath = import.meta.env.VITE_BILLING_PORTAL_SESSIONS_ENDPOINT_PATH ?? '/billing/customer-portal-sessions';

/**
 * HTTP facade for billing resources.
 */
export class BillingApi extends BaseApi {
    /**
     * Requests the public subscription plan catalog.
     *
     * @returns {Promise<*>}
     */
    getSubscriptionPlans() {
        return this.get(subscriptionPlansEndpointPath);
    }

    /**
     * Requests the active subscription for an organization.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    getOrganizationSubscription(organizationId) {
        const endpointPath = this.organizationScopedPath(organizationId, organizationSubscriptionEndpointPath);
        return endpointPath ? this.get(endpointPath) : Promise.resolve({status: 200, data: {}});
    }

    /**
     * Creates a Stripe Checkout session for a paid plan.
     *
     * @param {number|string} organizationId
     * @param {string} targetPlanCode
     * @returns {Promise<*>}
     */
    createCheckoutSession(organizationId, targetPlanCode) {
        const endpointPath = this.organizationScopedPath(organizationId, billingCheckoutSessionsEndpointPath);
        if (!endpointPath) return Promise.reject(new Error('Organization is required to create a checkout session.'));

        return this.http.post(endpointPath, {targetPlanCode});
    }

    /**
     * Creates a Stripe Customer Portal session for the organization.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    createCustomerPortalSession(organizationId) {
        const endpointPath = this.organizationScopedPath(organizationId, billingPortalSessionsEndpointPath);
        if (!endpointPath) return Promise.reject(new Error('Organization is required to create a customer portal session.'));

        return this.http.post(endpointPath, {});
    }
}
