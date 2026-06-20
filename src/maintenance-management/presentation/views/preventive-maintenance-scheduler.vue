<script setup>
import {computed, onMounted, reactive, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import useMaintenanceManagementStore from '@/maintenance-management/application/maintenance-management.store.js';
import {AssetStatus} from '@/asset-management/domain/model/asset-status.js';
import {MaintenanceScheduleStatus} from '@/maintenance-management/domain/model/maintenance-schedule-status.js';
import {MaintenanceSchedule} from '@/maintenance-management/domain/model/maintenance-schedule-entity.js';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';

const {t} = useI18n();
const identityAccessStore = useIdentityAccessStore();
const assetManagementStore = useAssetManagementStore();
const maintenanceStore = useMaintenanceManagementStore();
const today = localDateValue(new Date());
const pageLoading = ref(false);
const saving = ref(false);
const submitted = ref(false);
const feedback = ref('idle');
const currentPage = ref(1);
const pageSize = 10;
const maintenanceForm = reactive({
    assetId: 0,
    iotDeviceId: 0,
    scheduledDate: today,
    observations: '',
});

const loading = computed(() => pageLoading.value || saving.value);
const activeOrganizationId = computed(() => identityAccessStore.currentOrganizationIdFrom());
const activeOrganizationName = computed(() => identityAccessStore.currentOrganizationNameFrom());
const canScheduleMaintenance = computed(() => identityAccessStore.canManageAssets());
const organizationAssets = computed(() =>
    assetManagementStore.assetsForOrganization(activeOrganizationId.value),
);
const organizationIoTDevices = computed(() =>
    assetManagementStore.iotDevicesForOrganization(activeOrganizationId.value),
);
const organizationSchedules = computed(() =>
    maintenanceStore.schedulesForOrganization(activeOrganizationId.value)
        .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate)),
);
const paginatedSchedules = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    return organizationSchedules.value.slice(start, start + pageSize);
});
const openSchedules = computed(() =>
    organizationSchedules.value.filter(schedule => maintenanceStore.isOpenSchedule(schedule)),
);
const trackedAssetsCount = computed(() => new Set(openSchedules.value.map(schedule => schedule.assetId)).size);
const selectedAssetDevices = computed(() =>
    assetManagementStore.iotDevicesForAsset(Number(maintenanceForm.assetId), organizationIoTDevices.value),
);

watch(organizationSchedules, () => {
    const maxPage = Math.max(1, Math.ceil(organizationSchedules.value.length / pageSize));
    if (currentPage.value > maxPage) currentPage.value = maxPage;
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
        await identityAccessStore.fetchAccessData();
        const organizationId = activeOrganizationId.value;
        await Promise.all([
            assetManagementStore.fetchAssetManagementData({organizationId, includeSettings: false}),
            maintenanceStore.fetchMaintenanceSchedules(organizationId),
        ]);
        resetScheduleForm();
    } catch {
        feedback.value = 'server-error';
    } finally {
        pageLoading.value = false;
    }
}

/**
 * Selects asset in the current view state.
 *
 * @returns {void}
 */
function selectAsset() {
    maintenanceForm.iotDeviceId = 0;
    feedback.value = 'idle';
    submitted.value = false;
}

/**
 * Handles schedule preventive maintenance behavior in the maintenance management context.
 *
 * @returns {Promise<*>}
 */
async function schedulePreventiveMaintenance() {
    submitted.value = true;
    feedback.value = 'idle';

    if (!canScheduleMaintenance.value) {
        feedback.value = 'access-denied';
        return;
    }

    if (isFormInvalid() || isPastDate()) {
        feedback.value = 'invalid';
        return;
    }

    const organizationId = activeOrganizationId.value;
    const assetId = Number(maintenanceForm.assetId);
    const asset = assetFor(assetId);
    const period = periodFor(maintenanceForm.scheduledDate);

    if (!organizationId || !asset || asset.status !== AssetStatus.Active) {
        feedback.value = 'invalid-asset';
        return;
    }

    if (hasOpenScheduleForAssetPeriod(assetId, period)) {
        feedback.value = 'duplicate';
        return;
    }

    const nextScheduleId = maintenanceStore.nextScheduleId();
    const nextSchedule = new MaintenanceSchedule({
        id: nextScheduleId,
        organizationId,
        uuid: generatedScheduleUuid(nextScheduleId),
        assetId,
        iotDeviceId: Number(maintenanceForm.iotDeviceId) || null,
        scheduledDate: maintenanceForm.scheduledDate,
        period,
        observations: maintenanceForm.observations.trim(),
        status: MaintenanceScheduleStatus.Scheduled,
        createdAt: today,
    });

    saving.value = true;
    try {
        await maintenanceStore.createMaintenanceSchedule(nextSchedule);
        feedback.value = 'scheduled';
        submitted.value = false;
        resetScheduleForm();
    } catch {
        feedback.value = 'server-error';
    } finally {
        saving.value = false;
    }
}

/**
 * Resets schedule form to its default state.
 *
 * @returns {void}
 */
function resetScheduleForm() {
    const firstActiveAsset = organizationAssets.value.find(asset => asset.status === AssetStatus.Active);

    feedback.value = 'idle';
    submitted.value = false;
    maintenanceForm.assetId = firstActiveAsset?.id ?? 0;
    maintenanceForm.iotDeviceId = 0;
    maintenanceForm.scheduledDate = today;
    maintenanceForm.observations = '';
}

/**
 * Determines whether control error exists.
 *
 * @param {*} controlName
 * @returns {boolean}
 */
function hasControlError(controlName) {
    if (!submitted.value) return false;
    if (controlName === 'assetId') return Number(maintenanceForm.assetId) <= 0;
    if (controlName === 'observations') return maintenanceForm.observations.trim().length < 6;
    if (controlName === 'scheduledDate') return !maintenanceForm.scheduledDate;
    return false;
}

/**
 * Determines whether date error exists.
 *
 * @returns {boolean}
 */
function hasDateError() {
    return hasControlError('scheduledDate') || (submitted.value && isPastDate());
}

/**
 * Handles asset name for behavior in the maintenance management context.
 *
 * @param {*} schedule
 * @returns {string}
 */
function assetNameFor(schedule) {
    const asset = assetFor(schedule.assetId);
    return asset ? `${asset.uuid} - ${asset.name}` : `#${schedule.assetId}`;
}

/**
 * Handles device name for behavior in the maintenance management context.
 *
 * @param {*} schedule
 * @returns {string}
 */
function deviceNameFor(schedule) {
    if (!schedule.iotDeviceId) return 'maintenance.preventive.table.asset-level';
    const iotDevice = organizationIoTDevices.value.find(currentDevice => currentDevice.id === schedule.iotDeviceId);
    return iotDevice ? `${iotDevice.uuid} - ${iotDevice.model}` : `#${schedule.iotDeviceId}`;
}

/**
 * Handles asset location for behavior in the maintenance management context.
 *
 * @param {*} schedule
 * @returns {string}
 */
function assetLocationFor(schedule) {
    const asset = assetFor(schedule.assetId);
    return asset ? assetManagementStore.locationForAsset(asset) : 'N/A';
}

/**
 * Handles schedule status key behavior in the maintenance management context.
 *
 * @param {string} status
 * @returns {string}
 */
function scheduleStatusKey(status) {
    return `maintenance.preventive.status.${status}`;
}

/**
 * Returns the CSS class for schedule status.
 *
 * @param {string} status
 * @returns {string}
 */
function scheduleStatusClass(status) {
    const classByStatus = {
        [MaintenanceScheduleStatus.Scheduled]: 'status-observation',
        [MaintenanceScheduleStatus.Pending]: 'status-warning',
        [MaintenanceScheduleStatus.Completed]: 'status-compliant',
        [MaintenanceScheduleStatus.Canceled]: 'status-danger',
    };
    return classByStatus[status];
}

/**
 * Handles asset for behavior in the maintenance management context.
 *
 * @param {number|string} assetId
 * @returns {*}
 */
function assetFor(assetId) {
    return organizationAssets.value.find(asset => asset.id === Number(assetId));
}

/**
 * Determines whether past date is true.
 *
 * @returns {boolean}
 */
function isPastDate() {
    return maintenanceForm.scheduledDate < today;
}

/**
 * Determines whether form invalid is true.
 *
 * @returns {boolean}
 */
function isFormInvalid() {
    return Number(maintenanceForm.assetId) <= 0 ||
        !maintenanceForm.scheduledDate ||
        maintenanceForm.observations.trim().length < 6;
}

/**
 * Handles period for behavior in the maintenance management context.
 *
 * @param {string} dateValue
 * @returns {*}
 */
function periodFor(dateValue) {
    return dateValue.slice(0, 7);
}

/**
 * Determines whether open schedule for asset period exists.
 *
 * @param {number|string} assetId
 * @param {*} period
 * @returns {boolean}
 */
function hasOpenScheduleForAssetPeriod(assetId, period) {
    return maintenanceStore.hasOpenScheduleForAssetPeriod(activeOrganizationId.value, assetId, period);
}

/**
 * Generates d schedule uuid for the current workflow.
 *
 * @param {number|string} scheduleId
 * @returns {number}
 */
function generatedScheduleUuid(scheduleId) {
    return `PM-${scheduleId.toString().padStart(3, '0')}`;
}

/**
 * Handles local date value behavior in the maintenance management context.
 *
 * @param {string} date
 * @returns {string}
 */
function localDateValue(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}
</script>

<template>
  <section class="page" aria-labelledby="preventive-maintenance-title">
    <div v-if="loading" class="loading-overlay">
      <span class="loading-spinner"></span>
    </div>

    <div class="page-heading">
      <div>
        <span class="section-kicker">{{ activeOrganizationName }}</span>
        <h1 id="preventive-maintenance-title">
          {{ t('maintenance.preventive.title') }}
        </h1>
        <p>{{ t('maintenance.preventive.subtitle') }}</p>
      </div>

      <div class="heading-actions">
        <button type="button" class="secondary-action" @click="loadPageData">
          <span class="material-icons" aria-hidden="true">refresh</span>
          {{ t('maintenance.preventive.reload') }}
        </button>
      </div>
    </div>

    <p v-if="feedback === 'scheduled'" class="feedback success">{{ t('maintenance.preventive.feedback-scheduled') }}</p>
    <p v-if="feedback === 'invalid'" class="feedback warning">{{ t('maintenance.preventive.feedback-invalid') }}</p>
    <p v-if="feedback === 'invalid-asset'" class="feedback warning">{{ t('maintenance.preventive.feedback-invalid-asset') }}</p>
    <p v-if="feedback === 'duplicate'" class="feedback warning">{{ t('maintenance.preventive.feedback-duplicate') }}</p>
    <p v-if="feedback === 'access-denied'" class="feedback warning">{{ t('maintenance.preventive.feedback-access-denied') }}</p>
    <p v-if="feedback === 'server-error'" class="feedback error">{{ t('maintenance.preventive.feedback-error') }}</p>

    <section v-if="!canScheduleMaintenance && !pageLoading" class="access-banner" aria-live="polite">
      <span class="material-icons" aria-hidden="true">lock</span>
      <div>
        <h2>{{ t('maintenance.preventive.access-title') }}</h2>
        <p>{{ t('maintenance.preventive.access-description') }}</p>
      </div>
    </section>

    <section class="summary-grid" aria-label="Preventive maintenance summary">
      <article class="summary-card accent-blue">
        <span>{{ t('maintenance.preventive.summary-assets') }}</span>
        <strong>{{ organizationAssets.length }}</strong>
      </article>
      <article class="summary-card accent-green">
        <span>{{ t('maintenance.preventive.summary-open') }}</span>
        <strong>{{ openSchedules.length }}</strong>
      </article>
      <article class="summary-card accent-amber">
        <span>{{ t('maintenance.preventive.summary-tracked') }}</span>
        <strong>{{ trackedAssetsCount }}</strong>
      </article>
      <article class="summary-card accent-red">
        <span>{{ t('maintenance.preventive.summary-devices') }}</span>
        <strong>{{ organizationIoTDevices.length }}</strong>
      </article>
    </section>

    <section class="table-card scheduler-card" aria-labelledby="maintenance-form-title">
      <div class="section-heading">
        <div>
          <h2 id="maintenance-form-title">{{ t('maintenance.preventive.form-title') }}</h2>
          <p>{{ t('maintenance.preventive.form-subtitle') }}</p>
        </div>

        <button type="button" class="secondary-action" :disabled="saving" @click="resetScheduleForm">
          <span class="material-icons" aria-hidden="true">restart_alt</span>
          {{ t('maintenance.preventive.reset') }}
        </button>
      </div>

      <form class="maintenance-form" @submit.prevent="schedulePreventiveMaintenance">
        <div class="form-grid">
          <label class="filter-field">
            <span>{{ t('maintenance.preventive.form.asset') }}</span>
            <select v-model.number="maintenanceForm.assetId" @change="selectAsset">
              <option :value="0">{{ t('maintenance.preventive.form.select-asset') }}</option>
              <option v-for="asset in organizationAssets" :key="asset.id" :value="asset.id">
                {{ asset.uuid }} - {{ asset.name }}
              </option>
            </select>
            <small v-if="hasControlError('assetId')">{{ t('maintenance.preventive.form.asset-error') }}</small>
          </label>

          <label class="filter-field">
            <span>{{ t('maintenance.preventive.form.device') }}</span>
            <select v-model.number="maintenanceForm.iotDeviceId">
              <option :value="0">{{ t('maintenance.preventive.form.asset-level') }}</option>
              <option v-for="iotDevice in selectedAssetDevices" :key="iotDevice.id" :value="iotDevice.id">
                {{ iotDevice.uuid }} - {{ iotDevice.model }}
              </option>
            </select>
          </label>

          <label class="filter-field">
            <span>{{ t('maintenance.preventive.form.date') }}</span>
            <input v-model="maintenanceForm.scheduledDate" type="date" :min="today" />
            <small v-if="hasDateError()">{{ t('maintenance.preventive.form.date-error') }}</small>
          </label>

          <label class="filter-field full">
            <span>{{ t('maintenance.preventive.form.observations') }}</span>
            <textarea
              v-model="maintenanceForm.observations"
              rows="3"
              :placeholder="t('maintenance.preventive.form.observations-placeholder')"
            ></textarea>
            <small v-if="hasControlError('observations')">{{ t('maintenance.preventive.form.observations-error') }}</small>
          </label>

          <div class="save-actions">
            <button type="submit" class="primary-action" :disabled="saving || !canScheduleMaintenance">
              <span class="material-icons" aria-hidden="true">event_available</span>
              {{ t(saving ? 'maintenance.preventive.saving' : 'maintenance.preventive.save') }}
            </button>
          </div>
        </div>
      </form>
    </section>

    <section class="table-card" aria-labelledby="maintenance-schedules-title">
      <div class="section-heading">
        <div>
          <h2 id="maintenance-schedules-title">
            {{ t('maintenance.preventive.table-title') }}
          </h2>
          <p>{{ t('maintenance.preventive.table-subtitle') }}</p>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('maintenance.preventive.table.id') }}</th>
              <th>{{ t('maintenance.preventive.table.asset') }}</th>
              <th>{{ t('maintenance.preventive.table.device') }}</th>
              <th>{{ t('maintenance.preventive.table.location') }}</th>
              <th>{{ t('maintenance.preventive.table.date') }}</th>
              <th>{{ t('maintenance.preventive.table.period') }}</th>
              <th>{{ t('maintenance.preventive.table.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="schedule in paginatedSchedules" :key="schedule.id">
              <td>{{ schedule.uuid }}</td>
              <td>{{ assetNameFor(schedule) }}</td>
              <td>
                <template v-if="schedule.iotDeviceId">{{ deviceNameFor(schedule) }}</template>
                <template v-else>{{ t(deviceNameFor(schedule)) }}</template>
              </td>
              <td>{{ assetLocationFor(schedule) }}</td>
              <td>{{ schedule.scheduledDate }}</td>
              <td>{{ schedule.period }}</td>
              <td>
                <span class="status-pill" :class="scheduleStatusClass(schedule.status)">
                  {{ t(scheduleStatusKey(schedule.status)) }}
                </span>
              </td>
            </tr>
            <tr v-if="organizationSchedules.length === 0">
              <td colspan="7" class="empty-state">
                {{ t('maintenance.preventive.empty') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <list-pagination
        v-model="currentPage"
        :total="organizationSchedules.length"
        :page-size="pageSize"
      />
    </section>
  </section>
</template>

<style scoped>
.page {
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
.access-banner {
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
  margin: 0;
}

.section-heading h2,
.observation-banner h2,
.access-banner h2 {
  color: #323c4d;
  font-size: 14px;
  font-weight: 800;
  margin: 0;
}

.page-heading p,
.section-heading p {
  color: #98a2b3;
  font-size: 12px;
  font-weight: 800;
  margin: 6px 0 0;
}

.section-kicker {
  color: #2563eb;
  display: block;
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 4px;
}

.heading-actions {
  align-items: center;
  display: flex;
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
  min-height: 36px;
  padding: 7px 12px;
}

.primary-action {
  background: #2563eb;
  border: 0;
  color: #ffffff;
}

.secondary-action {
  background: #ffffff;
  border: 1px solid #ebeef2;
  color: #606c80;
}

.primary-action:disabled,
.secondary-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-action .material-icons,
.secondary-action .material-icons {
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

.filter-field {
  display: grid;
  gap: 6px;
}

.filter-field span,
.filter-meta span,
.summary-card span,
.data-table th,
.data-table small {
  font-size: 12px;
  font-weight: 800;
}

.filter-field span,
.filter-meta span {
  color: #404040;
}

.filter-field input,
.filter-field select,
.filter-field textarea {
  background: #f4f4f4;
  border: 0;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.14);
  box-sizing: border-box;
  color: #404040;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  min-height: 38px;
  outline: none;
  padding: 9px 12px;
  width: 100%;
}

.filter-field select {
  padding-right: 34px;
}

.filter-field textarea {
  border: 1px solid #d0d5dd;
  resize: vertical;
}

.filter-field small {
  color: #b51313;
  font-size: 11px;
  font-weight: 800;
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
.data-table td span,
.data-table small {
  color: #98a2b3;
}

.summary-card strong {
  color: var(--accent-text, #2563eb);
  font-size: 24px;
  font-weight: 800;
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

.observation-banner,
.access-banner {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  padding: 14px 16px;
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

.access-banner .material-icons {
  font-size: 20px;
}

.access-banner p {
  font-weight: 700;
  margin: 3px 0 0;
}

.table-card {
  padding: 20px 24px;
}

.table-wrapper {
  margin-top: 18px;
  overflow-x: auto;
}

.data-table {
  border-collapse: collapse;
  min-width: 980px;
  width: 100%;
}

.data-table th {
  padding: 0 10px 12px;
  text-align: left;
}

.data-table td {
  border-top: 1px solid #ebeef2;
  color: #404040;
  font-size: 12px;
  font-weight: 700;
  padding: 12px 10px;
  vertical-align: top;
}

.data-table td strong {
  color: #323c4d;
  display: block;
  font-weight: 800;
}

.data-table td span,
.data-table small {
  display: block;
  font-size: 10px;
  font-weight: 800;
}

.status-pill {
  border-radius: 16px;
  display: inline-flex !important;
  padding: 3px 8px;
  white-space: nowrap;
}

.status-compliant {
  background: #eaf8f0;
  color: #176900 !important;
}

.status-observation {
  background: #fff8e8;
  color: #b16f0b !important;
}

.status-warning {
  background: #fff8e8;
  color: #b16f0b !important;
}

.status-danger,
.status-insufficient {
  background: #feeceb;
  color: #b51313 !important;
}

.empty-state {
  color: #98a2b3;
  font-weight: 800;
  text-align: center;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 980px) {
  .page-heading {
    display: grid;
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

.scheduler-card,
.maintenance-form {
  display: grid;
  gap: 18px;
}

.form-grid {
  align-items: start;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(180px, 1fr)) minmax(160px, auto);
}

.filter-field.full {
  grid-column: 1 / 4;
}

.save-actions {
  align-items: end;
  display: flex;
  min-height: 86px;
}

.save-actions .primary-action {
  min-width: 196px;
}

.data-table {
  min-width: 1040px;
}

@media (max-width: 1080px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .filter-field.full {
    grid-column: auto;
  }

  .save-actions {
    min-height: auto;
  }
}
</style>
