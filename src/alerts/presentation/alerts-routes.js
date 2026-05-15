/**
 * Lazy-loads the incident list view component.
 *
 * @returns {Promise<*>}
 */
const incidentList = () => import('./views/incident-list.vue');
/**
 * Lazy-loads the notification list view component.
 *
 * @returns {Promise<*>}
 */
const notificationList = () => import('./views/notification-list.vue');

const alertsRoutes = [
    {path: 'incidents', name: 'alerts-incidents', component: incidentList, meta: {title: 'Incidents', titleKey: 'alerts.incident-list.page-title'}},
    {path: 'notifications', name: 'alerts-notifications', component: notificationList, meta: {title: 'Notifications', titleKey: 'alerts.notification-list.page-title'}},
    {path: '', redirect: '/alerts/incidents'},
];

export default alertsRoutes;
