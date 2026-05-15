<script setup>
import {computed, onMounted, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import useMonitoringStore from '@/monitoring/application/monitoring.store.js';
import useReportsStore from '@/reports/application/reports.store.js';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';

const {t} = useI18n();
const identityAccessStore = useIdentityAccessStore();
const assetManagementStore = useAssetManagementStore();
const monitoringStore = useMonitoringStore();
const reportsStore = useReportsStore();
const pageLoading = ref(false);
const feedback = ref('idle');
const selectedDate = ref('');
const selectedAssetId = ref(0);
const currentPage = ref(1);
const pageSize = 10;

const maxDate = computed(() => reportsStore.currentDate());
const loading = computed(() =>
    pageLoading.value ||
    reportsStore.loading ||
    assetManagementStore.loading ||
    monitoringStore.loading ||
    identityAccessStore.loading,
);
const activeOrganizationId = computed(() => identityAccessStore.currentOrganizationIdFrom());
const activeOrganizationName = computed(() => identityAccessStore.currentOrganizationNameFrom());
const effectiveDate = computed(() => selectedDate.value || reportsStore.currentDate());
const organizationAssets = computed(() =>
    assetManagementStore.assetsForOrganization(activeOrganizationId.value),
);
const dailyLog = computed(() =>
    reportsStore.buildDailyLog(activeOrganizationId.value, effectiveDate.value),
);
const filteredEntries = computed(() => {
    if (!selectedAssetId.value) return dailyLog.value.entries;
    return dailyLog.value.entries.filter(entry => entry.assetId === Number(selectedAssetId.value));
});
const paginatedEntries = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    return filteredEntries.value.slice(start, start + pageSize);
});
const generatedReportsCount = computed(() =>
    reportsStore.reportsForOrganization(activeOrganizationId.value).length,
);
const hasEntries = computed(() => filteredEntries.value.length > 0);
const hasReadings = computed(() => dailyLog.value.totalReadings > 0);

watch([filteredEntries, selectedAssetId, selectedDate], () => {
    const maxPage = Math.max(1, Math.ceil(filteredEntries.value.length / pageSize));
    currentPage.value = Math.min(currentPage.value, maxPage);
    if (currentPage.value !== 1) currentPage.value = 1;
});

onMounted(() => {
    loadPageData();
});

/**
 * Loads page data data for the current view or use case.
 *
 * @returns {Promise<*>}
 */
async function loadPageData() {
    pageLoading.value = true;
    feedback.value = 'idle';

    try {
        await Promise.all([
            identityAccessStore.fetchAccessData(),
            assetManagementStore.fetchAssetManagementData({includeSettings: false}),
            monitoringStore.fetchMonitoringData({includeDependencies: false}),
            reportsStore.fetchReports(),
        ]);
    } catch {
        feedback.value = 'server-error';
    } finally {
        pageLoading.value = false;
    }
}

/**
 * Updates date in the reports context.
 *
 * @param {string} value
 * @returns {void}
 */
function updateDate(value) {
    selectedDate.value = value > maxDate.value ? maxDate.value : value;
    feedback.value = 'idle';
}

/**
 * Selects asset in the current view state.
 *
 * @param {string} value
 * @returns {void}
 */
function selectAsset(value) {
    selectedAssetId.value = Number(value);
}

/**
 * Generates daily log for the current workflow.
 *
 * @returns {Promise<*>}
 */
async function generateDailyLog() {
    if (!hasReadings.value) {
        feedback.value = 'server-error';
        return;
    }

    try {
        await reportsStore.createDailyLogReport(activeOrganizationId.value, dailyLog.value);
        feedback.value = 'generated';
    } catch {
        feedback.value = 'server-error';
    }
}

/**
 * Returns the i18n label key for status.
 *
 * @param {string} status
 * @returns {string}
 */
function statusLabelKey(status) {
    return `reports.daily-log.status.${status}`;
}

/**
 * Returns the CSS class for status.
 *
 * @param {string} status
 * @returns {string}
 */
function statusClass(status) {
    return `status-${status}`;
}

/**
 * Formats temperature for display.
 *
 * @param {string} value
 * @returns {string}
 */
function formatTemperature(value) {
    return value === null ? 'N/A' : `${value.toFixed(1)} °C`;
}

/**
 * Formats humidity for display.
 *
 * @param {string} value
 * @returns {string}
 */
function formatHumidity(value) {
    return value === null ? 'N/A' : `${value.toFixed(0)}%`;
}

/**
 * Formats time range for display.
 *
 * @param {*} entry
 * @returns {string}
 */
function formatTimeRange(entry) {
    if (!entry.firstRecordedAt || !entry.lastRecordedAt) return 'N/A';
    return `${formatTime(entry.firstRecordedAt)} - ${formatTime(entry.lastRecordedAt)}`;
}

/**
 * Formats time for display.
 *
 * @param {string} value
 * @returns {string}
 */
function formatTime(value) {
    return new Intl.DateTimeFormat('en', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}
</script>

<template>
  <section class="daily-log-page" aria-labelledby="daily-log-title">
    <div v-if="loading" class="loading-overlay">
      <span class="loading-spinner" aria-label="Loading"></span>
    </div>

    <div class="page-heading">
      <div>
        <span class="section-kicker">{{ activeOrganizationName }}</span>
        <h1 id="daily-log-title">{{ t('reports.daily-log.title') }}</h1>
        <p>{{ t('reports.daily-log.subtitle') }}</p>
      </div>

      <div class="heading-actions">
        <button type="button" class="secondary-action" @click="loadPageData">
          <span class="material-icons" aria-hidden="true">refresh</span>
          {{ t('reports.daily-log.reload') }}
        </button>
        <button type="button" class="primary-action" @click="generateDailyLog">
          <span class="material-icons" aria-hidden="true">article</span>
          {{ t('reports.daily-log.generate') }}
        </button>
      </div>
    </div>

    <p v-if="feedback === 'generated'" class="feedback success">
      {{ t('reports.daily-log.feedback-generated') }}
    </p>
    <p v-if="feedback === 'server-error' || reportsStore.error || monitoringStore.errors.length" class="feedback error">
      {{ t('reports.daily-log.feedback-error') }}
    </p>

    <section class="filter-card" aria-label="Daily log filters">
      <label class="filter-field">
        <span>{{ t('reports.daily-log.filter-date') }}</span>
        <input
          type="date"
          :value="effectiveDate"
          :max="maxDate"
          @input="updateDate($event.target.value)"
        />
      </label>

      <label class="filter-field">
        <span>{{ t('reports.daily-log.filter-asset') }}</span>
        <select :value="selectedAssetId" @change="selectAsset($event.target.value)">
          <option :value="0">{{ t('reports.daily-log.all-assets') }}</option>
          <option v-for="asset in organizationAssets" :key="asset.id" :value="asset.id">
            {{ asset.uuid }} - {{ asset.name }}
          </option>
        </select>
      </label>

      <div class="filter-meta">
        <span>{{ t('reports.daily-log.generated-reports') }}</span>
        <strong>{{ generatedReportsCount }}</strong>
      </div>
    </section>

    <section class="summary-grid" aria-label="Daily log summary">
      <article class="summary-card accent-blue">
        <span>{{ t('reports.daily-log.summary-assets') }}</span>
        <strong>{{ dailyLog.monitoredAssets }}</strong>
      </article>
      <article class="summary-card accent-green">
        <span>{{ t('reports.daily-log.summary-readings') }}</span>
        <strong>{{ dailyLog.totalReadings }}</strong>
      </article>
      <article class="summary-card accent-amber">
        <span>{{ t('reports.daily-log.summary-compliance') }}</span>
        <strong>{{ dailyLog.complianceRate }}%</strong>
      </article>
      <article class="summary-card accent-red">
        <span>{{ t('reports.daily-log.summary-incomplete') }}</span>
        <strong>{{ dailyLog.incompleteAssets }}</strong>
      </article>
    </section>

    <section v-if="dailyLog.hasIncompleteData && hasEntries" class="observation-banner" aria-live="polite">
      <span class="material-icons" aria-hidden="true">error_outline</span>
      <div>
        <h2>{{ t('reports.daily-log.observation-title') }}</h2>
        <p>{{ t('reports.daily-log.observation-description', {count: dailyLog.incompleteAssets}) }}</p>
      </div>
    </section>

    <section class="table-card" aria-labelledby="daily-log-table-title">
      <div class="section-heading">
        <div>
          <h2 id="daily-log-table-title">{{ t('reports.daily-log.table-title') }}</h2>
          <p>{{ t('reports.daily-log.table-subtitle', {date: effectiveDate}) }}</p>
        </div>
      </div>

      <template v-if="hasEntries">
        <div class="daily-log-table-wrapper">
          <table class="daily-log-table">
            <thead>
              <tr>
                <th>{{ t('reports.daily-log.table.asset') }}</th>
                <th>{{ t('reports.daily-log.table.location') }}</th>
                <th>{{ t('reports.daily-log.table.readings') }}</th>
                <th>{{ t('reports.daily-log.table.temperature') }}</th>
                <th>{{ t('reports.daily-log.table.humidity') }}</th>
                <th>{{ t('reports.daily-log.table.out-of-range') }}</th>
                <th>{{ t('reports.daily-log.table.window') }}</th>
                <th>{{ t('reports.daily-log.table.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in paginatedEntries" :key="entry.assetId">
                <td>
                  <strong>{{ entry.assetName }}</strong>
                  <span>#{{ entry.assetId }}</span>
                </td>
                <td>{{ entry.assetLocation }}</td>
                <td>
                  <strong>{{ entry.totalReadings }} / {{ entry.expectedReadings }}</strong>
                  <small>{{ t('reports.daily-log.expected-readings', {count: entry.expectedReadings}) }}</small>
                </td>
                <td>{{ formatTemperature(entry.averageTemperature) }}</td>
                <td>{{ formatHumidity(entry.averageHumidity) }}</td>
                <td>{{ entry.outOfRangeCount }}</td>
                <td>{{ formatTimeRange(entry) }}</td>
                <td>
                  <span class="status-pill" :class="statusClass(entry.status)">
                    {{ t(statusLabelKey(entry.status)) }}
                  </span>
                  <small v-if="entry.missingReadings > 0">
                    {{ t('reports.daily-log.missing-readings', {count: entry.missingReadings}) }}
                  </small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <list-pagination v-model="currentPage" :total="filteredEntries.length" :page-size="pageSize" />
      </template>

      <div v-else class="empty-state">
        <span class="material-icons" aria-hidden="true">event_busy</span>
        <h2>{{ t('reports.daily-log.empty-title') }}</h2>
        <p>{{ t('reports.daily-log.empty-description') }}</p>
      </div>
    </section>
  </section>
</template>

<style scoped>
.page,
.daily-log-page,
.history-page {
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
.feedback,
.filter-card,
.summary-grid,
.table-card,
.observation-banner,
.access-banner,
.evidence-grid {
  max-width: 1180px;
}

.page-heading,
.section-heading {
  align-items: flex-start;
  display: flex;
  gap: 20px;
  justify-content: space-between;
}

.page-heading h1 {
  color: #263348;
  font-size: 22px;
  line-height: 30px;
  margin: 0;
}

.section-heading h2,
.observation-banner h2,
.access-banner h2 {
  color: #323c4d;
  font-size: 14px;
  font-weight: 800;
  line-height: 20px;
  margin: 0;
}

.page-heading p,
.section-heading p {
  color: #98a2b3;
  font-size: 12px;
  font-weight: 800;
  line-height: 20px;
  margin: 6px 0 0;
}

.section-kicker {
  color: #2563eb;
  display: block;
  font-size: 11px;
  font-weight: 800;
  line-height: 16px;
  margin-bottom: 4px;
}

.heading-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.primary-action,
.secondary-action,
.row-action {
  align-items: center;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 800;
  gap: 8px;
  justify-content: center;
  min-height: 36px;
  padding: 7px 12px;
}

.primary-action {
  background: #2563eb;
  border: 0;
  color: #ffffff;
}

.secondary-action,
.row-action {
  background: #ffffff;
  border: 1px solid #ebeef2;
  color: #606c80;
}

.primary-action:disabled,
.secondary-action:disabled,
.row-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-action .material-icons,
.secondary-action .material-icons,
.row-action .material-icons {
  font-size: 18px;
  height: 18px;
  line-height: 18px;
  width: 18px;
}

.feedback,
.filter-card,
.table-card,
.observation-banner,
.access-banner {
  border-radius: 8px;
  margin-top: 20px;
}

.feedback {
  font-size: 12px;
  font-weight: 800;
  line-height: 20px;
  padding: 10px 14px;
}

.success {
  background: #eaf8f0;
  color: #176900;
}

.warning {
  background: #fff8e8;
  color: #8a5607;
}

.error {
  background: #feeceb;
  color: #b51313;
}

.filter-card,
.table-card,
.summary-card {
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(96, 108, 128, 0.16);
}

.filter-card {
  align-items: end;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(180px, 240px)) minmax(140px, 1fr);
  padding: 20px 24px;
}

.filter-card.two-columns {
  grid-template-columns: repeat(2, minmax(220px, 280px)) minmax(140px, 1fr);
}

.filter-card.three-columns {
  grid-template-columns: repeat(3, minmax(180px, 240px));
}

.filter-card.four-columns {
  grid-template-columns: repeat(4, minmax(170px, 1fr));
}

.filter-field {
  display: grid;
  gap: 6px;
}

.filter-field span,
.filter-meta span,
.summary-card span,
.data-table th,
.daily-log-table th,
.history-table th,
.data-table small,
.daily-log-table small,
.history-table small {
  font-size: 12px;
  font-weight: 800;
  line-height: 18px;
}

.filter-field span,
.filter-meta span {
  color: #404040;
}

.filter-field input,
.filter-field select {
  background: #f4f4f4;
  border: 0;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.14);
  box-sizing: border-box;
  color: #404040;
  font-size: 13px;
  min-height: 38px;
  outline: none;
  padding: 9px 12px;
  width: 100%;
}

.filter-field select {
  padding-right: 34px;
}

.filter-meta {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  min-height: 38px;
}

.filter-meta strong,
.summary-card strong {
  color: var(--accent-text, #2563eb);
  font-size: 24px;
  font-weight: 800;
  line-height: 30px;
}

.summary-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 20px;
}

.summary-card {
  border-radius: 8px;
  display: grid;
  gap: 6px;
  padding: 16px 18px;
}

.summary-card span,
.data-table th,
.daily-log-table th,
.history-table th,
.data-table td span,
.daily-log-table td span,
.history-table td span,
.data-table small,
.daily-log-table small,
.history-table small {
  color: #98a2b3;
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

.accent-gray {
  --accent-text: #606c80;
}

.observation-banner,
.access-banner {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  padding: 14px 16px;
}

.observation-banner {
  background: #fff8e8;
  border: 1px solid rgba(177, 111, 11, 0.24);
  color: #8a5607;
}

.observation-banner .material-icons,
.observation-banner h2,
.observation-banner p {
  color: #8a5607;
}

.access-banner {
  background: #feeceb;
  border: 1px solid rgba(181, 19, 19, 0.2);
  color: #b51313;
}

.access-banner .material-icons,
.access-banner h2,
.access-banner p {
  color: #b51313;
}

.observation-banner .material-icons,
.access-banner .material-icons {
  font-size: 20px;
}

.observation-banner p,
.access-banner p {
  font-weight: 700;
  line-height: 18px;
  margin: 3px 0 0;
}

.table-card {
  padding: 20px 24px;
}

.table-wrapper,
.daily-log-table-wrapper,
.history-table-wrapper {
  margin-top: 18px;
  overflow-x: auto;
}

.data-table,
.daily-log-table,
.history-table {
  border-collapse: collapse;
  min-width: 1040px;
  width: 100%;
}

.daily-log-table {
  min-width: 960px;
}

.data-table th,
.daily-log-table th,
.history-table th {
  padding: 0 14px 12px;
  text-align: left;
}

.data-table td,
.daily-log-table td,
.history-table td {
  border-top: 1px solid #ebeef2;
  color: #404040;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  padding: 14px;
  vertical-align: top;
}

.data-table td strong,
.daily-log-table td strong,
.history-table td strong,
.empty-state h2 {
  color: #323c4d;
  display: block;
  font-weight: 800;
}

.data-table td span,
.daily-log-table td span,
.history-table td span,
.data-table small,
.daily-log-table small,
.history-table small {
  display: block;
  font-size: 10px;
  font-weight: 800;
  line-height: 16px;
}

.status-pill,
.severity-pill {
  border-radius: 16px;
  display: inline-flex !important;
  padding: 3px 8px;
  white-space: nowrap;
}

.status-complete,
.status-compliant,
.status-closed {
  background: #eaf8f0;
  color: #176900 !important;
}

.status-incomplete,
.status-attention,
.status-observation,
.status-open {
  background: #fff8e8;
  color: #b16f0b !important;
}

.status-no-data,
.status-insufficient,
.status-incomplete,
.status-danger {
  background: #feeceb;
  color: #b51313 !important;
}

.status-incomplete {
  background: #fff8e8;
  color: #b16f0b !important;
}

.severity-normal {
  background: #eaf8f0;
  color: #176900 !important;
}

.severity-info {
  background: #edf4ff;
  color: #2563eb !important;
}

.severity-warning,
.severity-observation {
  background: #fff8e8;
  color: #b16f0b !important;
}

.severity-critical,
.severity-potential-non-compliance {
  background: #feeceb;
  color: #b51313 !important;
}

.severity-limitation {
  background: #eef1f5;
  color: #606c80 !important;
}

.event-type {
  align-items: center;
  color: #323c4d !important;
  display: inline-flex !important;
  gap: 6px;
}

.event-type .material-icons {
  color: #2563eb;
  font-size: 18px;
  height: 18px;
  width: 18px;
}

.empty-state {
  align-items: center;
  color: #98a2b3;
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 44px 16px;
  text-align: center;
}

.empty-state .material-icons {
  color: #98a2b3;
  font-size: 36px;
  height: 36px;
  width: 36px;
}

.empty-state h2 {
  font-size: 15px;
  line-height: 22px;
  margin: 0;
}

.empty-state p {
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  margin: 0;
}

.row-action {
  font-size: 11px;
  min-height: 30px;
}

.evidence-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 20px;
}

.evidence-panel {
  margin-top: 0;
}

.section-heading.compact {
  margin-bottom: 14px;
}

.evidence-list {
  display: grid;
  gap: 10px;
}

.evidence-row {
  align-items: flex-start;
  border-top: 1px solid #ebeef2;
  display: flex;
  gap: 10px;
  padding: 11px 0 0;
}

.evidence-row:first-child {
  border-top: 0;
  padding-top: 0;
}

.evidence-row .material-icons {
  color: #2563eb;
  flex: 0 0 auto;
}

.evidence-row strong,
.evidence-row span {
  display: block;
}

.evidence-row strong {
  color: #323c4d;
  font-size: 12px;
  font-weight: 800;
}

.evidence-row span {
  color: #98a2b3;
  font-size: 11px;
  font-weight: 800;
  margin-top: 3px;
}

.inline-pill {
  display: inline-flex !important;
  margin: 0;
  vertical-align: middle;
}

.compact-empty {
  min-height: 160px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 980px) {
  .page-heading,
  .filter-card,
  .filter-card.two-columns,
  .filter-card.three-columns,
  .filter-card.four-columns {
    display: grid;
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .evidence-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
