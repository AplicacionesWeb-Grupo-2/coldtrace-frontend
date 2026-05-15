/**
 * Lazy-loads the sign in view component.
 *
 * @returns {Promise<*>}
 */
const signIn = () => import('./views/sign-in.vue');
/**
 * Lazy-loads the sign up view component.
 *
 * @returns {Promise<*>}
 */
const signUp = () => import('./views/sign-up.vue');
/**
 * Lazy-loads the password recovery view component.
 *
 * @returns {Promise<*>}
 */
const passwordRecovery = () => import('./views/password-recovery.vue');
/**
 * Lazy-loads the reset password view component.
 *
 * @returns {Promise<*>}
 */
const resetPassword = () => import('./views/reset-password.vue');
/**
 * Lazy-loads the operational dashboard view component.
 *
 * @returns {Promise<*>}
 */
const operationalDashboard = () => import('@/monitoring/presentation/views/operational-dashboard.vue');
/**
 * Lazy-loads the user access list view component.
 *
 * @returns {Promise<*>}
 */
const userAccessList = () => import('./views/user-access-list.vue');
/**
 * Lazy-loads the user form view component.
 *
 * @returns {Promise<*>}
 */
const userForm = () => import('./views/user-form.vue');
/**
 * Lazy-loads the role permission form view component.
 *
 * @returns {Promise<*>}
 */
const rolePermissionForm = () => import('./views/role-permission-form.vue');

const identityAccessRoutes = [
    {path: 'dashboard', name: 'identity-access-dashboard', component: operationalDashboard, meta: {title: 'Main'}},
    {path: 'assets', redirect: '/asset-management/assets'},
    {path: 'alerts', redirect: '/alerts/incidents'},
    {path: 'monitoring', redirect: '/monitoring/assets'},
    {path: 'reports', redirect: '/reports/daily-log'},
    {path: 'password-recovery', name: 'identity-access-password-recovery', component: passwordRecovery, meta: {title: 'Password recovery'}},
    {path: 'reset-password', name: 'identity-access-reset-password', component: resetPassword, meta: {title: 'Reset password'}},
    {path: 'roles-permissions/permissions', name: 'identity-access-role-permissions', component: rolePermissionForm, meta: {title: 'Role permissions'}},
    {path: 'roles-permissions/users/new', name: 'identity-access-user-new', component: userForm, meta: {title: 'Create user'}},
    {path: 'users', redirect: '/identity-access/roles-permissions'},
    {path: 'roles-permissions', name: 'identity-access-roles-permissions', component: userAccessList, meta: {title: 'Roles and permissions'}},
    {path: 'sign-in', name: 'identity-access-sign-in', component: signIn, meta: {title: 'Sign in'}},
    {path: 'sign-up', name: 'identity-access-sign-up', component: signUp, meta: {title: 'Create account'}},
    {path: '', redirect: '/identity-access/sign-in'},
];

export default identityAccessRoutes;
