<script setup>
import {computed, onMounted, reactive, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import useAlertsStore from '@/alerts/application/alerts.store.js';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';

const {t} = useI18n();
const alertsStore = useAlertsStore();
const identityStore = useIdentityAccessStore();
const closureCard = ref(null);
const closureSubmitted = ref(false);
const currentPage = ref(1);
const pageSize = 10;
const closureForm = reactive({
    incidentId: 0,
    correctiveAction: '',
    closureEvidence: '',
});

const canResolveAlerts = computed(() => alertsStore.canResolveAlerts());
const profileUserName = computed(() => identityStore.currentUserNameFrom());
const activeOrganizationId = computed(() => identityStore.currentOrganizationIdFrom());
const activeIncidents = computed(() => alertsStore.organizationIncidents.filter(incident => !incident.isClosed));
const paginatedIncidents = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    return activeIncidents.value.slice(start, start + pageSize);
});
const pendingClosureIncidents = computed(() => activeIncidents.value.filter(incident => incident.isRecognized));
const selectedClosureIncident = computed(() =>
    pendingClosureIncidents.value.find(incident => incident.id === Number(closureForm.incidentId)) ?? null,
);

watch(activeIncidents, () => {
    const maxPage = Math.max(1, Math.ceil(activeIncidents.value.length / pageSize));
    if (currentPage.value > maxPage) currentPage.value = maxPage;
});

watch(pendingClosureIncidents, (pendingIncidents) => {
    const selectedStillAvailable = pendingIncidents.some(incident => incident.id === Number(closureForm.incidentId));
    if (!selectedStillAvailable) closureForm.incidentId = pendingIncidents[0]?.id ?? 0;
}, {immediate: true});

onMounted(() => {
    alertsStore.loadIncidents({organizationId: activeOrganizationId.value}).catch(() => undefined);
});

/**
 * Handles recognize behavior in the alerts context.
 *
 * @param {*} incident
 * @returns {*}
 */
function recognize(incident) {
    if (!incident.isOpen || alertsStore.recognizingId === incident.id) return;
    alertsStore.recognizeIncident(incident, profileUserName.value).catch(() => undefined);
}

/**
 * Handles close incident behavior in the alerts context.
 *
 * @returns {*}
 */
function closeIncident() {
    closureSubmitted.value = true;
    alertsStore.clearFeedback();

    if (!canResolveAlerts.value) {
        alertsStore.setFeedback('alerts.incident-list.feedback-access-denied');
        return;
    }

    if (!isClosureFormValid()) {
        alertsStore.setFeedback('alerts.incident-list.feedback-missing-evidence');
        return;
    }

    const incident = selectedClosureIncident.value;
    if (!incident) {
        alertsStore.setFeedback('alerts.incident-list.feedback-invalid-incident');
        return;
    }

    if (!incident.isConditionStable) {
        alertsStore.setFeedback('alerts.incident-list.feedback-condition-active');
        return;
    }

    alertsStore.closeIncident(
        incident,
        closureForm.correctiveAction.trim(),
        closureForm.closureEvidence.trim(),
        profileUserName.value,
    ).then(() => {
        closureSubmitted.value = false;
        closureForm.incidentId = pendingClosureIncidents.value[0]?.id ?? 0;
        closureForm.correctiveAction = '';
        closureForm.closureEvidence = '';
    }).catch(() => undefined);
}

/**
 * Handles review escalation behavior in the alerts context.
 *
 * @param {*} incident
 * @returns {*}
 */
function reviewEscalation(incident) {
    if (
        alertsStore.reviewingEscalationId === incident.id ||
        (!incident.isEscalated && !incident.isPendingEscalationConfiguration)
    ) {
        return;
    }

    alertsStore.reviewEscalation(incident, profileUserName.value).catch(() => undefined);
}

/**
 * Selects incident for closure in the current view state.
 *
 * @param {*} incident
 * @returns {void}
 */
function selectIncidentForClosure(incident) {
    if (!incident.isRecognized) return;
    closureForm.incidentId = incident.id;
    alertsStore.clearFeedback();
    queueMicrotask(() => closureCard.value?.scrollIntoView({behavior: 'smooth', block: 'start'}));
}

/**
 * Handles stabilize selected incident behavior in the alerts context.
 *
 * @returns {*}
 */
function stabilizeSelectedIncident() {
    const incident = selectedClosureIncident.value;
    if (!incident || incident.isConditionStable || alertsStore.stabilizingId === incident.id) return;
    alertsStore.stabilizeIncident(incident).catch(() => undefined);
}

/**
 * Determines whether closure form valid is true.
 *
 * @returns {boolean}
 */
function isClosureFormValid() {
    return Number(closureForm.incidentId) > 0 &&
        closureForm.correctiveAction.trim().length >= 8 &&
        closureForm.closureEvidence.trim().length >= 8;
}

/**
 * Determines whether closure control error exists.
 *
 * @param {*} controlName
 * @returns {boolean}
 */
function hasClosureControlError(controlName) {
    if (!closureSubmitted.value) return false;
    if (controlName === 'incidentId') return Number(closureForm.incidentId) <= 0;
    return String(closureForm[controlName] ?? '').trim().length < 8;
}

/**
 * Returns the i18n label key for status.
 *
 * @param {*} incident
 * @returns {string}
 */
function statusLabelKey(incident) {
    if (incident.status === 'recognized') return 'alerts.incident-list.status-recognized';
    if (incident.status === 'closed') return 'alerts.incident-list.status-closed';
    return 'alerts.incident-list.status-open';
}

/**
 * Returns the i18n label key for escalation.
 *
 * @param {*} incident
 * @returns {string}
 */
function escalationLabelKey(incident) {
    return `alerts.incident-list.escalation-${incident.escalationStatus}`;
}

/**
 * Returns the i18n label key for escalation target.
 *
 * @param {*} incident
 * @returns {string}
 */
function escalationTargetLabelKey(incident) {
    return incident.escalatedTo
        ? `alerts.incident-list.escalation-target-${incident.escalatedTo}`
        : 'alerts.incident-list.escalation-target-none';
}

/**
 * Determines whether success feedback is true.
 *
 * @param {*} feedback
 * @returns {boolean}
 */
function isSuccessFeedback(feedback) {
    return [
        'alerts.incident-list.feedback-recognized',
        'alerts.incident-list.feedback-closed',
        'alerts.incident-list.feedback-escalation-reviewed',
    ].includes(feedback);
}

/**
 * Handles severity icon behavior in the alerts context.
 *
 * @param {*} incident
 * @returns {string}
 */
function severityIcon(incident) {
    return incident.severity === 'critical' ? 'error' : 'warning';
}

/**
 * Returns the i18n label key for condition.
 *
 * @param {*} incident
 * @returns {string}
 */
function conditionLabelKey(incident) {
    return incident.isConditionStable
        ? 'alerts.incident-list.condition-stable'
        : 'alerts.incident-list.condition-active';
}

/**
 * Returns the i18n label key for source.
 *
 * @param {*} incident
 * @returns {string}
 */
function sourceLabelKey(incident) {
    if (incident.isPendingReview) return 'alerts.incident-list.source-pending-review';
    if (incident.isGenerated) return 'alerts.incident-list.source-generated';
    return 'alerts.incident-list.source-initial';
}

/**
 * Returns the i18n label key for type.
 *
 * @param {*} incident
 * @returns {string}
 */
function typeLabelKey(incident) {
    return `alerts.incident-list.type-${incident.type}`;
}

/**
 * Formats date for display.
 *
 * @param {boolean} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(isoDate));
}
</script>

<template>
  <div class="incident-list-view">
    <div class="view-header">
      <div class="header-text">
        <h1 class="view-title">{{ t('alerts.incident-list.title') }}</h1>
        <p class="view-subtitle">{{ t('alerts.incident-list.subtitle') }}</p>
      </div>

      <div
        v-if="alertsStore.feedback"
        class="feedback-banner"
        :class="{
          'feedback-success': isSuccessFeedback(alertsStore.feedback),
          'feedback-error': !isSuccessFeedback(alertsStore.feedback),
        }"
      >
        <span class="material-icons">{{ isSuccessFeedback(alertsStore.feedback) ? 'check_circle' : 'error_outline' }}</span>
        <span>{{ t(alertsStore.feedback) }}</span>
      </div>
    </div>

    <div v-if="alertsStore.loading" class="loading-container">
      <span class="loading-spinner"></span>
    </div>
    <template v-else>
      <div v-if="canResolveAlerts" ref="closureCard" class="premium-card closure-card">
        <div class="card-header closure-header">
          <div>
            <h3 class="card-title">{{ t('alerts.incident-list.closure-title') }}</h3>
            <p class="closure-subtitle">{{ t('alerts.incident-list.closure-subtitle') }}</p>
          </div>
          <span class="closure-count">
            {{ pendingClosureIncidents.length }} {{ t('alerts.incident-list.closure-pending') }}
          </span>
        </div>

        <form class="closure-form" @submit.prevent="closeIncident">
          <label class="closure-field">
            <span>{{ t('alerts.incident-list.form-incident') }}</span>
            <select v-model.number="closureForm.incidentId">
              <option :value="0">{{ t('alerts.incident-list.form-select-incident') }}</option>
              <option v-for="incident in pendingClosureIncidents" :key="incident.id" :value="incident.id">
                {{ incident.assetName }} - {{ t(typeLabelKey(incident)) }}
              </option>
            </select>
            <small v-if="hasClosureControlError('incidentId')">{{ t('alerts.incident-list.form-incident-error') }}</small>
          </label>

          <label class="closure-field">
            <span>{{ t('alerts.incident-list.form-corrective-action') }}</span>
            <textarea
              v-model="closureForm.correctiveAction"
              rows="3"
              :placeholder="t('alerts.incident-list.form-corrective-placeholder')"
            ></textarea>
            <small v-if="hasClosureControlError('correctiveAction')">{{ t('alerts.incident-list.form-corrective-error') }}</small>
          </label>

          <label class="closure-field">
            <span>{{ t('alerts.incident-list.form-evidence') }}</span>
            <textarea
              v-model="closureForm.closureEvidence"
              rows="3"
              :placeholder="t('alerts.incident-list.form-evidence-placeholder')"
            ></textarea>
            <small v-if="hasClosureControlError('closureEvidence')">{{ t('alerts.incident-list.form-evidence-error') }}</small>
          </label>

          <div
            v-if="selectedClosureIncident"
            class="closure-condition"
            :class="{
              'closure-condition-ready': selectedClosureIncident.isConditionStable,
              'closure-condition-blocked': !selectedClosureIncident.isConditionStable,
            }"
          >
            <span class="material-icons">{{ selectedClosureIncident.isConditionStable ? 'task_alt' : 'warning' }}</span>
            <span>{{ t(conditionLabelKey(selectedClosureIncident)) }}</span>
            <button
              v-if="!selectedClosureIncident.isConditionStable"
              type="button"
              class="stabilize-reading-btn"
              :disabled="alertsStore.stabilizingId === selectedClosureIncident.id"
              @click="stabilizeSelectedIncident"
            >
              <span v-if="alertsStore.stabilizingId === selectedClosureIncident.id" class="inline-spinner"></span>
              <span v-else class="material-icons">speed</span>
              {{ t('alerts.incident-list.action-stabilize') }}
            </button>
          </div>

          <button
            type="submit"
            class="close-incident-btn"
            :disabled="
              alertsStore.closingId !== null ||
              alertsStore.stabilizingId !== null ||
              !selectedClosureIncident ||
              !selectedClosureIncident.isConditionStable
            "
          >
            <span v-if="alertsStore.closingId !== null" class="inline-spinner"></span>
            <span v-else class="material-icons">assignment_turned_in</span>
            {{ t('alerts.incident-list.action-close') }}
          </button>
        </form>
      </div>

      <div class="premium-card table-card">
        <div class="card-header">
          <h3 class="card-title">{{ t('alerts.incident-list.title') }}</h3>
          <span class="open-count">{{ alertsStore.openIncidentsCount }} {{ t('alerts.incident-list.status-open') }}</span>
          <span class="escalated-count">{{ alertsStore.escalatedIncidentsCount }} {{ t('alerts.incident-list.escalated-count') }}</span>
        </div>

        <div class="table-container">
          <table class="premium-table">
            <thead>
              <tr>
                <th>{{ t('alerts.incident-list.col-asset') }}</th>
                <th>{{ t('alerts.incident-list.col-type') }}</th>
                <th>{{ t('alerts.incident-list.col-value') }}</th>
                <th>{{ t('alerts.incident-list.col-detected') }}</th>
                <th>{{ t('alerts.incident-list.col-status') }}</th>
                <th>{{ t('alerts.incident-list.col-condition') }}</th>
                <th>{{ t('alerts.incident-list.col-source') }}</th>
                <th>{{ t('alerts.incident-list.col-escalation') }}</th>
                <th>{{ t('alerts.incident-list.col-recognized-by') }}</th>
                <th v-if="canResolveAlerts">{{ t('alerts.incident-list.col-actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="incident in paginatedIncidents" :key="incident.id" :class="{'recognized-row': incident.isRecognized}">
                <td class="asset-name">{{ incident.assetName }}</td>
                <td>
                  <div class="type-cell" :class="{crit: incident.severity === 'critical', warn: incident.severity === 'warning'}">
                    <span class="material-icons">{{ severityIcon(incident) }}</span>
                    <span>{{ t(typeLabelKey(incident)) }}</span>
                  </div>
                </td>
                <td class="value">{{ incident.value }}</td>
                <td class="date">{{ formatDate(incident.detectedAt) }}</td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge-open': incident.status === 'open',
                      'badge-recognized': incident.status === 'recognized',
                      'badge-closed': incident.status === 'closed',
                    }"
                  >
                    {{ t(statusLabelKey(incident)) }}
                  </span>
                </td>
                <td>
                  <span
                    class="condition-pill"
                    :class="{
                      'condition-stable': incident.isConditionStable,
                      'condition-active': !incident.isConditionStable,
                    }"
                  >
                    {{ t(conditionLabelKey(incident)) }}
                  </span>
                </td>
                <td>
                  <span
                    class="source-pill"
                    :class="{
                      'source-generated': incident.isGenerated && !incident.isPendingReview,
                      'source-initial': !incident.isGenerated && !incident.isPendingReview,
                      'source-pending': incident.isPendingReview,
                    }"
                  >
                    {{ t(sourceLabelKey(incident)) }}
                  </span>
                </td>
                <td>
                  <div class="escalation-cell">
                    <span
                      class="escalation-pill"
                      :class="{
                        'escalation-none': incident.escalationStatus === 'none',
                        'escalation-pending': incident.isPendingEscalationConfiguration,
                        'escalation-escalated': incident.isEscalated,
                        'escalation-reviewed': incident.escalationStatus === 'reviewed',
                      }"
                    >
                      {{ t(escalationLabelKey(incident)) }}
                    </span>
                    <small v-if="incident.isEscalated">
                      {{ t('alerts.incident-list.escalation-level') }} {{ incident.escalationLevel }}
                      · {{ t(escalationTargetLabelKey(incident)) }}
                    </small>
                    <small v-else-if="incident.isPendingEscalationConfiguration">
                      {{ t('alerts.incident-list.escalation-no-policy') }}
                    </small>
                    <small v-else-if="incident.escalationPolicyMinutes">
                      {{ incident.escalationPolicyMinutes }} {{ t('alerts.incident-list.escalation-minutes') }}
                    </small>
                  </div>
                </td>
                <td class="recognized-by">{{ incident.recognizedBy ?? '-' }}</td>
                <td v-if="canResolveAlerts">
                  <button
                    v-if="incident.isEscalated || incident.isPendingEscalationConfiguration"
                    :id="`review-escalation-${incident.id}`"
                    class="review-escalation-btn"
                    :disabled="alertsStore.reviewingEscalationId === incident.id"
                    @click="reviewEscalation(incident)"
                  >
                    <span v-if="alertsStore.reviewingEscalationId === incident.id" class="inline-spinner"></span>
                    <template v-else>{{ t('alerts.incident-list.action-review-escalation') }}</template>
                  </button>
                  <button
                    v-else-if="incident.isOpen"
                    :id="`recognize-incident-${incident.id}`"
                    class="recognize-btn"
                    :disabled="alertsStore.recognizingId === incident.id"
                    @click="recognize(incident)"
                  >
                    <span v-if="alertsStore.recognizingId === incident.id" class="inline-spinner"></span>
                    <template v-else>{{ t('alerts.incident-list.action-recognize') }}</template>
                  </button>
                  <button
                    v-else-if="!incident.isClosed"
                    :id="`close-incident-shortcut-${incident.id}`"
                    class="close-shortcut-btn"
                    :disabled="alertsStore.closingId === incident.id"
                    @click="selectIncidentForClosure(incident)"
                  >
                    {{ t('alerts.incident-list.action-prepare-close') }}
                  </button>
                  <span v-else class="action-done">
                    <span class="material-icons">check</span>
                  </span>
                </td>
              </tr>
              <tr v-if="activeIncidents.length === 0">
                <td :colspan="canResolveAlerts ? 10 : 9" class="empty-cell">
                  <span class="material-icons empty-icon">check_circle</span>
                  <p class="empty-title">{{ t('alerts.incident-list.empty-title') }}</p>
                  <p class="empty-description">{{ t('alerts.incident-list.empty-description') }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <list-pagination
          v-if="activeIncidents.length > 0"
          v-model="currentPage"
          :total="activeIncidents.length"
          :page-size="pageSize"
        />

        <div v-if="!canResolveAlerts" class="access-notice">
          <span class="material-icons">lock</span>
          <span>{{ t('alerts.incident-list.access-description') }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.incident-list-view {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
  padding: 28px 32px;
}

.view-header {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.view-title {
  color: #111827;
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.view-subtitle {
  color: #6b7280;
  font-size: 13px;
  margin: 0;
}

.feedback-banner {
  align-items: center;
  border-radius: 8px;
  display: flex;
  font-size: 13px;
  font-weight: 500;
  gap: 8px;
  padding: 10px 16px;
}

.feedback-success {
  background: #dcfce7;
  color: #15803d;
}

.feedback-error {
  background: #fee2e2;
  color: #dc2626;
}

.feedback-banner .material-icons {
  font-size: 18px;
  height: 18px;
  width: 18px;
}

.premium-card {
  background: #ffffff;
  border-radius: 14px;
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.04);
}

.table-card {
  display: flex;
  flex-direction: column;
  padding: 24px 28px 18px;
}

.card-header {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: flex-start;
  margin-bottom: 16px;
}

.card-title {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  margin: 0 auto 0 0;
}

.open-count,
.escalated-count {
  background: #fee2e2;
  border-radius: 20px;
  color: #dc2626;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
}

.escalated-count {
  background: #fef3c7;
  color: #b45309;
}

.table-container {
  overflow-x: auto;
}

.premium-table {
  border-collapse: collapse;
  width: 100%;
}

.premium-table th {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  color: #9ca3af;
  font-size: 11px;
  font-weight: 500;
  padding: 0 12px 8px;
  text-align: left;
  white-space: nowrap;
}

.premium-table td {
  border-bottom: 1px solid rgba(0, 0, 0, 0.035);
  color: #4b5563;
  font-size: 12px;
  padding: 8px 12px;
}

.premium-table th:first-child,
.premium-table td:first-child {
  padding-left: 0;
}

.premium-table th:last-child,
.premium-table td:last-child {
  padding-right: 0;
  text-align: right;
}

.asset-name {
  color: #111827;
  font-weight: 600;
  white-space: nowrap;
}

.type-cell {
  align-items: center;
  display: flex;
  font-weight: 500;
  gap: 6px;
  white-space: nowrap;
}

.type-cell .material-icons {
  font-size: 16px;
  height: 16px;
  width: 16px;
}

.crit,
.crit .material-icons {
  color: #dc2626;
}

.warn,
.warn .material-icons {
  color: #d97706;
}

.value {
  color: #111827;
  font-weight: 600;
}

.date {
  color: #6b7280;
  font-size: 11.5px;
  white-space: nowrap;
}

.recognized-by {
  color: #374151;
  font-weight: 500;
}

.recognized-row {
  opacity: 0.72;
}

.badge,
.condition-pill,
.source-pill,
.escalation-pill {
  border-radius: 5px;
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 10px;
  white-space: nowrap;
}

.badge-open {
  background: #fee2e2;
  color: #dc2626;
}

.badge-recognized {
  background: #dcfce7;
  color: #16a34a;
}

.badge-closed {
  background: #e5e7eb;
  color: #374151;
}

.condition-stable {
  background: #e0f2fe;
  color: #0369a1;
}

.condition-active,
.source-pending,
.escalation-pending {
  background: #fef3c7;
  color: #b45309;
}

.source-generated {
  background: #dbeafe;
  color: #1d4ed8;
}

.source-initial,
.escalation-none {
  background: #f3f4f6;
  color: #4b5563;
}

.escalation-cell {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 118px;
}

.escalation-cell small {
  color: #9ca3af;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
}

.escalation-pill {
  font-weight: 700;
}

.escalation-escalated {
  background: #fee2e2;
  color: #dc2626;
}

.escalation-reviewed {
  background: #dcfce7;
  color: #15803d;
}

.recognize-btn,
.close-shortcut-btn,
.review-escalation-btn {
  align-items: center;
  background: transparent;
  border: 1.5px solid #3b66f5;
  border-radius: 6px;
  color: #3b66f5;
  cursor: pointer;
  display: inline-flex;
  font-size: 11px;
  font-weight: 600;
  gap: 4px;
  justify-content: center;
  min-width: 90px;
  padding: 5px 14px;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.recognize-btn:hover:not(:disabled),
.close-shortcut-btn:hover:not(:disabled),
.review-escalation-btn:hover:not(:disabled) {
  background: #3b66f5;
  color: #ffffff;
}

.recognize-btn:disabled,
.close-shortcut-btn:disabled,
.review-escalation-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.close-shortcut-btn {
  border-color: #16a34a;
  color: #15803d;
  min-width: 118px;
}

.close-shortcut-btn:hover:not(:disabled) {
  background: #16a34a;
}

.review-escalation-btn {
  border-color: #d97706;
  color: #b45309;
}

.review-escalation-btn:hover:not(:disabled) {
  background: #d97706;
}

.action-done {
  align-items: center;
  color: #16a34a;
  display: inline-flex;
  justify-content: flex-end;
}

.empty-cell {
  border-bottom: none !important;
  padding: 48px 0 !important;
  text-align: center !important;
}

.empty-icon {
  color: #d1fae5;
  font-size: 40px;
  height: 40px;
  margin-bottom: 8px;
  width: 40px;
}

.empty-title {
  color: #111827;
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 4px;
}

.empty-description {
  color: #6b7280;
  font-size: 12px;
  margin: 0;
}

.access-notice {
  align-items: center;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  color: #6b7280;
  display: flex;
  font-size: 12px;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 14px;
}

.access-notice .material-icons {
  color: #9ca3af;
  font-size: 16px;
  height: 16px;
  width: 16px;
}

.closure-card {
  display: flex;
  flex-direction: column;
  padding: 22px 28px;
}

.closure-header {
  align-items: flex-start;
  margin-bottom: 14px;
}

.closure-header > div {
  min-width: 0;
}

.closure-subtitle {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.45;
  margin: 4px 0 0;
  white-space: normal;
}

.closure-count {
  background: #eef2ff;
  border-radius: 20px;
  color: #3b66f5;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  white-space: nowrap;
}

.closure-form {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(260px, 0.95fr) minmax(260px, 1fr) minmax(260px, 1fr);
}

.closure-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.closure-field span {
  color: #374151;
  font-size: 12px;
  font-weight: 700;
}

.closure-field select,
.closure-field textarea {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-sizing: border-box;
  color: #111827;
  font: inherit;
  font-size: 12px;
  line-height: 1.35;
  outline: none;
  padding: 10px 12px;
  resize: vertical;
  width: 100%;
}

.closure-field select {
  min-height: 42px;
  padding-bottom: 0;
  padding-right: 40px;
  padding-top: 0;
}

.closure-field select:focus,
.closure-field textarea:focus {
  border-color: #3b66f5;
  box-shadow: 0 0 0 3px rgba(59, 102, 245, 0.12);
}

.closure-field small {
  color: #dc2626;
  font-size: 11px;
  font-weight: 600;
}

.closure-condition {
  align-items: center;
  border-radius: 8px;
  display: flex;
  font-size: 12px;
  font-weight: 700;
  gap: 8px;
  justify-content: space-between;
  min-height: 38px;
  padding: 0 12px;
}

.closure-condition .material-icons {
  font-size: 18px;
  height: 18px;
  width: 18px;
}

.closure-condition-ready {
  background: #ecfdf5;
  color: #047857;
}

.closure-condition-blocked {
  background: #fffbeb;
  color: #b45309;
}

.close-incident-btn {
  align-items: center;
  align-self: start;
  background: #16a34a;
  border: 0;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  gap: 8px;
  justify-content: center;
  min-height: 38px;
  padding: 0 16px;
  width: fit-content;
}

.close-incident-btn .material-icons {
  font-size: 18px;
  height: 18px;
  width: 18px;
}

.close-incident-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.stabilize-reading-btn {
  align-items: center;
  background: #ffffff;
  border: 1px solid #fbbf24;
  border-radius: 7px;
  color: #92400e;
  cursor: pointer;
  display: inline-flex;
  font-size: 11px;
  font-weight: 800;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  white-space: nowrap;
}

.stabilize-reading-btn .material-icons {
  font-size: 16px;
  height: 16px;
  width: 16px;
}

.stabilize-reading-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.loading-container {
  align-items: center;
  display: flex;
  justify-content: center;
  padding: 80px 0;
}

.loading-spinner,
.inline-spinner {
  animation: spin 0.8s linear infinite;
  border: 3px solid #dbe3ef;
  border-radius: 50%;
  border-top-color: #3b66f5;
  display: inline-block;
}

.loading-spinner {
  height: 40px;
  width: 40px;
}

.inline-spinner {
  height: 14px;
  width: 14px;
}

tr:hover {
  background: #fafbfc;
}

tr:last-child td {
  border-bottom: none;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .closure-form {
    grid-template-columns: 1fr;
  }
}
</style>
