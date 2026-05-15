const preventiveMaintenanceScheduler = () => import('./views/preventive-maintenance-scheduler.vue');
const technicalServiceTracker = () => import('./views/technical-service-tracker.vue');

const maintenanceManagementRoutes = [
    {path: 'preventive', name: 'maintenance-preventive', component: preventiveMaintenanceScheduler, meta: {title: 'Preventive maintenance', titleKey: 'maintenance.preventive.page-title'}},
    {path: 'technical-service', name: 'maintenance-technical-service', component: technicalServiceTracker, meta: {title: 'Technical service', titleKey: 'maintenance.technical-service.page-title'}},
    {path: '', redirect: '/maintenance/preventive'},
];

export default maintenanceManagementRoutes;
