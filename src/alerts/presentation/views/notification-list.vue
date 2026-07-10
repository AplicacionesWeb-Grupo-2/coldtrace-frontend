<script setup>
import {computed, onMounted, onUnmounted, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import useAlertsStore from '@/alerts/application/alerts.store.js';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';

const {t} = useI18n();
const alertsStore = useAlertsStore();
const identityAccessStore = useIdentityAccessStore();
const feedbackDismissDelayMs = 3000;
const currentPage = ref(1);
const searchTerm = ref('');
const selectedNotificationFilter = ref('active');
const pageSize = 10;
let feedbackDismissTimeoutId = null;

const notifications = computed(() =>
    [...alertsStore.activeNotifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
);
const filteredNotifications = computed(() => {
    const normalizedSearch = searchTerm.value.trim().toLowerCase();
    const filteredByStatus = notifications.value.filter(notification => matchesNotificationFilter(notification));

    if (!normalizedSearch) return filteredByStatus;

    return filteredByStatus.filter(notification => {
        const incident = incidentForNotification(notification);

        return [
            notification.assetName,
            notification.message,
            notification.recipient,
            notification.channel,
            notification.status,
            incident?.severity ?? '',
            incident?.escalationStatus ?? '',
        ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);
    });
});
const paginatedNotifications = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    return filteredNotifications.value.slice(start, start + pageSize);
});
const canAttendNotifications = computed(() => alertsStore.canResolveAlerts());
const activeOrganizationId = computed(() => identityAccessStore.currentOrganizationIdFrom());

watch(filteredNotifications, () => {
    const maxPage = Math.max(1, Math.ceil(filteredNotifications.value.length / pageSize));
    if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(() => {
    alertsStore.clearFeedback();
    alertsStore.loadIncidents({organizationId: activeOrganizationId.value}).catch(() => undefined);
});

onUnmounted(() => {
    clearFeedbackDismissTimeout();
});

/**
 * Handles notification channel icon behavior in the alerts context.
 *
 * @param {*} notification
 * @returns {string}
 */
function notificationChannelIcon(notification) {
    switch (notification.channel) {
        case 'email':
            return 'mail';
        case 'sms':
            return 'sms';
        default:
            return 'notifications';
    }
}

/**
 * Returns the i18n label key for notification channel.
 *
 * @param {*} notification
 * @returns {string}
 */
function notificationChannelLabelKey(notification) {
    return `alerts.notification-list.channel-${notification.channel}`;
}

/**
 * Returns the i18n label key for notification status.
 *
 * @param {*} notification
 * @returns {string}
 */
function notificationStatusLabelKey(notification) {
    return `alerts.notification-list.status-${notification.status}`;
}

/**
 * Handles notification title behavior in the alerts context.
 *
 * @param {*} notification
 * @returns {string}
 */
function notificationTitle(notification) {
    return incidentForNotification(notification)?.assetName || notification.message;
}

/**
 * Handles incident for notification behavior in the alerts context.
 *
 * @param {*} notification
 * @returns {*}
 */
function incidentForNotification(notification) {
    return alertsStore.organizationIncidents.find(incident => incident.id === notification.incidentId) ?? null;
}

/**
 * Returns the i18n label key for escalation.
 *
 * @param {*} incident
 * @returns {string}
 */
function escalationLabelKey(incident) {
    return `alerts.notification-list.escalation-${incident.escalationStatus}`;
}

/**
 * Returns the i18n label key for severity.
 *
 * @param {*} incident
 * @returns {string}
 */
function severityLabelKey(incident) {
    return `alerts.notification-list.severity-${incident.severity}`;
}

/**
 * Determines whether attending is true.
 *
 * @param {*} notification
 * @returns {boolean}
 */
function isAttending(notification) {
    const incident = incidentForNotification(notification);
    return Boolean(incident && alertsStore.recognizingId === incident.id);
}

/**
 * Selects notification filter in the current view state.
 *
 * @param {'active'|'pending'|'failed'} filter
 * @returns {void}
 */
function selectNotificationFilter(filter) {
    selectedNotificationFilter.value = filter;
    currentPage.value = 1;
}

/**
 * Updates notification search term in the current view state.
 *
 * @param {string} value
 * @returns {void}
 */
function updateSearchTerm(value) {
    searchTerm.value = value;
    currentPage.value = 1;
}

/**
 * Determines whether notification matches the selected filter.
 *
 * @param {*} notification
 * @returns {boolean}
 */
function matchesNotificationFilter(notification) {
    switch (selectedNotificationFilter.value) {
        case 'active':
            return Boolean(incidentForNotification(notification)?.isOpen);
        case 'pending':
            return notification.isPending;
        case 'failed':
            return notification.isFailed;
        default:
            return true;
    }
}

/**
 * Handles attend notification behavior in the alerts context.
 *
 * @param {*} notification
 * @returns {*}
 */
function attendNotification(notification) {
    const incident = incidentForNotification(notification);
    if (!incident || !incident.isOpen) return;

    if (!canAttendNotifications.value) {
        showTimedFeedback('alerts.notification-list.feedback-access-denied');
        return;
    }

    const responsibleUserName = identityAccessStore.currentUserNameFrom();
    alertsStore.recognizeIncident(incident, responsibleUserName)
        .then(() => showTimedFeedback('alerts.notification-list.feedback-attended'))
        .catch(() => showTimedFeedback('alerts.notification-list.feedback-error'));
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

/**
 * Handles show timed feedback behavior in the alerts context.
 *
 * @param {string} feedbackKey
 * @returns {string}
 */
function showTimedFeedback(feedbackKey) {
    clearFeedbackDismissTimeout();
    alertsStore.setFeedback(feedbackKey);
    feedbackDismissTimeoutId = window.setTimeout(() => {
        alertsStore.clearFeedback();
        feedbackDismissTimeoutId = null;
    }, feedbackDismissDelayMs);
}

/**
 * Handles clear feedback dismiss timeout behavior in the alerts context.
 *
 * @returns {string}
 */
function clearFeedbackDismissTimeout() {
    if (feedbackDismissTimeoutId === null) return;
    window.clearTimeout(feedbackDismissTimeoutId);
    feedbackDismissTimeoutId = null;
}
</script>

<template>
  <div class="notification-list-view">
    <div class="view-header">
      <div class="header-text">
        <h1 class="view-title">{{ t('alerts.notification-list.title') }}</h1>
        <p class="view-subtitle">{{ t('alerts.notification-list.subtitle') }}</p>
      </div>
    </div>

    <div class="notification-toolbar">
      <nav class="notification-filter-tabs" aria-label="Notification filters">
        <button
          type="button"
          :class="{active: selectedNotificationFilter === 'active'}"
          @click="selectNotificationFilter('active')"
        >
          {{ t('alerts.notification-list.filter-active') }}
        </button>
        <button
          type="button"
          :class="{active: selectedNotificationFilter === 'pending'}"
          @click="selectNotificationFilter('pending')"
        >
          {{ t('alerts.notification-list.filter-pending') }}
        </button>
        <button
          type="button"
          :class="{active: selectedNotificationFilter === 'failed'}"
          @click="selectNotificationFilter('failed')"
        >
          {{ t('alerts.notification-list.filter-failed') }}
        </button>
      </nav>

      <label class="search-box">
        <span class="material-icons search-icon" aria-hidden="true">search</span>
        <input
          type="search"
          :value="searchTerm"
          :placeholder="t('alerts.notification-list.search-placeholder')"
          @input="updateSearchTerm($event.target.value)"
        />
      </label>
    </div>

    <div v-if="alertsStore.loading" class="loading-container">
      <span class="loading-spinner"></span>
    </div>
    <div v-else class="premium-card notification-card">
      <div class="card-header notification-header">
        <div>
          <h3 class="card-title">{{ t('alerts.notification-list.card-title') }}</h3>
          <p class="notification-subtitle">
            {{ t('alerts.notification-list.card-subtitle') }}
          </p>
        </div>
        <div class="notification-summary">
          <span class="notification-count">
            {{ notifications.length }} {{ t('alerts.notification-list.total') }}
          </span>
          <span class="notification-count active">
            {{ alertsStore.openIncidentsCount }}
            {{ t('alerts.notification-list.active-alerts') }}
          </span>
          <span class="notification-count pending">
            {{ alertsStore.pendingNotificationsCount }}
            {{ t('alerts.notification-list.pending') }}
          </span>
          <span class="notification-count failed">
            {{ alertsStore.failedNotificationsCount }}
            {{ t('alerts.notification-list.failed') }}
          </span>
        </div>
      </div>

      <div v-if="alertsStore.feedback" class="notification-feedback">
        {{ t(alertsStore.feedback) }}
      </div>

      <div class="notification-list">
        <div v-for="notification in paginatedNotifications" :key="notification.id" class="notification-row">
          <div
            class="notification-channel"
            :class="{
              'channel-app': notification.channel === 'app',
              'channel-email': notification.channel === 'email',
              'channel-sms': notification.channel === 'sms',
            }"
          >
            <span class="material-icons">{{ notificationChannelIcon(notification) }}</span>
          </div>

          <div class="notification-content">
            <div class="notification-title-line">
              <span>{{ notificationTitle(notification) }}</span>
              <small>{{ t(notificationChannelLabelKey(notification)) }}</small>
              <template v-if="incidentForNotification(notification)">
                <small
                  class="notification-severity"
                  :class="{
                    'notification-critical': incidentForNotification(notification).severity === 'critical',
                    'notification-warning': incidentForNotification(notification).severity === 'warning',
                  }"
                >
                  {{ t(severityLabelKey(incidentForNotification(notification))) }}
                </small>
                <small
                  v-if="incidentForNotification(notification).escalationStatus !== 'none'"
                  class="notification-escalation"
                  :class="{
                    'notification-escalated': incidentForNotification(notification).isEscalated,
                    'notification-escalation-pending': incidentForNotification(notification).isPendingEscalationConfiguration,
                    'notification-escalation-reviewed': incidentForNotification(notification).escalationStatus === 'reviewed',
                  }"
                >
                  {{ t(escalationLabelKey(incidentForNotification(notification))) }}
                </small>
              </template>
            </div>
            <p>{{ notification.message }}</p>
            <small>
              {{ t('alerts.notification-list.recipient') }} {{ notification.recipient }}
            </small>
          </div>

          <div class="notification-state">
            <span
              class="notification-status"
              :class="{
                'notification-sent': notification.isSent,
                'notification-pending': notification.isPending,
                'notification-failed': notification.isFailed,
              }"
            >
              {{ t(notificationStatusLabelKey(notification)) }}
            </span>
            <small>{{ formatDate(notification.createdAt) }}</small>
            <template v-if="incidentForNotification(notification)">
              <button
                v-if="incidentForNotification(notification).isOpen"
                class="attend-action"
                type="button"
                :disabled="!canAttendNotifications || isAttending(notification)"
                @click="attendNotification(notification)"
              >
                <span class="material-icons">done</span>
                {{
                  t(isAttending(notification)
                    ? 'alerts.notification-list.attending'
                    : 'alerts.notification-list.action-attend')
                }}
              </button>
            </template>
          </div>
        </div>

        <div v-if="filteredNotifications.length === 0" class="notification-empty">
          <span class="material-icons">notifications_off</span>
          <p>{{ t('alerts.notification-list.empty-title') }}</p>
          <small>{{ t('alerts.notification-list.empty-description') }}</small>
        </div>
      </div>

      <list-pagination
        v-model="currentPage"
        :total="filteredNotifications.length"
        :page-size="pageSize"
      />
    </div>
  </div>
</template>

<style scoped>
.notification-list-view {
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

.view-subtitle,
.notification-subtitle {
  color: #6b7280;
  font-size: 13px;
  margin: 0;
}

.premium-card {
  background: #ffffff;
  border-radius: 14px;
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.04);
}

.notification-card {
  display: flex;
  flex-direction: column;
  padding: 22px 28px;
}

.notification-toolbar {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  min-height: 40px;
}

.notification-filter-tabs {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.notification-filter-tabs button {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #667085;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  min-height: 36px;
  padding: 0 14px;
}

.notification-filter-tabs button.active,
.notification-filter-tabs button:hover {
  background: #eff4ff;
  border-color: #bfdbfe;
  color: #2563eb;
}

.search-box {
  align-items: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #98a2b3;
  display: flex;
  gap: 10px;
  min-height: 38px;
  min-width: min(460px, 100%);
  padding: 0 12px;
}

.search-icon {
  color: #98a2b3;
  font-size: 20px;
  height: 20px;
  line-height: 20px;
  width: 20px;
}

.search-box input {
  background: transparent;
  border: 0;
  color: #263348;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  outline: 0;
  width: 100%;
}

.card-header {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.notification-subtitle {
  font-size: 12px;
  margin-top: 4px;
}

.notification-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.notification-count {
  background: #eef2ff;
  border-radius: 20px;
  color: #3b66f5;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  white-space: nowrap;
}

.notification-count.pending {
  background: #fef3c7;
  color: #b45309;
}

.notification-count.active {
  background: #e0f2fe;
  color: #0369a1;
}

.notification-count.failed {
  background: #fee2e2;
  color: #dc2626;
}

.notification-feedback {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 14px;
  padding: 10px 12px;
}

.notification-list {
  display: grid;
  gap: 10px;
}

.notification-row {
  align-items: center;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  display: grid;
  gap: 12px;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  padding: 12px;
}

.notification-channel {
  align-items: center;
  border-radius: 8px;
  display: flex;
  height: 34px;
  justify-content: center;
  width: 34px;
}

.notification-channel .material-icons {
  font-size: 18px;
  height: 18px;
  line-height: 18px;
  width: 18px;
}

.channel-app {
  background: #dbeafe;
  color: #1d4ed8;
}

.channel-email {
  background: #ecfdf5;
  color: #047857;
}

.channel-sms {
  background: #fef3c7;
  color: #b45309;
}

.notification-content {
  min-width: 0;
}

.notification-title-line {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.notification-title-line span {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.notification-title-line small,
.notification-content small,
.notification-state small {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 600;
}

.notification-title-line .notification-escalation {
  border-radius: 999px;
  color: #4b5563;
  padding: 2px 8px;
}

.notification-title-line .notification-severity {
  border-radius: 999px;
  padding: 2px 8px;
}

.notification-title-line .notification-critical {
  background: #fee2e2;
  color: #dc2626;
}

.notification-title-line .notification-warning {
  background: #fef3c7;
  color: #b45309;
}

.notification-title-line .notification-escalated {
  background: #fee2e2;
  color: #dc2626;
}

.notification-title-line .notification-escalation-pending {
  background: #fef3c7;
  color: #b45309;
}

.notification-title-line .notification-escalation-reviewed {
  background: #dcfce7;
  color: #15803d;
}

.notification-content p {
  color: #4b5563;
  font-size: 12px;
  margin: 3px 0;
}

.notification-state {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 148px;
}

.notification-status {
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 10px;
}

.notification-sent {
  background: #dcfce7;
  color: #15803d;
}

.notification-pending {
  background: #fef3c7;
  color: #b45309;
}

.notification-failed {
  background: #fee2e2;
  color: #dc2626;
}

.attend-action {
  align-items: center;
  background: #ffffff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  color: #2563eb;
  cursor: pointer;
  display: inline-flex;
  font-size: 11px;
  font-weight: 800;
  gap: 4px;
  height: 34px;
  line-height: 34px;
  padding: 0 10px;
  white-space: nowrap;
}

.attend-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.attend-action .material-icons {
  font-size: 16px;
  height: 16px;
  line-height: 16px;
  width: 16px;
}

.notification-empty,
.loading-container {
  align-items: center;
  color: #9ca3af;
  display: flex;
  justify-content: center;
}

.notification-empty {
  flex-direction: column;
  gap: 4px;
  padding: 24px 0;
  text-align: center;
}

.notification-empty .material-icons {
  font-size: 26px;
}

.notification-empty p {
  color: #374151;
  font-size: 13px;
  font-weight: 700;
  margin: 0;
}

.loading-container {
  padding: 80px 0;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .notification-row {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .notification-state {
    align-items: flex-start;
    grid-column: 2;
  }
}

@media (max-width: 720px) {
  .notification-list-view {
    gap: 16px;
    padding: 22px 16px;
  }

  .notification-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .notification-filter-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .notification-filter-tabs button {
    padding: 0 8px;
    width: 100%;
  }

  .search-box {
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
  }

  .notification-card {
    padding: 18px 14px;
  }

  .card-header {
    flex-direction: column;
    gap: 12px;
  }

  .notification-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-content: stretch;
    width: 100%;
  }

  .notification-count {
    text-align: center;
  }

  .notification-row {
    align-items: start;
    gap: 10px;
    grid-template-columns: 34px minmax(0, 1fr);
    padding: 12px 10px;
  }

  .notification-state {
    align-items: flex-start;
    grid-column: 2;
    min-width: 0;
    width: 100%;
  }

  .notification-content p,
  .notification-content small {
    overflow-wrap: anywhere;
  }
}
</style>
