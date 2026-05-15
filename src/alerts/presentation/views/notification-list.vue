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
const pageSize = 10;
let feedbackDismissTimeoutId = null;

const notifications = computed(() =>
    [...alertsStore.activeNotifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
);
const paginatedNotifications = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    return notifications.value.slice(start, start + pageSize);
});
const canAttendNotifications = computed(() => alertsStore.canResolveAlerts());

watch(notifications, () => {
    const maxPage = Math.max(1, Math.ceil(notifications.value.length / pageSize));
    if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(() => {
    alertsStore.clearFeedback();
    alertsStore.loadIncidents().catch(() => undefined);
});

onUnmounted(() => {
    clearFeedbackDismissTimeout();
});

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

function notificationChannelLabelKey(notification) {
    return `alerts.notification-list.channel-${notification.channel}`;
}

function notificationStatusLabelKey(notification) {
    return `alerts.notification-list.status-${notification.status}`;
}

function incidentForNotification(notification) {
    return alertsStore.organizationIncidents.find(incident => incident.id === notification.incidentId) ?? null;
}

function escalationLabelKey(incident) {
    return `alerts.notification-list.escalation-${incident.escalationStatus}`;
}

function severityLabelKey(incident) {
    return `alerts.notification-list.severity-${incident.severity}`;
}

function isAttending(notification) {
    const incident = incidentForNotification(notification);
    return Boolean(incident && alertsStore.recognizingId === incident.id);
}

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

function formatDate(isoDate) {
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(isoDate));
}

function showTimedFeedback(feedbackKey) {
    clearFeedbackDismissTimeout();
    alertsStore.setFeedback(feedbackKey);
    feedbackDismissTimeoutId = window.setTimeout(() => {
        alertsStore.clearFeedback();
        feedbackDismissTimeoutId = null;
    }, feedbackDismissDelayMs);
}

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
              <span>{{ notification.assetName }}</span>
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

        <div v-if="notifications.length === 0" class="notification-empty">
          <span class="material-icons">notifications_off</span>
          <p>{{ t('alerts.notification-list.empty-title') }}</p>
          <small>{{ t('alerts.notification-list.empty-description') }}</small>
        </div>
      </div>

      <list-pagination
        v-model="currentPage"
        :total="notifications.length"
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
</style>
