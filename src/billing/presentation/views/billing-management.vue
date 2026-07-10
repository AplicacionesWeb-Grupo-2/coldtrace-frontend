<script setup>
import {computed, onMounted, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRoute} from 'vue-router';
import useBillingStore from '@/billing/application/billing.store.js';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';

const {t, locale} = useI18n();
const route = useRoute();
const billingStore = useBillingStore();
const identityStore = useIdentityAccessStore();
const feedback = ref('idle');
const feedbackPlanName = ref('');

const activeOrganizationId = computed(() => identityStore.currentOrganizationIdFrom());
const activeOrganizationName = computed(() => identityStore.currentOrganizationNameFrom());
const currentPlan = computed(() => billingStore.currentPlan);
const currentPlanCode = computed(() => billingStore.currentPlanCode);
const subscription = computed(() => billingStore.subscription);
const selectedPlanCode = computed(() => normalizedPlanCode(route.query.plan));
const selectedPlan = computed(() => billingStore.planByCode(selectedPlanCode.value));
const canOpenPortal = computed(() =>
    subscription.value?.providerCustomerId &&
    !billingStore.portalLoading,
);
const usageRows = computed(() => [
    usageRow('locations', 'storefront', 'billing.usage.locations', subscription.value?.usage.locations, currentPlan.value?.usageLimits.maxLocations),
    usageRow('assets', 'inventory_2', 'billing.usage.assets', subscription.value?.usage.assets, currentPlan.value?.usageLimits.maxAssets),
    usageRow('iot-devices', 'sensors', 'billing.usage.iot-devices', subscription.value?.usage.iotDevices, currentPlan.value?.usageLimits.maxIotDevices),
    usageRow('users', 'group', 'billing.usage.users', subscription.value?.usage.users, currentPlan.value?.usageLimits.maxUsers),
    usageRow('report-history', 'history', 'billing.usage.history', null, currentPlan.value?.usageLimits.historyRetentionDays, true),
]);
const featureRows = computed(() => [
    featureRow('exports', 'file_download', 'billing.features.exports'),
    featureRow('maintenance', 'construction', 'billing.features.maintenance'),
    featureRow('ai-guidance', 'psychology', 'billing.features.ai-guidance'),
    featureRow('ai-report-summary', 'summarize', 'billing.features.ai-report-summary'),
]);
const lockedFeatureRows = computed(() => featureRows.value.filter(row => !row.enabled));

onMounted(async () => {
    applyRouteFeedback();
    await loadBillingData();
});

watch(() => route.query, applyRouteFeedback);
watch(activeOrganizationId, async (organizationId, previousOrganizationId) => {
    if (organizationId && organizationId !== previousOrganizationId) await loadBillingData();
});

/**
 * Loads identity context and billing data for the active organization.
 *
 * @returns {Promise<void>}
 */
async function loadBillingData() {
    feedback.value = feedback.value === 'idle' ? 'idle' : feedback.value;

    try {
        if (!identityStore.usersLoaded || !identityStore.rolesLoaded || !identityStore.organizationsLoaded) {
            await identityStore.fetchAccessData();
        }

        if (activeOrganizationId.value) {
            await billingStore.fetchBillingData(activeOrganizationId.value);
            if (selectedPlan.value && selectedPlan.value.code !== currentPlanCode.value) {
                feedback.value = 'plan-selected';
                feedbackPlanName.value = selectedPlan.value.displayName;
            }
        }
    } catch {
        feedback.value = billingStore.lastBillingError?.code ?? 'server-error';
    }
}

/**
 * Starts checkout for a paid plan and redirects to the provider URL.
 *
 * @param {*} plan
 * @returns {Promise<void>}
 */
async function startCheckout(plan) {
    if (!plan?.isPaid || plan.code === currentPlanCode.value || !activeOrganizationId.value) return;

    feedback.value = 'idle';
    feedbackPlanName.value = plan.displayName;

    try {
        const session = await billingStore.createCheckoutSession(activeOrganizationId.value, plan.code);
        if (!session.checkoutUrl) {
            feedback.value = 'checkout-error';
            return;
        }

        window.location.assign(session.checkoutUrl);
    } catch {
        feedback.value = billingStore.lastPlanProblem
            ? 'plan-limit-error'
            : billingStore.lastBillingError?.code ?? 'checkout-error';
    }
}

/**
 * Opens provider-hosted customer portal.
 *
 * @returns {Promise<void>}
 */
async function openCustomerPortal() {
    if (!activeOrganizationId.value) return;

    feedback.value = 'idle';

    try {
        const session = await billingStore.createCustomerPortalSession(activeOrganizationId.value);
        if (!session.portalUrl) {
            feedback.value = 'portal-error';
            return;
        }

        window.location.assign(session.portalUrl);
    } catch {
        feedback.value = billingStore.lastBillingError?.code ?? 'portal-error';
    }
}

/**
 * Applies feedback from provider return query params.
 *
 * @returns {void}
 */
function applyRouteFeedback() {
    if (route.query.checkout === 'success') feedback.value = 'checkout-success';
    if (route.query.checkout === 'cancel') feedback.value = 'checkout-cancel';
    if (route.query.portal === 'return') feedback.value = 'portal-return';
}

/**
 * Builds one usage row for the dashboard.
 *
 * @param {string} entitlementKey
 * @param {string} icon
 * @param {string} labelKey
 * @param {number|null|undefined} used
 * @param {number|null|undefined} limit
 * @param {boolean} limitOnly
 * @returns {Object}
 */
function usageRow(entitlementKey, icon, labelKey, used, limit, limitOnly = false) {
    const entitlement = billingStore.entitlementByKey(entitlementKey);
    const normalizedUsed = Number(used ?? entitlement?.used ?? 0);
    const normalizedLimit = limit ?? entitlement?.limit ?? null;
    const remaining = entitlement?.remaining ?? (
        normalizedLimit === null ? null : Math.max(Number(normalizedLimit) - normalizedUsed, 0)
    );

    return {
        entitlementKey,
        icon,
        labelKey,
        used: normalizedUsed,
        limit: normalizedLimit,
        limitOnly,
        remaining,
        enabled: entitlement?.enabled ?? true,
        lockedReason: entitlement?.lockedReason ?? null,
    };
}

/**
 * Builds one feature entitlement row.
 *
 * @param {string} entitlementKey
 * @param {string} icon
 * @param {string} labelKey
 * @returns {Object}
 */
function featureRow(entitlementKey, icon, labelKey) {
    const entitlement = billingStore.entitlementByKey(entitlementKey);
    return {
        entitlementKey,
        icon,
        labelKey,
        enabled: entitlement?.enabled ?? featureEnabledFromCurrentPlan(entitlementKey),
        lockedReason: entitlement?.lockedReason ?? null,
    };
}

/**
 * Reads feature flags from the current plan when entitlement details are absent.
 *
 * @param {string} entitlementKey
 * @returns {boolean}
 */
function featureEnabledFromCurrentPlan(entitlementKey) {
    const flags = currentPlan.value?.featureFlags ?? {};
    return {
        exports: flags.allowsExports,
        maintenance: flags.allowsMaintenance,
        'ai-guidance': flags.allowsAiGuidance,
        'ai-report-summary': flags.allowsAiReportSummary,
    }[entitlementKey] ?? false;
}

/**
 * Formats a plan price.
 *
 * @param {*} plan
 * @returns {string}
 */
function priceLabel(plan) {
    if (!plan?.isPaid) return t('billing.price.free');
    const amount = plan.monthlyPriceCents / 100;

    if (plan.currency === 'PEN') {
        return `S/ ${formatNumber(amount)}`;
    }

    return new Intl.NumberFormat(locale.value, {
        style: 'currency',
        currency: plan.currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Formats a nullable limit.
 *
 * @param {number|null|undefined} limit
 * @param {boolean} isDays
 * @returns {string}
 */
function limitLabel(limit, isDays = false) {
    if (limit === null || limit === undefined) return t('billing.usage.unlimited');
    return isDays ? t('billing.usage.days', {count: formatNumber(limit)}) : formatNumber(limit);
}

/**
 * Formats a number in the active locale.
 *
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
    return new Intl.NumberFormat(locale.value).format(Number(value));
}

/**
 * Formats dates returned by the backend.
 *
 * @param {string|null} value
 * @returns {string}
 */
function dateLabel(value) {
    if (!value) return t('billing.current.no-period');
    return new Intl.DateTimeFormat(locale.value, {dateStyle: 'medium'}).format(new Date(value));
}

/**
 * Normalizes route plan code values.
 *
 * @param {*} value
 * @returns {string}
 */
function normalizedPlanCode(value) {
    return String(Array.isArray(value) ? value[0] : value ?? '').trim().toLowerCase();
}
</script>

<template>
  <section class="billing-page" aria-labelledby="billing-title">
    <header class="billing-heading">
      <div>
        <span class="page-eyebrow">{{ t('billing.eyebrow') }}</span>
        <h1 id="billing-title">{{ t('billing.title') }}</h1>
        <p>{{ t('billing.subtitle', {organization: activeOrganizationName}) }}</p>
      </div>
      <button class="reload-action" type="button" :disabled="billingStore.loading" @click="loadBillingData">
        {{ billingStore.loading ? t('billing.loading') : t('billing.reload') }}
      </button>
    </header>

    <p v-if="feedback !== 'idle'" class="feedback" :class="feedback.includes('error') ? 'error' : 'neutral'">
      {{ t(`billing.feedback.${feedback}`, {
        plan: feedbackPlanName,
        detail: billingStore.lastBillingError?.detail ?? '',
      }) }}
    </p>

    <section v-if="billingStore.loading" class="table-card billing-loading">
      <span class="material-icons">hourglass_top</span>
      <p>{{ t('billing.loading') }}</p>
    </section>

    <section v-else-if="!activeOrganizationId" class="access-denied">
      <span class="material-icons denied-icon">business</span>
      <h2>{{ t('billing.empty.title') }}</h2>
      <p>{{ t('billing.empty.message') }}</p>
    </section>

    <template v-else>
      <section class="billing-current-panel">
        <article class="billing-current-card">
          <span class="billing-current-label">{{ t('billing.current.label') }}</span>
          <h2>{{ currentPlan?.displayName ?? t('billing.current.unknown-plan') }}</h2>
          <p>{{ currentPlan?.description ?? t('billing.current.unknown-description') }}</p>

          <div class="billing-current-meta">
            <span>{{ t('billing.current.status') }} <strong>{{ subscription?.status ?? t('billing.current.unknown') }}</strong></span>
            <span>{{ t('billing.current.provider') }} <strong>{{ subscription?.provider ?? 'LOCAL' }}</strong></span>
            <span>{{ t('billing.current.period') }} <strong>{{ dateLabel(subscription?.currentPeriodEnd) }}</strong></span>
          </div>
        </article>

        <article class="billing-action-panel">
          <h2>{{ t('billing.portal.title') }}</h2>
          <p>{{ t('billing.portal.description') }}</p>
          <button class="primary-form-action billing-action-button" type="button" :disabled="!canOpenPortal" @click="openCustomerPortal">
            {{ billingStore.portalLoading ? t('billing.portal.opening') : t('billing.portal.open') }}
          </button>
          <small v-if="!canOpenPortal">{{ t('billing.portal.disabled') }}</small>
        </article>
      </section>

      <section class="billing-usage-grid" aria-label="Plan usage">
        <article v-for="row in usageRows" :key="row.entitlementKey" class="billing-usage-card" :class="{'is-locked': !row.enabled}">
          <span class="material-icons">{{ row.icon }}</span>
          <div>
            <h3>{{ t(row.labelKey) }}</h3>
            <strong v-if="row.limitOnly">{{ limitLabel(row.limit, true) }}</strong>
            <strong v-else>{{ formatNumber(row.used) }} / {{ limitLabel(row.limit) }}</strong>
            <p v-if="!row.limitOnly">
              {{ row.remaining === null ? t('billing.usage.unlimited-remaining') : t('billing.usage.remaining', {count: formatNumber(row.remaining)}) }}
            </p>
          </div>
        </article>
      </section>

      <section class="billing-section billing-plans">
        <div class="table-heading">
          <div>
            <h2>{{ t('billing.plans.title') }}</h2>
            <p>{{ t('billing.plans.subtitle') }}</p>
          </div>
        </div>

        <div class="billing-plan-grid">
          <article
            v-for="plan in billingStore.visiblePlans"
            :key="plan.code"
            class="billing-plan-card"
            :class="{
              'is-current': plan.code === currentPlanCode,
              'is-selected': plan.code === selectedPlanCode,
              'is-recommended': plan.recommended,
            }"
          >
            <span v-if="plan.recommendedLabel" class="billing-plan-badge">{{ plan.recommendedLabel }}</span>
            <h3>{{ plan.displayName }}</h3>
            <p>{{ plan.description }}</p>
            <div class="billing-plan-price">
              <strong>{{ priceLabel(plan) }}</strong>
              <span v-if="plan.isPaid">{{ t('billing.price.month') }}</span>
            </div>
            <ul class="billing-plan-feature-list">
              <li v-for="feature in plan.includedFeatures" :key="feature">
                <span class="material-icons">check_circle</span>
                <span>{{ feature }}</span>
              </li>
            </ul>
            <button
              class="primary-form-action billing-plan-action"
              type="button"
              :disabled="!plan.isPaid || plan.code === currentPlanCode || billingStore.checkoutPlanCode === plan.code"
              @click="startCheckout(plan)"
            >
              <span v-if="plan.code === currentPlanCode">{{ t('billing.plans.current') }}</span>
              <span v-else-if="!plan.isPaid">{{ t('billing.plans.free') }}</span>
              <span v-else>{{ billingStore.checkoutPlanCode === plan.code ? t('billing.plans.redirecting') : t('billing.plans.upgrade') }}</span>
            </button>
          </article>
        </div>
      </section>

      <section class="billing-section billing-entitlements">
        <div class="table-heading">
          <div>
            <h2>{{ t('billing.entitlements.title') }}</h2>
            <p>{{ t('billing.entitlements.subtitle') }}</p>
          </div>
        </div>

        <div class="billing-entitlement-grid">
          <article
            v-for="feature in featureRows"
            :key="feature.entitlementKey"
            class="billing-entitlement-row"
            :class="{'is-enabled': feature.enabled, 'is-locked': !feature.enabled}"
          >
            <span class="material-icons">{{ feature.enabled ? 'lock_open' : 'lock' }}</span>
            <div>
              <h3>{{ t(feature.labelKey) }}</h3>
              <p>{{ feature.enabled ? t('billing.entitlements.available') : t('billing.entitlements.locked') }}</p>
            </div>
          </article>
        </div>

        <div v-if="lockedFeatureRows.length" class="billing-upgrade-guidance">
          <span class="material-icons">upgrade</span>
          <p>{{ t('billing.entitlements.upgrade-guidance') }}</p>
        </div>
      </section>
    </template>
  </section>
</template>
