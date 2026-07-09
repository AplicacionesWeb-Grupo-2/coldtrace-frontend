<script setup>
import {computed, onMounted, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRouter} from 'vue-router';
import useBillingStore from '@/billing/application/billing.store.js';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import useReportsStore from '@/reports/application/reports.store.js';

const {locale, t} = useI18n();
const router = useRouter();
const billingStore = useBillingStore();
const identityAccessStore = useIdentityAccessStore();
const reportsStore = useReportsStore();
const pageLoading = ref(false);
const subscriptionError = ref(false);
const selectedReportId = ref(0);
const summary = ref(null);
const feedback = ref({
    key: 'reports.ai-summary.feedback-ready',
    kind: 'info',
});

const activeOrganizationId = computed(() => identityAccessStore.currentOrganizationIdFrom());
const activeOrganizationName = computed(() => identityAccessStore.currentOrganizationNameFrom());
const loading = computed(() =>
    pageLoading.value ||
    billingStore.loading ||
    reportsStore.loading ||
    reportsStore.aiSummaryGenerating ||
    identityAccessStore.loading,
);
const reports = computed(() =>
    reportsStore
        .reportsForOrganization(activeOrganizationId.value)
        .slice()
        .sort((first, second) => new Date(second.generatedAt).getTime() - new Date(first.generatedAt).getTime()),
);
const selectedReport = computed(() =>
    reports.value.find(report => report.id === Number(selectedReportId.value)) ?? reports.value[0] ?? null,
);
const aiSummaryLocked = computed(() => {
    const subscription = billingStore.subscription;
    if (!subscription) return false;

    const entitlement = billingStore.entitlementByKey('ai-report-summary');
    return entitlement
        ? !entitlement.enabled
        : !subscription.plan?.featureFlags?.allowsAiReportSummary;
});
const sourceMetrics = computed(() => {
    const report = summary.value?.sourceReport ?? selectedReport.value;
    if (!report) return [];

    return [
        {
            labelKey: 'reports.ai-summary.metric-assets',
            value: metricValue(read(report, ['assetCount', 'AssetCount']), 'assets'),
            tone: 'blue',
        },
        {
            labelKey: 'reports.ai-summary.metric-compliance',
            value: percentValue(read(report, ['compliancePercentage', 'CompliancePercentage'])),
            tone: 'green',
        },
        {
            labelKey: 'reports.ai-summary.metric-incidents',
            value: metricValue(
                read(report, ['openIncidentCount', 'OpenIncidentCount']) ??
                    read(report, ['incidentCount', 'IncidentCount']),
                'incidents',
            ),
            tone: 'amber',
        },
        {
            labelKey: 'reports.ai-summary.metric-out-of-range',
            value: metricValue(read(report, ['outOfRangeReadingCount', 'OutOfRangeReadingCount']), 'readings'),
            tone: 'red',
        },
    ];
});

watch(reports, () => {
    if (!reports.value.length) {
        selectedReportId.value = 0;
        return;
    }

    if (!reports.value.some(report => report.id === Number(selectedReportId.value))) {
        selectedReportId.value = reports.value[0].id;
    }
});

onMounted(() => {
    loadPageData();
});

/**
 * Loads identity, billing, and report context for the active organization.
 *
 * @returns {Promise<void>}
 */
async function loadPageData() {
    pageLoading.value = true;
    subscriptionError.value = false;
    feedback.value = {key: 'reports.ai-summary.feedback-ready', kind: 'info'};

    try {
        await identityAccessStore.fetchAccessData();
        const organizationId = activeOrganizationId.value;
        await Promise.all([
            reportsStore.fetchReports(organizationId),
            billingStore.fetchBillingData(organizationId).catch(() => {
                subscriptionError.value = true;
            }),
        ]);
    } catch {
        feedback.value = {key: 'reports.ai-summary.feedback-auth-error', kind: 'error'};
    } finally {
        pageLoading.value = false;
    }
}

/**
 * Selects a persisted report.
 *
 * @param {string} value
 * @returns {void}
 */
function selectReport(value) {
    const reportId = Number(value);
    if (!Number.isFinite(reportId) || reportId <= 0) return;

    selectedReportId.value = reportId;
    summary.value = null;
    feedback.value = {key: 'reports.ai-summary.feedback-ready', kind: 'info'};
}

/**
 * Generates the AI compliance summary for the selected report.
 *
 * @returns {Promise<void>}
 */
async function generateSummary() {
    if (!selectedReport.value) {
        feedback.value = {key: 'reports.ai-summary.feedback-no-report', kind: 'error'};
        return;
    }

    if (aiSummaryLocked.value) {
        feedback.value = {key: 'reports.ai-summary.feedback-plan-locked', kind: 'error'};
        return;
    }

    try {
        feedback.value = {key: 'reports.ai-summary.feedback-generating', kind: 'info'};
        summary.value = await reportsStore.generateAiSummary(activeOrganizationId.value, selectedReport.value.id);
        feedback.value = {key: 'reports.ai-summary.feedback-generated', kind: 'success'};
    } catch (error) {
        feedback.value = {key: feedbackKeyFromError(error), kind: 'error'};
    }
}

/**
 * Opens billing management for plan upgrades.
 *
 * @returns {Promise<*>}
 */
function openBilling() {
    return router.push({
        name: 'identity-access-billing',
        query: {organizationId: activeOrganizationId.value},
    });
}

/**
 * Builds the report type translation key.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
function reportTypeLabelKey(value) {
    const normalized = String(value ?? '')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replaceAll('_', '-')
        .toLowerCase();
    const safeValue = {
        dailylog: 'daily-log',
        monthlysummary: 'monthly-summary',
    }[normalized] ?? normalized;

    return `reports.ai-summary.report-type-${safeValue || 'unknown'}`;
}

/**
 * Builds a CSS class for AI finding status.
 *
 * @param {string} status
 * @returns {string}
 */
function findingStatusClass(status) {
    return `status-${String(status).toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')}`;
}

/**
 * Formats an ISO date for the active locale.
 *
 * @param {string|null|undefined} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
    if (!isoDate) return 'N/A';

    return new Intl.DateTimeFormat(locale.value?.startsWith('es') ? 'es-PE' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(isoDate));
}

/**
 * Formats a metric with a localized suffix.
 *
 * @param {number|null|undefined} value
 * @param {string} suffixKey
 * @returns {string}
 */
function metricValue(value, suffixKey) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return `${Number(value)} ${t(`reports.ai-summary.metric-suffix-${suffixKey}`)}`;
}

/**
 * Formats a percentage metric.
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
function percentValue(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return `${Number(value).toFixed(1)}%`;
}

/**
 * Maps backend errors to visible feedback.
 *
 * @param {*} error
 * @returns {string}
 */
function feedbackKeyFromError(error) {
    switch (error.response?.status) {
    case 0:
        return 'reports.ai-summary.feedback-network-error';
    case 401:
        return 'reports.ai-summary.feedback-auth-required';
    case 402:
    case 403:
        return 'reports.ai-summary.feedback-plan-locked';
    case 404:
        return 'reports.ai-summary.feedback-report-not-found';
    case 409:
        return 'reports.ai-summary.feedback-plan-locked';
    case 500:
        return 'reports.ai-summary.feedback-context-error';
    case 502:
        return 'reports.ai-summary.feedback-invalid-output';
    case 503:
        return 'reports.ai-summary.feedback-provider-error';
    case 504:
        return 'reports.ai-summary.feedback-timeout';
    default:
        return 'reports.ai-summary.feedback-error';
    }
}

/**
 * Reads a value from a possible backend resource casing.
 *
 * @param {*} source
 * @param {string[]} keys
 * @returns {*}
 */
function read(source, keys) {
    if (!source || typeof source !== 'object') return undefined;

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
    }

    return undefined;
}
</script>

<template>
  <section class="summary-page" aria-labelledby="summary-title">
    <div v-if="loading" class="loading-overlay">
      <span class="loading-spinner" aria-label="Loading"></span>
    </div>

    <div class="page-heading">
      <div>
        <span class="section-kicker">{{ activeOrganizationName }}</span>
        <h1 id="summary-title">{{ t('dashboard-shell.nav-reports') }}</h1>
        <p>{{ t('reports.ai-summary.subtitle') }}</p>
      </div>

      <div class="heading-actions">
        <button type="button" class="secondary-action" :disabled="loading" @click="loadPageData">
          <span class="material-icons" aria-hidden="true">refresh</span>
          {{ t('reports.ai-summary.reload') }}
        </button>
        <button
          type="button"
          class="primary-action"
          :disabled="loading || !selectedReport || aiSummaryLocked"
          @click="generateSummary"
        >
          <span class="material-icons" aria-hidden="true">auto_awesome</span>
          {{ t('reports.ai-summary.generate') }}
        </button>
      </div>
    </div>

    <p v-if="feedback.key" class="feedback" :class="feedback.kind">
      {{ t(feedback.key) }}
    </p>

    <section v-if="subscriptionError" class="access-banner warning" aria-live="polite">
      <span class="material-icons" aria-hidden="true">warning</span>
      <div>
        <h2>{{ t('reports.ai-summary.subscription-error-title') }}</h2>
        <p>{{ t('reports.ai-summary.subscription-error-description') }}</p>
      </div>
    </section>

    <section v-if="aiSummaryLocked" class="access-banner" aria-live="polite">
      <span class="material-icons" aria-hidden="true">lock</span>
      <div>
        <h2>{{ t('reports.ai-summary.plan-locked-title') }}</h2>
        <p>{{ t('reports.ai-summary.plan-locked-description') }}</p>
      </div>
      <button type="button" class="primary-action compact" @click="openBilling">
        {{ t('reports.ai-summary.view-plans') }}
      </button>
    </section>

    <section class="filter-card" aria-label="Report selection">
      <label class="filter-field">
        <span>{{ t('reports.ai-summary.report-label') }}</span>
        <select :value="selectedReport?.id ?? 0" :disabled="!reports.length || reportsStore.aiSummaryGenerating" @change="selectReport($event.target.value)">
          <option v-if="!reports.length" :value="0">{{ t('reports.ai-summary.no-reports-option') }}</option>
          <option v-for="report in reports" :key="report.id" :value="report.id">
            {{ report.title }} - {{ formatDate(report.generatedAt) }}
          </option>
        </select>
      </label>

      <div class="filter-meta">
        <span>{{ t('reports.ai-summary.selected-type') }}</span>
        <strong>{{ t(reportTypeLabelKey(selectedReport?.type)) }}</strong>
      </div>
    </section>

    <section v-if="!reports.length && !loading" class="empty-state">
      <span class="material-icons" aria-hidden="true">description</span>
      <h2>{{ t('reports.ai-summary.empty-title') }}</h2>
      <p>{{ t('reports.ai-summary.empty-description') }}</p>
    </section>

    <template v-else>
      <section class="summary-grid" aria-label="Report source metrics">
        <article v-for="metric in sourceMetrics" :key="metric.labelKey" class="summary-card" :class="`accent-${metric.tone}`">
          <span>{{ t(metric.labelKey) }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </section>

      <template v-if="summary">
        <section class="insight-layout">
          <article class="narrative-card">
            <div class="section-heading">
              <div>
                <h2>{{ t('reports.ai-summary.generated-title') }}</h2>
                <p>
                  {{
                    t('reports.ai-summary.generated-meta', {
                      date: formatDate(summary.summaryGeneratedAt),
                      provider: summary.modelProvider,
                      model: summary.modelName,
                    })
                  }}
                </p>
              </div>
            </div>

            <p class="narrative-text">{{ summary.executiveSummary }}</p>
          </article>

          <aside class="source-card">
            <h2>{{ t('reports.ai-summary.source-title') }}</h2>
            <dl>
              <div>
                <dt>{{ t('reports.ai-summary.source-report') }}</dt>
                <dd>{{ summary.reportTitle }}</dd>
              </div>
              <div>
                <dt>{{ t('reports.ai-summary.source-type') }}</dt>
                <dd>{{ t(reportTypeLabelKey(summary.reportType)) }}</dd>
              </div>
              <div>
                <dt>{{ t('reports.ai-summary.source-date') }}</dt>
                <dd>{{ formatDate(read(summary.sourceReport, ['generatedAt', 'GeneratedAt'])) }}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section class="findings-card">
          <div class="section-heading">
            <div>
              <h2>{{ t('reports.ai-summary.findings-title') }}</h2>
              <p>{{ t('reports.ai-summary.findings-subtitle') }}</p>
            </div>
          </div>

          <p v-if="!summary.findings.length" class="muted-copy">
            {{ t('reports.ai-summary.findings-empty') }}
          </p>

          <div class="finding-list">
            <article
              v-for="finding in summary.findings"
              :key="`${finding.area}-${finding.status}`"
              class="finding-item"
              :class="findingStatusClass(finding.status)"
            >
              <div class="finding-header">
                <span>{{ finding.area }}</span>
                <strong>{{ finding.status }}</strong>
              </div>
              <p>{{ finding.evidence }}</p>
              <div class="recommendation">
                <span class="material-icons" aria-hidden="true">checklist</span>
                <span>{{ finding.recommendation }}</span>
              </div>
            </article>
          </div>
        </section>

        <section class="support-grid">
          <article class="support-card">
            <h2>{{ t('reports.ai-summary.evidence-gaps-title') }}</h2>
            <ul v-if="summary.evidenceGaps.length">
              <li v-for="gap in summary.evidenceGaps" :key="gap">{{ gap }}</li>
            </ul>
            <p v-else>{{ t('reports.ai-summary.no-evidence-gaps') }}</p>
          </article>

          <article class="support-card">
            <h2>{{ t('reports.ai-summary.actions-title') }}</h2>
            <ol v-if="summary.recommendedActions.length">
              <li v-for="action in summary.recommendedActions" :key="action">{{ action }}</li>
            </ol>
            <p v-else>{{ t('reports.ai-summary.no-actions') }}</p>
          </article>

          <article class="support-card">
            <h2>{{ t('reports.ai-summary.uncertainty-title') }}</h2>
            <ul v-if="summary.uncertaintyNotes.length">
              <li v-for="note in summary.uncertaintyNotes" :key="note">{{ note }}</li>
            </ul>
            <p v-else>{{ t('reports.ai-summary.no-uncertainty') }}</p>
          </article>
        </section>
      </template>

      <section v-else class="ready-state">
        <span class="material-icons" aria-hidden="true">auto_awesome</span>
        <div>
          <h2>{{ t('reports.ai-summary.ready-title') }}</h2>
          <p>{{ t('reports.ai-summary.ready-description') }}</p>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.summary-page {
  background: #f5f6f8;
  min-height: 100%;
  padding: 18px 22px 44px;
}

.loading-overlay {
  align-items: center;
  background: rgba(245, 246, 248, 0.74);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 20;
}

.loading-spinner {
  animation: spin 0.8s linear infinite;
  border: 3px solid #e5e7eb;
  border-radius: 999px;
  border-top-color: #2563eb;
  display: inline-block;
  height: 40px;
  width: 40px;
}

.page-heading,
.section-heading,
.access-banner {
  align-items: flex-start;
  display: flex;
  gap: 20px;
  justify-content: space-between;
}

.section-kicker {
  color: #2563eb;
  display: block;
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 4px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  color: #263348;
  font-size: 22px;
}

h2 {
  color: #323c4d;
  font-size: 15px;
  font-weight: 800;
}

.page-heading p,
.section-heading p,
.source-card dd,
.muted-copy,
.support-card p,
.support-card li,
.ready-state p,
.empty-state p,
.access-banner p {
  color: #98a2b3;
  font-size: 12px;
  font-weight: 700;
  line-height: 20px;
}

.heading-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.primary-action,
.secondary-action {
  align-items: center;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 800;
  gap: 8px;
  justify-content: center;
  min-height: 38px;
  padding: 8px 13px;
}

.primary-action {
  background: #2563eb;
  border: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
  color: #ffffff;
}

.primary-action.compact {
  box-shadow: none;
}

.secondary-action {
  background: #ffffff;
  border: 1px solid #ebeef2;
  color: #606c80;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.material-icons {
  font-size: 18px;
  height: 18px;
  line-height: 18px;
  width: 18px;
}

.feedback,
.filter-card,
.summary-grid,
.insight-layout,
.findings-card,
.support-grid,
.ready-state,
.empty-state,
.access-banner {
  margin-top: 20px;
}

.feedback {
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  line-height: 20px;
  padding: 10px 14px;
}

.feedback.info {
  background: #edf4ff;
  color: #2563eb;
}

.feedback.success {
  background: #eaf8f0;
  color: #176900;
}

.feedback.error {
  background: #feeceb;
  color: #b51313;
}

.access-banner {
  background: #fff8e8;
  border: 1px solid rgba(177, 111, 11, 0.24);
  border-radius: 8px;
  color: #8a5607;
  padding: 14px 16px;
}

.access-banner.warning {
  background: #fffbeb;
  border-color: #fde68a;
}

.filter-card,
.summary-card,
.narrative-card,
.source-card,
.findings-card,
.support-card,
.ready-state,
.empty-state {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(96, 108, 128, 0.16);
}

.filter-card {
  align-items: end;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(240px, 1fr) minmax(180px, 260px);
  padding: 20px 24px;
}

.filter-field {
  display: grid;
  gap: 6px;
}

.filter-field span,
.filter-meta span,
.summary-card span,
.source-card dt,
.finding-header span {
  color: #667085;
  font-size: 12px;
  font-weight: 800;
}

.filter-field select {
  background: #f4f4f4;
  border: 0;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.14);
  color: #404040;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  min-height: 38px;
  outline: none;
  padding: 9px 12px;
  width: 100%;
}

.filter-meta {
  align-items: center;
  align-self: end;
  background: #f8fafc;
  border: 1px solid #e7edf6;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 14px;
}

.filter-meta strong,
.summary-card strong {
  color: var(--accent-text, #2563eb);
  font-size: 24px;
  font-weight: 800;
}

.summary-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.summary-card {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
}

.accent-blue {
  --accent-text: #2563eb;
}

.accent-green {
  --accent-text: #176900;
}

.accent-amber {
  --accent-text: #b16f0b;
}

.accent-red {
  --accent-text: #b51313;
}

.insight-layout {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
}

.narrative-card,
.source-card,
.findings-card,
.support-card {
  padding: 22px;
}

.narrative-text {
  color: #323c4d;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.58;
  margin-top: 18px;
}

.source-card {
  align-content: start;
  display: grid;
  gap: 16px;
}

.source-card dl {
  display: grid;
  gap: 13px;
  margin: 0;
}

.source-card div {
  background: #f8fafc;
  border-radius: 8px;
  display: grid;
  gap: 4px;
  padding: 12px;
}

.source-card dd {
  color: #323c4d;
  font-weight: 800;
  margin: 0;
}

.finding-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.finding-item {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  display: grid;
  gap: 12px;
  padding: 16px;
}

.finding-item.status-critical,
.finding-item.status-risk,
.finding-item.status-action-required {
  background: #feeceb;
  border-color: #fecaca;
}

.finding-item.status-warning,
.finding-item.status-observation,
.finding-item.status-needs-review {
  background: #fff8e8;
  border-color: #fde68a;
}

.finding-item.status-compliant,
.finding-item.status-ok,
.finding-item.status-stable {
  background: #eaf8f0;
  border-color: #bbf7d0;
}

.finding-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.finding-header strong {
  background: rgba(255, 255, 255, 0.72);
  border-radius: 999px;
  color: #323c4d;
  font-size: 12px;
  font-weight: 800;
  padding: 5px 9px;
}

.finding-item p {
  color: #323c4d;
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
}

.recommendation {
  align-items: flex-start;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 8px;
  color: #606c80;
  display: flex;
  gap: 10px;
  padding: 12px;
}

.recommendation .material-icons {
  color: #2563eb;
}

.recommendation span:last-child {
  font-size: 13px;
  font-weight: 800;
  line-height: 20px;
}

.support-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.support-card h2 {
  margin-bottom: 12px;
}

.support-card ul,
.support-card ol {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
}

.ready-state,
.empty-state {
  align-items: center;
  display: flex;
  gap: 16px;
  min-height: 120px;
  padding: 22px;
}

.ready-state .material-icons,
.empty-state .material-icons {
  background: #eff6ff;
  border-radius: 8px;
  color: #2563eb;
  flex: 0 0 44px;
  font-size: 24px;
  height: 44px;
  line-height: 44px;
  text-align: center;
  width: 44px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .page-heading,
  .section-heading,
  .access-banner {
    flex-direction: column;
  }

  .filter-card,
  .summary-grid,
  .insight-layout,
  .support-grid {
    grid-template-columns: 1fr;
  }

  .heading-actions,
  .heading-actions .primary-action,
  .heading-actions .secondary-action,
  .access-banner .primary-action {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .summary-page {
    padding: 18px 12px 34px;
  }

  .filter-card,
  .narrative-card,
  .source-card,
  .findings-card,
  .support-card,
  .ready-state,
  .empty-state {
    padding: 18px;
  }
}
</style>
