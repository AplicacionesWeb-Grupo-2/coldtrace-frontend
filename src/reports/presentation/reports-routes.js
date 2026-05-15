const dailyLog = () => import('./views/daily-log.vue');
const monthlyReport = () => import('./views/monthly-report.vue');
const operationalHistory = () => import('./views/operational-history.vue');
const sanitaryCompliance = () => import('./views/sanitary-compliance.vue');
const complianceFindings = () => import('./views/compliance-findings.vue');
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
