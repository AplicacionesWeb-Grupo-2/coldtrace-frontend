/**
 * Lazy-loads the billing management view component.
 *
 * @returns {Promise<*>}
 */
const billingManagement = () => import('./views/billing-management.vue');

const billingRoutes = [
    {path: 'billing', name: 'identity-access-billing', component: billingManagement, meta: {title: 'Billing', titleKey: 'billing.page-title'}},
];

export default billingRoutes;
