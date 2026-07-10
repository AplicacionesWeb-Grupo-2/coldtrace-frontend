<script setup>
import {computed, onMounted, reactive, ref, watch} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {useI18n} from 'vue-i18n';
import useAlertsStore from '@/alerts/application/alerts.store.js';
import useBillingStore from '@/billing/application/billing.store.js';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';

const {t, locale} = useI18n();
const route = useRoute();
const router = useRouter();
const alertsStore = useAlertsStore();
const billingStore = useBillingStore();
const identityStore = useIdentityAccessStore();

const selectedIncidentId = ref(numberFrom(route.query.incidentId));
const plans = ref([]);
const loadingPlans = ref(false);
const generating = ref(false);
const decidingPlanId = ref(null);
const subscriptionLoading = ref(false);
const subscriptionError = ref(false);
const approveSubmitted = ref(false);
const rejectSubmitted = ref(false);
const feedback = ref({
    key: 'alerts.ai-guidance.feedback-ready',
    kind: 'info',
});
const loadedPlanIncidentId = ref(0);
const approvalForm = reactive({
    finalCorrectiveAction: '',
    finalResolutionNotes: '',
});
const rejectionForm = reactive({
    rejectionReason: '',
});

const activeOrganizationId = computed(() => identityStore.currentOrganizationIdFrom());
const reviewableIncidents = computed(() => [...alertsStore.organizationIncidents].sort((first, second) => {
    if (first.isClosed !== second.isClosed) return first.isClosed ? 1 : -1;
    return new Date(second.detectedAt).getTime() - new Date(first.detectedAt).getTime();
}));
const selectedIncident = computed(() =>
    reviewableIncidents.value.find(incident => incident.id === selectedIncidentId.value) ?? reviewableIncidents.value[0] ?? null,
);
const sortedPlans = computed(() =>
    [...plans.value].sort(
        (first, second) => new Date(second.generatedAt).getTime() - new Date(first.generatedAt).getTime(),
    ),
);
const activePlan = computed(() =>
    sortedPlans.value.find(plan => plan.status === 'pending') ?? sortedPlans.value[0] ?? null,
);
const aiGuidanceLocked = computed(() => {
    const subscription = billingStore.subscription;

    if (!subscription) return false;

    const entitlement = subscription.entitlementByKey?.('ai-guidance') ??
        subscription.entitlements?.find(current => current.key === 'ai-guidance') ??
        null;

    return entitlement ? !entitlement.enabled : !subscription.plan?.featureFlags?.allowsAiGuidance;
});
const canSubmitDecision = computed(() => activePlan.value?.status === 'pending' && !aiGuidanceLocked.value);
const profileUserName = computed(() => identityStore.currentUserNameFrom() || 'ColdTrace User');

watch(() => route.query.incidentId, (incidentId) => {
    selectedIncidentId.value = numberFrom(incidentId);
    loadedPlanIncidentId.value = 0;
});

watch(selectedIncident, (incident) => {
    if (!incident || incident.id === loadedPlanIncidentId.value) return;

    loadedPlanIncidentId.value = incident.id;
    loadPlanHistory(incident.id);
}, {immediate: true});

onMounted(async () => {
    try {
        await alertsStore.loadIncidents({organizationId: activeOrganizationId.value});
    } catch (error) {
        feedback.value = {key: feedbackKeyFromError(error), kind: 'error'};
    }

    await loadSubscription();
});

/**
 * Selects the incident whose AI plan history is being reviewed.
 *
 * @param {number|string} value
 * @returns {void}
 */
function selectIncident(value) {
    const incidentId = Number(value);
    if (!Number.isFinite(incidentId) || incidentId <= 0) return;

    selectedIncidentId.value = incidentId;
    loadedPlanIncidentId.value = 0;
    feedback.value = {key: 'alerts.ai-guidance.feedback-ready', kind: 'info'};
    router.push({
        name: 'alerts-ai-guidance',
        query: {...route.query, incidentId},
    });
}

/**
 * Requests an AI plan from the backend for the selected incident.
 *
 * @returns {Promise<void>}
 */
async function generatePlan() {
    const incident = selectedIncident.value;

    if (!incident) {
        feedback.value = {key: 'alerts.ai-guidance.feedback-no-incident', kind: 'error'};
        return;
    }

    if (incident.isClosed) {
        feedback.value = {key: 'alerts.ai-guidance.feedback-no-pending-plan', kind: 'error'};
        return;
    }

    if (aiGuidanceLocked.value) {
        feedback.value = {key: 'alerts.ai-guidance.feedback-plan-locked', kind: 'error'};
        return;
    }

    generating.value = true;
    feedback.value = {key: 'alerts.ai-guidance.feedback-generating', kind: 'info'};

    try {
        const plan = await alertsStore.generateAiResolutionPlan(activeOrganizationId.value, incident.id);
        const normalizedPlan = normalizePlan(plan);
        upsertPlan(normalizedPlan);
        prepareDecisionForms(normalizedPlan);
        feedback.value = {key: 'alerts.ai-guidance.feedback-generated', kind: 'success'};
    } catch (error) {
        feedback.value = {key: feedbackKeyFromError(error), kind: 'error'};
    } finally {
        generating.value = false;
    }
}

/**
 * Approves the pending AI plan and lets the backend resolve the incident.
 *
 * @returns {Promise<void>}
 */
async function approvePlan() {
    approveSubmitted.value = true;

    const plan = activePlan.value;
    const incident = selectedIncident.value;

    if (!plan || !incident || plan.status !== 'pending') {
        feedback.value = {key: 'alerts.ai-guidance.feedback-no-pending-plan', kind: 'error'};
        return;
    }

    if (!isApprovalFormValid()) {
        feedback.value = {key: 'alerts.ai-guidance.feedback-approval-required', kind: 'error'};
        return;
    }

    decidingPlanId.value = plan.id;

    try {
        const updatedPlan = await alertsStore.approveAiResolutionPlan(activeOrganizationId.value, incident.id, plan.id, {
            approvedBy: profileUserName.value,
            finalCorrectiveAction: approvalForm.finalCorrectiveAction.trim(),
            finalResolutionNotes: approvalForm.finalResolutionNotes.trim(),
        });
        upsertPlan(normalizePlan(updatedPlan));
        approveSubmitted.value = false;
        await alertsStore.loadIncidents({organizationId: activeOrganizationId.value, silent: true}).catch(() => undefined);
        feedback.value = {key: 'alerts.ai-guidance.feedback-approved', kind: 'success'};
    } catch (error) {
        feedback.value = {key: feedbackKeyFromError(error), kind: 'error'};
    } finally {
        decidingPlanId.value = null;
    }
}

/**
 * Rejects the pending AI plan and preserves the audit reason.
 *
 * @returns {Promise<void>}
 */
async function rejectPlan() {
    rejectSubmitted.value = true;

    const plan = activePlan.value;
    const incident = selectedIncident.value;

    if (!plan || !incident || plan.status !== 'pending') {
        feedback.value = {key: 'alerts.ai-guidance.feedback-no-pending-plan', kind: 'error'};
        return;
    }

    if (rejectionForm.rejectionReason.trim().length < 8) {
        feedback.value = {key: 'alerts.ai-guidance.feedback-rejection-required', kind: 'error'};
        return;
    }

    decidingPlanId.value = plan.id;

    try {
        const updatedPlan = await alertsStore.rejectAiResolutionPlan(activeOrganizationId.value, incident.id, plan.id, {
            rejectedBy: profileUserName.value,
            rejectionReason: rejectionForm.rejectionReason.trim(),
        });
        upsertPlan(normalizePlan(updatedPlan));
        rejectSubmitted.value = false;
        feedback.value = {key: 'alerts.ai-guidance.feedback-rejected', kind: 'success'};
    } catch (error) {
        feedback.value = {key: feedbackKeyFromError(error), kind: 'error'};
    } finally {
        decidingPlanId.value = null;
    }
}

/**
 * Opens billing so the organization can unlock AI guidance.
 *
 * @returns {void}
 */
function openBilling() {
    router.push({name: 'identity-access-billing', query: route.query});
}

/**
 * Reloads plan history for the selected incident.
 *
 * @returns {void}
 */
function retryHistory() {
    const incident = selectedIncident.value;
    if (!incident) return;

    loadedPlanIncidentId.value = 0;
    loadPlanHistory(incident.id);
}

/**
 * Reloads the organization subscription.
 *
 * @returns {Promise<void>}
 */
async function retrySubscription() {
    await loadSubscription();
}

/**
 * Loads AI plan history.
 *
 * @param {number|string} incidentId
 * @returns {Promise<void>}
 */
async function loadPlanHistory(incidentId) {
    if (!activeOrganizationId.value || !incidentId) return;

    loadingPlans.value = true;

    try {
        const planHistory = await alertsStore.getAiResolutionPlans(activeOrganizationId.value, incidentId);
        plans.value = planHistory.map(plan => normalizePlan(plan));

        if (activePlan.value) {
            prepareDecisionForms(activePlan.value);
        }
    } catch (error) {
        plans.value = [];
        feedback.value = {key: feedbackKeyFromError(error), kind: 'error'};
    } finally {
        loadingPlans.value = false;
    }
}

/**
 * Loads current subscription entitlements for the organization.
 *
 * @returns {Promise<void>}
 */
async function loadSubscription() {
    const organizationId = activeOrganizationId.value;

    if (!organizationId) return;

    subscriptionLoading.value = true;
    subscriptionError.value = false;

    try {
        await billingStore.fetchSubscription(organizationId);
    } catch {
        subscriptionError.value = true;
    } finally {
        subscriptionLoading.value = false;
    }
}

/**
 * Adds or replaces a plan in the local history.
 *
 * @param {*} plan
 * @returns {void}
 */
function upsertPlan(plan) {
    const exists = plans.value.some(item => item.id === plan.id);
    plans.value = (exists
        ? plans.value.map(item => item.id === plan.id ? plan : item)
        : [plan, ...plans.value]
    ).sort((first, second) => new Date(second.generatedAt).getTime() - new Date(first.generatedAt).getTime());
}

/**
 * Seeds operator forms from the current plan drafts.
 *
 * @param {*} plan
 * @returns {void}
 */
function prepareDecisionForms(plan) {
    approvalForm.finalCorrectiveAction = plan.finalCorrectiveAction ?? plan.correctiveActionDraft ?? '';
    approvalForm.finalResolutionNotes = plan.finalResolutionNotes ?? plan.resolutionNotesDraft ?? '';
    rejectionForm.rejectionReason = plan.rejectionReason ?? '';
    approveSubmitted.value = false;
    rejectSubmitted.value = false;
}

/**
 * Normalizes backend resources with either camelCase or PascalCase fields.
 *
 * @param {*} resource
 * @returns {*}
 */
function normalizePlan(resource = {}) {
    const steps = arrayFrom(read(resource, ['recommendedSteps', 'RecommendedSteps'], []));

    return {
        id: Number(read(resource, ['id', 'Id'], 0)),
        organizationId: Number(read(resource, ['organizationId', 'OrganizationId'], 0)),
        incidentId: Number(read(resource, ['incidentId', 'IncidentId'], 0)),
        status: String(read(resource, ['status', 'Status'], 'pending')).toLowerCase(),
        summary: read(resource, ['summary', 'Summary'], ''),
        probableCause: read(resource, ['probableCause', 'ProbableCause'], ''),
        recommendedSteps: steps.map((step, index) => ({
            sequence: Number(read(step, ['sequence', 'Sequence'], index + 1)),
            action: read(step, ['action', 'Action'], ''),
            rationale: read(step, ['rationale', 'Rationale'], ''),
            expectedOutcome: read(step, ['expectedOutcome', 'ExpectedOutcome'], ''),
        })),
        correctiveActionDraft: read(resource, ['correctiveActionDraft', 'CorrectiveActionDraft'], ''),
        resolutionNotesDraft: read(resource, ['resolutionNotesDraft', 'ResolutionNotesDraft'], ''),
        escalationRecommended: Boolean(read(resource, ['escalationRecommended', 'EscalationRecommended'], false)),
        escalationUrgency: read(resource, ['escalationUrgency', 'EscalationUrgency'], null),
        escalationReason: read(resource, ['escalationReason', 'EscalationReason'], ''),
        requiredEvidence: arrayFrom(read(resource, ['requiredEvidence', 'RequiredEvidence'], [])),
        uncertaintyNotes: arrayFrom(read(resource, ['uncertaintyNotes', 'UncertaintyNotes'], [])),
        modelProvider: read(resource, ['modelProvider', 'ModelProvider'], ''),
        modelName: read(resource, ['modelName', 'ModelName'], ''),
        providerMetadata: read(resource, ['providerMetadata', 'ProviderMetadata'], ''),
        generatedAt: read(resource, ['generatedAt', 'GeneratedAt'], null),
        approvedAt: read(resource, ['approvedAt', 'ApprovedAt'], null),
        approvedBy: read(resource, ['approvedBy', 'ApprovedBy'], null),
        rejectedAt: read(resource, ['rejectedAt', 'RejectedAt'], null),
        rejectedBy: read(resource, ['rejectedBy', 'RejectedBy'], null),
        rejectionReason: read(resource, ['rejectionReason', 'RejectionReason'], null),
        finalCorrectiveAction: read(resource, ['finalCorrectiveAction', 'FinalCorrectiveAction'], null),
        finalResolutionNotes: read(resource, ['finalResolutionNotes', 'FinalResolutionNotes'], null),
    };
}

/**
 * Determines whether approval form values are valid.
 *
 * @returns {boolean}
 */
function isApprovalFormValid() {
    return approvalForm.finalCorrectiveAction.trim().length >= 8 &&
        approvalForm.finalResolutionNotes.trim().length >= 8;
}

/**
 * Determines whether a field should display an approval error.
 *
 * @param {string} field
 * @returns {boolean}
 */
function hasApprovalControlError(field) {
    return approveSubmitted.value && String(approvalForm[field] ?? '').trim().length < 8;
}

/**
 * Determines whether the rejection field should display an error.
 *
 * @returns {boolean}
 */
function hasRejectionControlError() {
    return rejectSubmitted.value && rejectionForm.rejectionReason.trim().length < 8;
}

/**
 * Determines whether a plan decision request is running.
 *
 * @param {*} plan
 * @returns {boolean}
 */
function isDecisionInProgress(plan) {
    return decidingPlanId.value === plan.id;
}

/**
 * Maps a plan status to its icon.
 *
 * @param {string} status
 * @returns {string}
 */
function statusIcon(status) {
    if (status === 'approved') return 'task_alt';
    if (status === 'rejected') return 'cancel';
    return 'pending_actions';
}

/**
 * Maps plan status to translation key.
 *
 * @param {string} status
 * @returns {string}
 */
function planStatusLabelKey(status) {
    return `alerts.ai-guidance.status-${status}`;
}

/**
 * Maps incident status to translation key.
 *
 * @param {string} status
 * @returns {string}
 */
function incidentStatusLabelKey(status) {
    return `alerts.incident-list.status-${status}`;
}

/**
 * Maps incident condition to translation key.
 *
 * @param {boolean} conditionStable
 * @returns {string}
 */
function conditionLabelKey(conditionStable) {
    return conditionStable
        ? 'alerts.incident-list.condition-stable'
        : 'alerts.incident-list.condition-active';
}

/**
 * Maps incident type to translation key.
 *
 * @param {string} type
 * @returns {string}
 */
function typeLabelKey(type) {
    return `alerts.incident-list.type-${type}`;
}

/**
 * Maps escalation status to translation key.
 *
 * @param {string} escalationStatus
 * @returns {string}
 */
function escalationLabelKey(escalationStatus) {
    return `alerts.incident-list.escalation-${escalationStatus}`;
}

/**
 * Maps plan urgency to translation key.
 *
 * @param {string|null} urgency
 * @returns {string}
 */
function escalationUrgencyLabelKey(urgency) {
    return `alerts.ai-guidance.urgency-${String(urgency ?? 'none').toLowerCase()}`;
}

/**
 * Formats a date for the selected locale.
 *
 * @param {string|null} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
    if (!isoDate) return '-';

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat(locale.value?.startsWith('es') ? 'es-PE' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

/**
 * Maps backend failures to user-facing feedback.
 *
 * @param {*} error
 * @returns {string}
 */
function feedbackKeyFromError(error) {
    switch (error?.response?.status) {
        case 0:
            return 'alerts.ai-guidance.feedback-network-error';
        case 401:
            return 'alerts.ai-guidance.feedback-auth-required';
        case 402:
        case 403:
            return 'alerts.ai-guidance.feedback-plan-locked';
        case 404:
            return 'alerts.ai-guidance.feedback-not-eligible';
        case 409:
            return 'alerts.ai-guidance.feedback-conflict';
        case 422:
            return 'alerts.ai-guidance.feedback-invalid-output';
        case 502:
        case 503:
        case 504:
            return 'alerts.ai-guidance.feedback-provider-error';
        default:
            return 'alerts.ai-guidance.feedback-error';
    }
}

/**
 * Reads the first available key from a resource.
 *
 * @param {*} source
 * @param {Array<string>} keys
 * @param {*} fallback
 * @returns {*}
 */
function read(source, keys, fallback = undefined) {
    if (!source || typeof source !== 'object') return fallback;

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
    }

    return fallback;
}

/**
 * Ensures a value is rendered as a list.
 *
 * @param {*} value
 * @returns {Array<*>}
 */
function arrayFrom(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return [value];
}

/**
 * Reads a route query value as a number.
 *
 * @param {*} value
 * @returns {number}
 */
function numberFrom(value) {
    const normalizedValue = Array.isArray(value) ? value[0] : value;
    const numberValue = Number(normalizedValue ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}
</script>

<template>
  <section class="ai-page" aria-labelledby="ai-guidance-title">
    <header class="alerts-header">
      <div class="view-header">
        <div class="header-text">
          <h1 id="ai-guidance-title" class="view-title">{{ t('dashboard-shell.nav-alerts') }}</h1>
          <p class="view-subtitle">{{ t('alerts.incident-list.ai-guidance-subtitle') }}</p>
        </div>
      </div>

      <div class="incident-workbar">
        <div class="incident-toolbar">
          <label class="search-box ai-incident-select">
            <span class="material-icons search-icon" aria-hidden="true">warning</span>
            <select :value="selectedIncident?.id ?? 0" @change="selectIncident($event.target.value)">
              <option v-for="incident in reviewableIncidents" :key="incident.id" :value="incident.id">
                INC-{{ incident.id }} - {{ incident.assetName }}
              </option>
            </select>
          </label>

          <button
            type="button"
            class="primary-action"
            :disabled="
              generating ||
              loadingPlans ||
              subscriptionLoading ||
              aiGuidanceLocked ||
              !selectedIncident ||
              selectedIncident.isClosed
            "
            @click="generatePlan"
          >
            <span v-if="generating" class="inline-spinner"></span>
            <span v-else class="material-icons" aria-hidden="true">auto_awesome</span>
            {{ t(generating ? 'alerts.ai-guidance.generating' : 'alerts.ai-guidance.generate') }}
          </button>
        </div>
      </div>
    </header>

    <section
      class="feedback-banner"
      :class="{
        'feedback-approved': feedback.kind === 'success',
        'feedback-rejected': feedback.kind === 'error',
      }"
    >
      <span class="material-icons" aria-hidden="true">
        {{ feedback.kind === 'success' ? 'task_alt' : feedback.kind === 'error' ? 'error_outline' : 'info' }}
      </span>
      <span>{{ t(feedback.key) }}</span>
    </section>

    <div v-if="alertsStore.loading" class="loading-container">
      <span class="loading-spinner"></span>
    </div>

    <section v-else-if="!selectedIncident" class="panel empty-panel">
      <span class="material-icons" aria-hidden="true">check_circle</span>
      <h2>{{ t('alerts.ai-guidance.empty-title') }}</h2>
      <p>{{ t('alerts.ai-guidance.empty-description') }}</p>
    </section>

    <template v-else>
      <section class="incident-strip" aria-label="Incident selector">
        <article class="incident-summary">
          <span>{{ t('alerts.incident-list.col-asset') }}</span>
          <strong>{{ selectedIncident.assetName }}</strong>
          <small>INC-{{ selectedIncident.id }}</small>
        </article>
        <article class="incident-summary">
          <span>{{ t('alerts.incident-list.col-value') }}</span>
          <strong>{{ selectedIncident.value }}</strong>
          <small>{{ t(typeLabelKey(selectedIncident.type)) }}</small>
        </article>
        <article class="incident-summary">
          <span>{{ t('alerts.incident-list.col-status') }}</span>
          <strong>{{ t(incidentStatusLabelKey(selectedIncident.status)) }}</strong>
          <small>{{ t(conditionLabelKey(selectedIncident.isConditionStable)) }}</small>
        </article>
        <article class="incident-summary">
          <span>{{ t('alerts.incident-list.col-detected') }}</span>
          <strong>{{ formatDate(selectedIncident.detectedAt) }}</strong>
          <small>{{ t(escalationLabelKey(selectedIncident.escalationStatus)) }}</small>
        </article>
      </section>

      <section v-if="subscriptionLoading" class="panel state-panel">
        <span class="loading-spinner small-spinner"></span>
        <div>
          <h2>{{ t('alerts.ai-guidance.subscription-loading-title') }}</h2>
          <p>{{ t('alerts.ai-guidance.subscription-loading-description') }}</p>
        </div>
      </section>

      <section v-else-if="subscriptionError" class="panel state-panel state-panel-warning">
        <span class="material-icons" aria-hidden="true">wifi_off</span>
        <div>
          <h2>{{ t('alerts.ai-guidance.subscription-error-title') }}</h2>
          <p>{{ t('alerts.ai-guidance.subscription-error-description') }}</p>
        </div>
        <button type="button" class="secondary-action" @click="retrySubscription">
          {{ t('alerts.ai-guidance.retry') }}
        </button>
      </section>

      <section v-else-if="aiGuidanceLocked" class="panel state-panel state-panel-warning">
        <span class="material-icons" aria-hidden="true">lock</span>
        <div>
          <h2>{{ t('alerts.ai-guidance.locked-title') }}</h2>
          <p>{{ t('alerts.ai-guidance.locked-description') }}</p>
        </div>
        <button type="button" class="primary-action" @click="openBilling">
          <span class="material-icons" aria-hidden="true">workspace_premium</span>
          {{ t('alerts.ai-guidance.upgrade') }}
        </button>
      </section>

      <div v-if="loadingPlans" class="loading-container">
        <span class="loading-spinner"></span>
      </div>

      <section v-else-if="!activePlan" class="panel empty-panel">
        <span class="material-icons" aria-hidden="true">auto_awesome</span>
        <h2>{{ t('alerts.ai-guidance.no-plan-title') }}</h2>
        <p>{{ t('alerts.ai-guidance.no-plan-description') }}</p>
      </section>

      <section v-else class="ai-grid">
        <article class="panel plan-panel">
          <div class="panel-heading">
            <div>
              <h2>{{ t('alerts.ai-guidance.plan-title') }}</h2>
              <p>{{ t('alerts.ai-guidance.plan-description') }}</p>
            </div>
            <span
              class="status-pill"
              :class="{
                'status-approved': activePlan.status === 'approved',
                'status-rejected': activePlan.status === 'rejected',
              }"
            >
              <span class="material-icons" aria-hidden="true">{{ statusIcon(activePlan.status) }}</span>
              {{ t(planStatusLabelKey(activePlan.status)) }}
            </span>
          </div>

          <div class="plan-cause">
            <span class="material-icons" aria-hidden="true">psychology</span>
            <div>
              <span>{{ t('alerts.ai-guidance.probable-cause') }}</span>
              <strong>{{ activePlan.probableCause }}</strong>
              <p>{{ activePlan.summary }}</p>
              <small>
                {{ t('alerts.ai-guidance.generated-at') }} {{ formatDate(activePlan.generatedAt) }}
                - {{ activePlan.modelProvider }} {{ activePlan.modelName }}
              </small>
            </div>
          </div>

          <div class="step-list">
            <article v-for="step in activePlan.recommendedSteps" :key="step.sequence" class="step-card">
              <div class="step-index">{{ step.sequence }}</div>
              <div>
                <h3>{{ step.action }}</h3>
                <p>{{ step.rationale }}</p>
                <small>{{ step.expectedOutcome }}</small>
              </div>
            </article>
          </div>

          <div class="support-grid">
            <article class="support-card">
              <h3>{{ t('alerts.ai-guidance.required-evidence') }}</h3>
              <ul>
                <li v-for="evidence in activePlan.requiredEvidence" :key="evidence">{{ evidence }}</li>
              </ul>
            </article>
            <article class="support-card">
              <h3>{{ t('alerts.ai-guidance.uncertainty-notes') }}</h3>
              <ul>
                <li v-for="note in activePlan.uncertaintyNotes" :key="note">{{ note }}</li>
              </ul>
            </article>
            <article class="support-card">
              <h3>{{ t('alerts.ai-guidance.escalation') }}</h3>
              <p>
                {{ t(activePlan.escalationRecommended ? 'alerts.ai-guidance.escalation-recommended' : 'alerts.ai-guidance.escalation-not-required') }}
              </p>
              <small>{{ t(escalationUrgencyLabelKey(activePlan.escalationUrgency)) }}</small>
              <p v-if="activePlan.escalationReason">{{ activePlan.escalationReason }}</p>
            </article>
          </div>
        </article>

        <aside class="panel decision-panel">
          <h2>{{ t('alerts.ai-guidance.decision-title') }}</h2>
          <p>{{ t('alerts.ai-guidance.decision-description') }}</p>

          <template v-if="activePlan.status === 'pending'">
            <form @submit.prevent="approvePlan">
              <label class="field">
                <span>{{ t('alerts.ai-guidance.final-corrective-action') }}</span>
                <textarea v-model="approvalForm.finalCorrectiveAction" rows="5"></textarea>
                <small v-if="hasApprovalControlError('finalCorrectiveAction')">
                  {{ t('alerts.ai-guidance.final-corrective-action-error') }}
                </small>
              </label>

              <label class="field">
                <span>{{ t('alerts.ai-guidance.final-resolution-notes') }}</span>
                <textarea v-model="approvalForm.finalResolutionNotes" rows="4"></textarea>
                <small v-if="hasApprovalControlError('finalResolutionNotes')">
                  {{ t('alerts.ai-guidance.final-resolution-notes-error') }}
                </small>
              </label>

              <button
                type="submit"
                class="primary-action"
                :disabled="!canSubmitDecision || isDecisionInProgress(activePlan)"
              >
                <span v-if="isDecisionInProgress(activePlan)" class="inline-spinner"></span>
                <span v-else class="material-icons" aria-hidden="true">assignment_turned_in</span>
                {{ t('alerts.ai-guidance.approve') }}
              </button>
            </form>

            <form @submit.prevent="rejectPlan">
              <label class="field rejection-field">
                <span>{{ t('alerts.ai-guidance.rejection-reason') }}</span>
                <textarea
                  v-model="rejectionForm.rejectionReason"
                  rows="3"
                  :placeholder="t('alerts.ai-guidance.rejection-placeholder')"
                ></textarea>
                <small v-if="hasRejectionControlError()">
                  {{ t('alerts.ai-guidance.rejection-reason-error') }}
                </small>
              </label>

              <button
                type="submit"
                class="secondary-action danger-action"
                :disabled="!canSubmitDecision || isDecisionInProgress(activePlan)"
              >
                <span class="material-icons" aria-hidden="true">do_not_disturb_on</span>
                {{ t('alerts.ai-guidance.reject') }}
              </button>
            </form>
          </template>

          <div v-else class="decision-result">
            <span class="material-icons" aria-hidden="true">{{ statusIcon(activePlan.status) }}</span>
            <strong>{{ t(planStatusLabelKey(activePlan.status)) }}</strong>
            <template v-if="activePlan.status === 'approved'">
              <p>{{ activePlan.finalCorrectiveAction }}</p>
              <small>{{ activePlan.approvedBy ?? '-' }} - {{ formatDate(activePlan.approvedAt) }}</small>
            </template>
            <template v-else>
              <p>{{ activePlan.rejectionReason }}</p>
              <small>{{ activePlan.rejectedBy ?? '-' }} - {{ formatDate(activePlan.rejectedAt) }}</small>
            </template>
          </div>
        </aside>
      </section>

      <section class="panel history-panel">
        <div class="panel-heading">
          <div>
            <h2>{{ t('alerts.ai-guidance.history-title') }}</h2>
            <p>{{ t('alerts.ai-guidance.history-description') }}</p>
          </div>
          <button type="button" class="secondary-action" @click="retryHistory">
            {{ t('alerts.ai-guidance.reload') }}
          </button>
        </div>

        <div class="history-list">
          <article
            v-for="item in sortedPlans"
            :key="item.id"
            class="history-item"
            :class="{
              'history-approved': item.status === 'approved',
              'history-rejected': item.status === 'rejected',
            }"
          >
            <span class="material-icons" aria-hidden="true">{{ statusIcon(item.status) }}</span>
            <div>
              <strong>{{ t(planStatusLabelKey(item.status)) }}</strong>
              <p>{{ item.summary }}</p>
              <small>{{ formatDate(item.generatedAt) }}</small>
            </div>
          </article>

          <div v-if="sortedPlans.length === 0" class="history-empty">
            {{ t('alerts.ai-guidance.history-empty') }}
          </div>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.ai-page {
  background: #f8fafc;
  box-sizing: border-box;
  min-height: 100%;
  padding: 24px 18px 44px;
}

.ai-page,
.ai-page > *,
.field,
.panel,
.incident-summary,
.step-card,
.history-item,
.support-card,
.decision-result {
  min-width: 0;
}

.alerts-header {
  display: grid;
  gap: 14px;
  margin: 0 0 18px;
}

.view-header {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  min-height: 54px;
}

.view-title {
  color: #263348;
  font-size: 24px;
  font-weight: 800;
  line-height: 30px;
  margin: 0;
}

.view-subtitle {
  color: #98a2b3;
  font-size: 13px;
  font-weight: 800;
  line-height: 20px;
  margin: 6px 0 0;
}

.incident-workbar {
  align-items: center;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(260px, 400px) minmax(245px, 1fr);
  min-height: 42px;
  width: 100%;
}

.incident-toolbar {
  display: contents;
}

.search-box {
  align-items: center;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(16, 24, 40, 0.04);
  display: flex;
  gap: 10px;
  min-height: 42px;
  min-width: 0;
  padding: 0 14px;
}

.search-icon {
  color: #b8c0cc;
  font-size: 20px;
  height: 20px;
  width: 20px;
}

.ai-incident-select select {
  appearance: none;
  background: transparent;
  border: 0;
  color: #263348;
  font-size: 12px;
  font-weight: 800;
  height: 100%;
  min-height: 40px;
  outline: 0;
  width: 100%;
}

.incident-toolbar .primary-action {
  justify-self: end;
}

.panel-heading,
.incident-strip,
.ai-grid {
  max-width: none;
}

.panel-heading {
  align-items: flex-start;
  display: flex;
  gap: 18px;
  justify-content: space-between;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h2 {
  color: #263348;
  font-size: 16px;
  font-weight: 800;
}

h3 {
  color: #263348;
  font-size: 14px;
  font-weight: 800;
}

.panel-heading p,
.decision-panel p,
.plan-cause p,
.step-card p,
.history-item p,
.support-card p,
.empty-panel p,
.state-panel p {
  color: #667085;
  font-size: 12px;
  font-weight: 800;
  margin-top: 4px;
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
  background: #3b66f5;
  border: 0;
  color: #ffffff;
}

.secondary-action {
  background: #ffffff;
  border: 1px solid #e4e7ec;
  color: #526174;
}

.danger-action {
  color: #dc2626;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.feedback-banner,
.incident-summary,
.panel,
.field textarea {
  border: 1px solid #e4e7ec;
  border-radius: 8px;
}

.feedback-banner {
  align-items: center;
  background: #eef2ff;
  color: #2563eb;
  display: flex;
  font-size: 13px;
  font-weight: 800;
  gap: 10px;
  margin-top: 18px;
  max-width: none;
  padding: 12px 14px;
  width: 100%;
}

.feedback-approved {
  background: #dcfce7;
  color: #15803d;
}

.feedback-rejected {
  background: #fee2e2;
  color: #dc2626;
}

.incident-strip {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 18px;
}

.field {
  display: grid;
  gap: 7px;
}

.field span,
.incident-summary span,
.plan-cause span {
  color: #667085;
  font-size: 12px;
  font-weight: 800;
}

.field textarea {
  background: #ffffff;
  color: #263348;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  padding: 10px 12px;
  resize: vertical;
}

.field small {
  color: #dc2626;
  font-size: 11px;
  font-weight: 800;
}

.incident-summary {
  background: #ffffff;
  display: grid;
  gap: 2px;
  padding: 12px 14px;
}

.incident-summary strong {
  color: #263348;
  font-size: 14px;
  font-weight: 800;
}

.incident-summary small {
  color: #667085;
  font-size: 11px;
  font-weight: 800;
}

.ai-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.8fr);
  margin-top: 18px;
}

.panel {
  background: #ffffff;
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.04);
  padding: 22px;
}

.status-pill {
  align-items: center;
  background: #fef3c7;
  border-radius: 8px;
  color: #b45309;
  display: inline-flex;
  font-size: 12px;
  font-weight: 800;
  gap: 6px;
  padding: 6px 10px;
  text-transform: capitalize;
}

.status-pill .material-icons {
  font-size: 16px;
  height: 16px;
  width: 16px;
}

.status-approved {
  background: #dcfce7;
  color: #15803d;
}

.status-rejected {
  background: #fee2e2;
  color: #dc2626;
}

.plan-cause {
  align-items: flex-start;
  background: #f8fafc;
  border-radius: 8px;
  display: flex;
  gap: 14px;
  margin-top: 18px;
  padding: 14px;
}

.plan-cause > .material-icons {
  color: #3b66f5;
}

.plan-cause strong {
  color: #263348;
  display: block;
  font-size: 14px;
  font-weight: 800;
  margin-top: 2px;
}

.step-list,
.decision-panel,
.history-list,
.support-grid {
  display: grid;
  gap: 12px;
}

.step-list {
  margin-top: 16px;
}

.step-card {
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  display: grid;
  gap: 12px;
  grid-template-columns: 34px minmax(0, 1fr);
  padding: 13px;
}

.step-index {
  align-items: center;
  background: #eef2ff;
  border-radius: 999px;
  color: #2563eb;
  display: inline-flex;
  font-size: 13px;
  font-weight: 800;
  height: 34px;
  justify-content: center;
  width: 34px;
}

.step-card small,
.history-item small,
.support-card small,
.decision-result small,
.plan-cause small {
  color: #526174;
  font-size: 11px;
  font-weight: 800;
}

.support-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 16px;
}

.support-card,
.decision-result,
.empty-panel,
.state-panel {
  border: 1px solid #e4e7ec;
  border-radius: 8px;
}

.support-card {
  background: #f8fafc;
  display: grid;
  gap: 8px;
  padding: 14px;
}

.support-card ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
}

.support-card li,
.support-card p {
  color: #526174;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
}

.empty-panel,
.state-panel {
  align-items: center;
  background: #ffffff;
  display: flex;
  gap: 14px;
  margin-top: 18px;
  padding: 18px;
}

.empty-panel {
  align-items: flex-start;
  flex-direction: column;
}

.empty-panel .material-icons,
.state-panel .material-icons {
  color: #3b66f5;
}

.state-panel {
  justify-content: space-between;
}

.state-panel-warning {
  background: #fffaf0;
  border-color: #fdecc8;
}

.state-panel-warning .material-icons {
  color: #b45309;
}

.decision-panel form {
  display: grid;
  gap: 12px;
}

.decision-result {
  align-items: flex-start;
  background: #f8fafc;
  display: grid;
  gap: 8px;
  grid-template-columns: 28px minmax(0, 1fr);
  padding: 14px;
}

.decision-result .material-icons {
  color: #3b66f5;
  grid-row: span 3;
}

.history-panel {
  margin-top: 18px;
  max-width: none;
  width: 100%;
}

.history-item {
  align-items: flex-start;
  background: #f8fafc;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  display: flex;
  gap: 12px;
  padding: 12px;
}

.history-item strong {
  color: #263348;
  font-weight: 800;
}

.history-approved .material-icons {
  color: #15803d;
}

.history-rejected .material-icons {
  color: #dc2626;
}

.history-empty {
  color: #526174;
  font-size: 12px;
  font-weight: 800;
  padding: 14px 0 0;
}

.loading-container {
  align-items: center;
  display: flex;
  justify-content: center;
  padding: 70px 0;
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

.small-spinner {
  height: 26px;
  width: 26px;
}

.inline-spinner {
  height: 14px;
  width: 14px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .panel-heading,
  .state-panel {
    align-items: flex-start;
    flex-direction: column;
  }

  .incident-workbar,
  .incident-strip,
  .ai-grid,
  .support-grid {
    grid-template-columns: 1fr;
  }

  .incident-toolbar {
    display: grid;
    gap: 12px;
  }
}

@media (max-width: 640px) {
  .ai-page {
    padding: 18px 12px 34px;
  }

  .primary-action,
  .secondary-action,
  .field textarea {
    width: 100%;
  }

  .feedback-banner,
  .panel,
  .incident-summary,
  .plan-cause,
  .step-card,
  .history-item {
    padding: 14px;
  }

  .panel-heading,
  .plan-cause,
  .history-item {
    gap: 12px;
  }
}
</style>
