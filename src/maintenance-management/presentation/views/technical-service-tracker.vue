<script setup>
import {computed, onMounted, reactive, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import useMaintenanceManagementStore from '@/maintenance-management/application/maintenance-management.store.js';
import {AssetStatus} from '@/asset-management/domain/model/asset-status.js';
import {TechnicalServiceStatus} from '@/maintenance-management/domain/model/technical-service-status.js';
import {TechnicalServiceRequest} from '@/maintenance-management/domain/model/technical-service-request-entity.js';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';

const {t} = useI18n();
const identityAccessStore = useIdentityAccessStore();
const assetManagementStore = useAssetManagementStore();
const maintenanceStore = useMaintenanceManagementStore();
const today = localDateValue(new Date());
const pageLoading = ref(false);
const saving = ref(false);
const requestSubmitted = ref(false);
const closureSubmitted = ref(false);
const feedback = ref('idle');
const currentPage = ref(1);
const pageSize = 10;
const serviceRequestForm = reactive({
    assetId: 0,
    priority: 'medium',
    issueDescription: '',
});
const closureForm = reactive({
    requestId: 0,
    interventionNotes: '',
    resultNotes: '',
    functionalTestPassed: true,
});

const loading = computed(() => pageLoading.value || saving.value);
const activeOrganizationId = computed(() => identityAccessStore.currentOrganizationIdFrom());
const activeOrganizationName = computed(() => identityAccessStore.currentOrganizationNameFrom());
const canManageTechnicalService = computed(() => identityAccessStore.canManageAssets());
const organizationAssets = computed(() =>
    assetManagementStore.assetsForOrganization(activeOrganizationId.value),
);
const serviceEligibleAssets = computed(() =>
    organizationAssets.value.filter(asset =>
        asset.status === AssetStatus.Active || asset.status === AssetStatus.Maintenance,
    ),
);
const organizationRequests = computed(() =>
    maintenanceStore.technicalServicesForOrganization(activeOrganizationId.value)
        .sort((left, right) => right.requestedDate.localeCompare(left.requestedDate)),
);
const paginatedRequests = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    return organizationRequests.value.slice(start, start + pageSize);
});
const openRequests = computed(() =>
    organizationRequests.value.filter(request => maintenanceStore.isOpenTechnicalService(request)),
);
const pendingReviewRequests = computed(() =>
    organizationRequests.value.filter(request => request.status === TechnicalServiceStatus.PendingReview),
);
const closedRequests = computed(() =>
    organizationRequests.value.filter(request => request.status === TechnicalServiceStatus.Closed),
);

watch(organizationRequests, () => {
    const maxPage = Math.max(1, Math.ceil(organizationRequests.value.length / pageSize));
    if (currentPage.value > maxPage) currentPage.value = maxPage;
});

watch(openRequests, () => {
    if (!openRequests.value.some(request => request.id === Number(closureForm.requestId))) {
        closureForm.requestId = openRequests.value[0]?.id ?? 0;
    }
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
            maintenanceStore.fetchTechnicalServiceRequests(organizationId),
        ]);
        resetRequestForm();
        resetClosureForm();
    } catch {
        feedback.value = 'server-error';
    } finally {
        pageLoading.value = false;
    }
}

/**
 * Handles request technical service behavior in the maintenance management context.
 *
 * @returns {Promise<*>}
 */
async function requestTechnicalService() {
    requestSubmitted.value = true;
    feedback.value = 'idle';

    if (!canManageTechnicalService.value) {
        feedback.value = 'access-denied';
        return;
    }

    if (isRequestFormInvalid()) {
        feedback.value = 'invalid';
        return;
    }

    const organizationId = activeOrganizationId.value;
    const assetId = Number(serviceRequestForm.assetId);
    const asset = serviceEligibleAssets.value.find(currentAsset => currentAsset.id === assetId);

    if (!organizationId || !asset) {
        feedback.value = 'invalid-asset';
        return;
    }

    const nextRequestId = maintenanceStore.nextTechnicalServiceRequestId();
    const technicalServiceRequest = new TechnicalServiceRequest({
        id: nextRequestId,
        organizationId,
        uuid: generatedServiceUuid(nextRequestId),
        assetId,
        priority: serviceRequestForm.priority,
        issueDescription: serviceRequestForm.issueDescription.trim(),
        requestedDate: today,
        status: TechnicalServiceStatus.Open,
        interventionNotes: null,
        resultNotes: null,
        functionalTestPassed: null,
        closedAt: null,
        requestedBy: identityAccessStore.currentUserNameFrom(),
    });

    saving.value = true;
    try {
        const createdRequest = await maintenanceStore.createTechnicalServiceRequest(technicalServiceRequest);
        feedback.value = 'request-created';
        requestSubmitted.value = false;
        resetRequestForm();
        resetClosureForm(createdRequest.id);
    } catch {
        feedback.value = 'server-error';
    } finally {
        saving.value = false;
    }
}

/**
 * Handles close technical service behavior in the maintenance management context.
 *
 * @returns {Promise<*>}
 */
async function closeTechnicalService() {
    closureSubmitted.value = true;
    feedback.value = 'idle';

    if (!canManageTechnicalService.value) {
        feedback.value = 'access-denied';
        return;
    }

    if (isClosureFormInvalid()) {
        feedback.value = 'missing-evidence';
        return;
    }

    const requestId = Number(closureForm.requestId);
    const request = openRequests.value.find(currentRequest => currentRequest.id === requestId);

    if (!request) {
        feedback.value = 'invalid';
        return;
    }

    const functionalTestPassed = Boolean(closureForm.functionalTestPassed);
    const nextStatus = functionalTestPassed
        ? TechnicalServiceStatus.Closed
        : TechnicalServiceStatus.PendingReview;
    const closedBy = functionalTestPassed ? identityAccessStore.currentUserNameFrom() : null;
    const updatedRequest = new TechnicalServiceRequest({
        id: request.id,
        organizationId: request.organizationId,
        uuid: request.uuid,
        assetId: request.assetId,
        priority: request.priority,
        issueDescription: request.issueDescription,
        requestedDate: request.requestedDate,
        status: nextStatus,
        interventionNotes: closureForm.interventionNotes.trim(),
        resultNotes: closureForm.resultNotes.trim(),
        functionalTestPassed,
        closedAt: functionalTestPassed ? today : null,
        assetLocationId: request.assetLocationId,
        assetName: request.assetName,
        incidentId: request.incidentId,
        requestedBy: request.requestedBy,
        closedBy,
    });

    saving.value = true;
    try {
        await maintenanceStore.updateTechnicalServiceRequest(updatedRequest);
        feedback.value = functionalTestPassed ? 'closed' : 'failed-test';
        closureSubmitted.value = false;
        resetClosureForm();
    } catch {
        feedback.value = 'server-error';
    } finally {
        saving.value = false;
    }
}

/**
 * Resets request form to its default state.
 *
 * @returns {void}
 */
function resetRequestForm() {
    const firstAsset = serviceEligibleAssets.value[0];

    requestSubmitted.value = false;
    serviceRequestForm.assetId = firstAsset?.id ?? 0;
    serviceRequestForm.priority = 'medium';
    serviceRequestForm.issueDescription = '';
}

/**
 * Resets closure form to its default state.
 *
 * @param {number|string} requestId
 * @returns {void}
 */
function resetClosureForm(requestId = 0) {
    closureSubmitted.value = false;
    closureForm.requestId = requestId || openRequests.value[0]?.id || 0;
    closureForm.interventionNotes = '';
    closureForm.resultNotes = '';
    closureForm.functionalTestPassed = true;
}

/**
 * Determines whether request control error exists.
 *
 * @param {*} controlName
 * @returns {boolean}
 */
function hasRequestControlError(controlName) {
    if (!requestSubmitted.value) return false;
    if (controlName === 'assetId') return Number(serviceRequestForm.assetId) <= 0;
    if (controlName === 'issueDescription') return serviceRequestForm.issueDescription.trim().length < 8;
    if (controlName === 'priority') return !serviceRequestForm.priority;
    return false;
}

/**
 * Determines whether closure control error exists.
 *
 * @param {*} controlName
 * @returns {boolean}
 */
function hasClosureControlError(controlName) {
    if (!closureSubmitted.value) return false;
    if (controlName === 'requestId') return Number(closureForm.requestId) <= 0;
    if (controlName === 'interventionNotes') return closureForm.interventionNotes.trim().length < 8;
    if (controlName === 'resultNotes') return closureForm.resultNotes.trim().length < 8;
    return false;
}

/**
 * Handles asset name for behavior in the maintenance management context.
 *
 * @param {number|string} assetId
 * @returns {string}
 */
function assetNameFor(assetId) {
    const asset = organizationAssets.value.find(currentAsset => currentAsset.id === Number(assetId));
    return asset ? `${asset.uuid} - ${asset.name}` : `#${assetId}`;
}

/**
 * Handles asset location for behavior in the maintenance management context.
 *
 * @param {number|string} assetId
 * @returns {string}
 */
function assetLocationFor(assetId) {
    const asset = organizationAssets.value.find(currentAsset => currentAsset.id === Number(assetId));
    return asset ? assetManagementStore.locationForAsset(asset) : 'N/A';
}

/**
 * Handles priority key behavior in the maintenance management context.
 *
 * @param {*} priority
 * @returns {string}
 */
function priorityKey(priority) {
    return `maintenance.technical-service.priority.${priority}`;
}

/**
 * Handles request status key behavior in the maintenance management context.
 *
 * @param {string} status
 * @returns {string}
 */
function requestStatusKey(status) {
    return `maintenance.technical-service.status.${status}`;
}

/**
 * Returns the CSS class for request status.
 *
 * @param {string} status
 * @returns {string}
 */
function requestStatusClass(status) {
    const classByStatus = {
        [TechnicalServiceStatus.Open]: 'status-observation',
        [TechnicalServiceStatus.PendingReview]: 'status-insufficient',
        [TechnicalServiceStatus.Closed]: 'status-compliant',
    };
    return classByStatus[status];
}

/**
 * Handles result label for behavior in the maintenance management context.
 *
 * @param {*} request
 * @returns {string}
 */
function resultLabelFor(request) {
    if (request.functionalTestPassed === null) {
        return 'maintenance.technical-service.table.pending-result';
    }

    return request.functionalTestPassed
        ? 'maintenance.technical-service.table.test-passed'
        : 'maintenance.technical-service.table.test-failed';
}

/**
 * Determines whether request form invalid is true.
 *
 * @returns {boolean}
 */
function isRequestFormInvalid() {
    return Number(serviceRequestForm.assetId) <= 0 ||
        !serviceRequestForm.priority ||
        serviceRequestForm.issueDescription.trim().length < 8;
}

/**
 * Determines whether closure form invalid is true.
 *
 * @returns {boolean}
 */
function isClosureFormInvalid() {
    return Number(closureForm.requestId) <= 0 ||
        closureForm.interventionNotes.trim().length < 8 ||
        closureForm.resultNotes.trim().length < 8;
}

/**
 * Generates d service uuid for the current workflow.
 *
 * @param {number|string} requestId
 * @returns {number}
 */
function generatedServiceUuid(requestId) {
    return `TS-${requestId.toString().padStart(3, '0')}`;
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
  <section class="page" aria-labelledby="technical-service-title">
    <div v-if="loading" class="loading-overlay">
      <span class="loading-spinner"></span>
    </div>

    <div class="page-heading">
      <div>
        <span class="section-kicker">{{ activeOrganizationName }}</span>
        <h1 id="technical-service-title">
          {{ t('maintenance.technical-service.title') }}
        </h1>
        <p>{{ t('maintenance.technical-service.subtitle') }}</p>
      </div>

      <div class="heading-actions">
        <button type="button" class="secondary-action" @click="loadPageData">
          <span class="material-icons" aria-hidden="true">refresh</span>
          {{ t('maintenance.technical-service.reload') }}
        </button>
      </div>
    </div>

    <p v-if="feedback === 'request-created'" class="feedback success">{{ t('maintenance.technical-service.feedback-request-created') }}</p>
    <p v-if="feedback === 'closed'" class="feedback success">{{ t('maintenance.technical-service.feedback-closed') }}</p>
    <p v-if="feedback === 'failed-test'" class="feedback warning">{{ t('maintenance.technical-service.feedback-failed-test') }}</p>
    <p v-if="feedback === 'invalid'" class="feedback warning">{{ t('maintenance.technical-service.feedback-invalid') }}</p>
    <p v-if="feedback === 'invalid-asset'" class="feedback warning">{{ t('maintenance.technical-service.feedback-invalid-asset') }}</p>
    <p v-if="feedback === 'missing-evidence'" class="feedback warning">{{ t('maintenance.technical-service.feedback-missing-evidence') }}</p>
    <p v-if="feedback === 'access-denied'" class="feedback warning">{{ t('maintenance.technical-service.feedback-access-denied') }}</p>
    <p v-if="feedback === 'server-error'" class="feedback error">{{ t('maintenance.technical-service.feedback-error') }}</p>

    <section v-if="!canManageTechnicalService && !pageLoading" class="access-banner" aria-live="polite">
      <span class="material-icons" aria-hidden="true">lock</span>
      <div>
        <h2>{{ t('maintenance.technical-service.access-title') }}</h2>
        <p>{{ t('maintenance.technical-service.access-description') }}</p>
      </div>
    </section>

    <section class="summary-grid" aria-label="Technical service summary">
      <article class="summary-card accent-blue">
        <span>{{ t('maintenance.technical-service.summary-assets') }}</span>
        <strong>{{ serviceEligibleAssets.length }}</strong>
      </article>
      <article class="summary-card accent-amber">
        <span>{{ t('maintenance.technical-service.summary-open') }}</span>
        <strong>{{ openRequests.length }}</strong>
      </article>
      <article class="summary-card accent-red">
        <span>{{ t('maintenance.technical-service.summary-pending-review') }}</span>
        <strong>{{ pendingReviewRequests.length }}</strong>
      </article>
      <article class="summary-card accent-green">
        <span>{{ t('maintenance.technical-service.summary-closed') }}</span>
        <strong>{{ closedRequests.length }}</strong>
      </article>
    </section>

    <section class="forms-grid">
      <section class="table-card service-card" aria-labelledby="technical-request-title">
        <div class="section-heading">
          <div>
            <h2 id="technical-request-title">
              {{ t('maintenance.technical-service.request-title') }}
            </h2>
            <p>{{ t('maintenance.technical-service.request-subtitle') }}</p>
          </div>

          <button type="button" class="secondary-action" :disabled="saving" @click="resetRequestForm">
            <span class="material-icons" aria-hidden="true">restart_alt</span>
            {{ t('maintenance.technical-service.reset') }}
          </button>
        </div>

        <form class="service-form" @submit.prevent="requestTechnicalService">
          <label class="filter-field">
            <span>{{ t('maintenance.technical-service.form.asset') }}</span>
            <select v-model.number="serviceRequestForm.assetId">
              <option :value="0">{{ t('maintenance.technical-service.form.select-asset') }}</option>
              <option v-for="asset in serviceEligibleAssets" :key="asset.id" :value="asset.id">
                {{ asset.uuid }} - {{ asset.name }}
              </option>
            </select>
            <small v-if="hasRequestControlError('assetId')">{{ t('maintenance.technical-service.form.asset-error') }}</small>
          </label>

          <label class="filter-field">
            <span>{{ t('maintenance.technical-service.form.priority') }}</span>
            <select v-model="serviceRequestForm.priority">
              <option value="low">{{ t('maintenance.technical-service.priority.low') }}</option>
              <option value="medium">{{ t('maintenance.technical-service.priority.medium') }}</option>
              <option value="high">{{ t('maintenance.technical-service.priority.high') }}</option>
              <option value="critical">{{ t('maintenance.technical-service.priority.critical') }}</option>
            </select>
          </label>

          <label class="filter-field">
            <span>{{ t('maintenance.technical-service.form.issue') }}</span>
            <textarea
              v-model="serviceRequestForm.issueDescription"
              rows="4"
              :placeholder="t('maintenance.technical-service.form.issue-placeholder')"
            ></textarea>
            <small v-if="hasRequestControlError('issueDescription')">{{ t('maintenance.technical-service.form.issue-error') }}</small>
          </label>

          <button type="submit" class="primary-action" :disabled="saving || !canManageTechnicalService">
            <span class="material-icons" aria-hidden="true">build_circle</span>
            {{ t('maintenance.technical-service.create-request') }}
          </button>
        </form>
      </section>

      <section class="table-card service-card" aria-labelledby="technical-closure-title">
        <div class="section-heading">
          <div>
            <h2 id="technical-closure-title">
              {{ t('maintenance.technical-service.closure-title') }}
            </h2>
            <p>{{ t('maintenance.technical-service.closure-subtitle') }}</p>
          </div>

          <button type="button" class="secondary-action" :disabled="saving" @click="resetClosureForm()">
            <span class="material-icons" aria-hidden="true">restart_alt</span>
            {{ t('maintenance.technical-service.reset') }}
          </button>
        </div>

        <form class="service-form" @submit.prevent="closeTechnicalService">
          <label class="filter-field">
            <span>{{ t('maintenance.technical-service.form.open-request') }}</span>
            <select v-model.number="closureForm.requestId">
              <option :value="0">{{ t('maintenance.technical-service.form.select-request') }}</option>
              <option v-for="request in openRequests" :key="request.id" :value="request.id">
                {{ request.uuid }} - {{ assetNameFor(request.assetId) }}
              </option>
            </select>
            <small v-if="hasClosureControlError('requestId')">{{ t('maintenance.technical-service.form.request-error') }}</small>
          </label>

          <label class="filter-field">
            <span>{{ t('maintenance.technical-service.form.intervention') }}</span>
            <textarea
              v-model="closureForm.interventionNotes"
              rows="3"
              :placeholder="t('maintenance.technical-service.form.intervention-placeholder')"
            ></textarea>
            <small v-if="hasClosureControlError('interventionNotes')">{{ t('maintenance.technical-service.form.intervention-error') }}</small>
          </label>

          <label class="filter-field">
            <span>{{ t('maintenance.technical-service.form.result') }}</span>
            <textarea
              v-model="closureForm.resultNotes"
              rows="3"
              :placeholder="t('maintenance.technical-service.form.result-placeholder')"
            ></textarea>
            <small v-if="hasClosureControlError('resultNotes')">{{ t('maintenance.technical-service.form.result-error') }}</small>
          </label>

          <label class="checkbox-field">
            <input v-model="closureForm.functionalTestPassed" type="checkbox" />
            <span>{{ t('maintenance.technical-service.form.functional-test-passed') }}</span>
          </label>

          <button
            type="submit"
            class="primary-action"
            :disabled="saving || !canManageTechnicalService || !openRequests.length"
          >
            <span class="material-icons" aria-hidden="true">task_alt</span>
            {{ t('maintenance.technical-service.close-request') }}
          </button>
        </form>
      </section>
    </section>

    <section class="table-card" aria-labelledby="technical-service-list-title">
      <div class="section-heading">
        <div>
          <h2 id="technical-service-list-title">
            {{ t('maintenance.technical-service.table-title') }}
          </h2>
          <p>{{ t('maintenance.technical-service.table-subtitle') }}</p>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('maintenance.technical-service.table.id') }}</th>
              <th>{{ t('maintenance.technical-service.table.asset') }}</th>
              <th>{{ t('maintenance.technical-service.table.priority') }}</th>
              <th>{{ t('maintenance.technical-service.table.issue') }}</th>
              <th>{{ t('maintenance.technical-service.table.result') }}</th>
              <th>{{ t('maintenance.technical-service.table.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in paginatedRequests" :key="request.id">
              <td>
                <strong>{{ request.uuid }}</strong>
                <small>{{ request.requestedDate }}</small>
              </td>
              <td>
                <strong>{{ assetNameFor(request.assetId) }}</strong>
                <small>{{ assetLocationFor(request.assetId) }}</small>
              </td>
              <td>{{ t(priorityKey(request.priority)) }}</td>
              <td>{{ request.issueDescription }}</td>
              <td>
                <strong>{{ t(resultLabelFor(request)) }}</strong>
                <small>{{ request.resultNotes || 'N/A' }}</small>
              </td>
              <td>
                <span class="status-pill" :class="requestStatusClass(request.status)">
                  {{ t(requestStatusKey(request.status)) }}
                </span>
              </td>
            </tr>
            <tr v-if="organizationRequests.length === 0">
              <td colspan="6" class="empty-state">
                {{ t('maintenance.technical-service.empty') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <list-pagination
        v-model="currentPage"
        :total="organizationRequests.length"
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

.forms-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 20px;
  max-width: 1180px;
}

.service-card,
.service-form {
  display: grid;
  gap: 16px;
}

.service-form .primary-action {
  justify-self: start;
  min-width: 190px;
}

.checkbox-field {
  align-items: center;
  color: #404040;
  display: flex;
  font-size: 12px;
  font-weight: 800;
  gap: 8px;
}

.checkbox-field input {
  accent-color: #2563eb;
  height: 16px;
  width: 16px;
}

.data-table {
  min-width: 1160px;
}

@media (max-width: 1080px) {
  .forms-grid {
    grid-template-columns: 1fr;
  }
}
</style>
