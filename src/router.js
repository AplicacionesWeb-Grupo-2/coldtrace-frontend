import {createRouter, createWebHistory} from 'vue-router';
import assetManagementRoutes from '@/asset-management/presentation/asset-management-routes.js';
import identityAccessRoutes from '@/identity-access/presentation/identity-access-routes.js';
import monitoringRoutes from '@/monitoring/presentation/monitoring-routes.js';
import alertsRoutes from '@/alerts/presentation/alerts-routes.js';
import maintenanceManagementRoutes from '@/maintenance-management/presentation/maintenance-management-routes.js';
import reportsRoutes from '@/reports/presentation/reports-routes.js';
import {authSession} from '@/shared/infrastructure/auth-session.js';
import billingRoutes from '@/billing/presentation/billing-routes.js';

/**
 * Lazy-loads the page not found view component.
 *
 * @returns {Promise<*>}
 */
const pageNotFound = () => import('@/shared/presentation/views/page-not-found.vue');

const routes = [
    {path: '/identity-access', children: identityAccessRoutes},
    {path: '/asset-management', children: assetManagementRoutes},
    {path: '/monitoring', children: monitoringRoutes},
    {path: '/alerts', children: alertsRoutes},
    {path: '/maintenance', children: maintenanceManagementRoutes},
    {path: '/reports', children: reportsRoutes},
    {path: '/settings', children: billingRoutes},
    {path: '/', redirect: '/identity-access/sign-in'},
    {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: pageNotFound,
        meta: {title: 'Page Not Found'},
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    /**
     * Restores the viewport position after route navigation.
     *
     * @returns {*}
     */
    scrollBehavior() {
        return {top: 0};
    },
});

router.beforeEach((to) => {
    const baseTitle = 'ColdTrace';
    document.title = `${baseTitle} - ${to.meta['title'] ?? 'Access'}`;
    if (!isPublicRoute(to) && !authSession.hasToken()) {
        return {
            name: 'identity-access-sign-in',
            query: {redirect: to.fullPath},
        };
    }
    return true;
});

export default router;

/**
 * Determines whether a route can be opened without an authenticated backend session.
 *
 * @param {*} route
 * @returns {boolean}
 */
function isPublicRoute(route) {
    return [
        'identity-access-sign-in',
        'identity-access-sign-up',
        'identity-access-password-recovery',
        'identity-access-reset-password',
        'not-found',
    ].includes(route.name);
}
