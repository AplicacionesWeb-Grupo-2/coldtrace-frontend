/**
 * Lazy-loads the operational dashboard view component.
 *
 * @returns {Promise<*>}
 */
const operationalDashboard = () => import('./views/operational-dashboard.vue');
/**
 * Lazy-loads the asset monitoring dashboard view component.
 *
 * @returns {Promise<*>}
 */
const assetMonitoringDashboard = () => import('./views/asset-monitoring-dashboard.vue');

const monitoringRoutes = [
    {path: 'operational', name: 'monitoring-operational', component: operationalDashboard, meta: {title: 'Monitoring'}},
    {path: 'assets', name: 'monitoring-assets', component: assetMonitoringDashboard, meta: {title: 'Asset Monitoring'}},
    {path: '', redirect: '/monitoring/assets'},
];

export default monitoringRoutes;
