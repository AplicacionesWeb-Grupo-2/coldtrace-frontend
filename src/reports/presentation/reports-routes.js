/**
 * Lazy-loads the daily log view component.
 *
 * @returns {Promise<*>}
 */
const dailyLog = () => import('./views/daily-log.vue');
/**
 * Lazy-loads the monthly report view component.
 *
 * @returns {Promise<*>}
 */
const monthlyReport = () => import('./views/monthly-report.vue');
/**
 * Lazy-loads the operational history view component.
 *
 * @returns {Promise<*>}
 */
const operationalHistory = () => import('./views/operational-history.vue');
/**
 * Lazy-loads the sanitary compliance view component.
 *
 * @returns {Promise<*>}
 */
const sanitaryCompliance = () => import('./views/sanitary-compliance.vue');
/**
 * Lazy-loads the compliance findings view component.
 *
 * @returns {Promise<*>}
 */
const complianceFindings = () => import('./views/compliance-findings.vue');
/**
 * Lazy-loads the audit evidence view component.
 *
 * @returns {Promise<*>}
 */
const auditEvidence = () => import('./views/audit-evidence.vue');

const reportsRoutes = [
    {path: 'daily-log', name: 'reports-daily-log', component: dailyLog, meta: {title: 'Daily Log', titleKey: 'reports.daily-log.page-title'}},
    {path: 'monthly', name: 'reports-monthly', component: monthlyReport, meta: {title: 'Monthly Report', titleKey: 'reports.monthly.page-title'}},
    {path: 'history', name: 'reports-history', component: operationalHistory, meta: {title: 'Operational History', titleKey: 'reports.history.page-title'}},
    {path: 'compliance', name: 'reports-compliance', component: sanitaryCompliance, meta: {title: 'Sanitary Compliance', titleKey: 'reports.compliance.page-title'}},
    {path: 'findings', name: 'reports-findings', component: complianceFindings, meta: {title: 'Compliance Findings', titleKey: 'reports.findings.page-title'}},
    {path: 'audit-evidence', name: 'reports-audit-evidence', component: auditEvidence, meta: {title: 'Audit Evidence', titleKey: 'reports.audit.page-title'}},
    {path: '', redirect: '/reports/daily-log'},
];

export default reportsRoutes;
