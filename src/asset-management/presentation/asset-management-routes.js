const coldRoomList = () => import('./views/cold-room-list.vue');
const safetyRangeSettings = () => import('./views/safety-range-settings.vue');
const operationalParametersSettings = () => import('./views/operational-parameters-settings.vue');

const assetManagementRoutes = [
    {path: 'assets', name: 'asset-management-assets', component: coldRoomList, meta: {title: 'Assets'}},
    {path: 'safety-ranges', name: 'asset-management-safety-ranges', component: safetyRangeSettings, meta: {title: 'Safety ranges'}},
    {path: 'operational-parameters', name: 'asset-management-operational-parameters', component: operationalParametersSettings, meta: {title: 'Operational parameters'}},
    {path: '', redirect: '/asset-management/assets'},
];

export default assetManagementRoutes;
