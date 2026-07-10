/**
 * Lazy-loads the incident list view component.
 *
 * @returns {Promise<*>}
 */
const incidentList = () => import('./views/incident-list.vue');
/**
 * Lazy-loads the AI guidance view component.
 *
 * @returns {Promise<*>}
 */
const aiGuidance = () => import('./views/ai-guidance.vue');
/**
 * Lazy-loads the notification list view component.
 *
 * @returns {Promise<*>}
 */
const notificationList = () => import('./views/notification-list.vue');

const alertsRoutes = [
    {path: 'incidents', name: 'alerts-incidents', component: incidentList, meta: {title: 'Incidents', titleKey: 'alerts.incident-list.page-title'}},
    {path: 'ai-guidance', name: 'alerts-ai-guidance', component: aiGuidance, meta: {title: 'AI Guidance', titleKey: 'alerts.ai-guidance.page-title'}},
    {path: 'notifications', name: 'alerts-notifications', component: notificationList, meta: {title: 'Notifications', titleKey: 'alerts.notification-list.page-title'}},
    {path: '', redirect: '/alerts/incidents'},
];

export default alertsRoutes;
