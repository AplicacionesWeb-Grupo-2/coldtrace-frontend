<script setup>
import {useI18n} from 'vue-i18n';

defineProps({
    alerts: {type: Array, default: () => []},
});

const {t} = useI18n();

function statusLabelKey(status) {
    return status === 'Unacknowledged'
        ? 'monitoring.operational.status-unack'
        : 'monitoring.operational.status-ack';
}
</script>

<template>
  <div class="premium-card table-card">
    <div class="card-header">
      <h3 class="card-title">{{ t('monitoring.operational.recent-alerts') }}</h3>
      <button class="more-btn" type="button"><span class="material-icons">more_horiz</span></button>
    </div>

    <div class="table-container">
      <table class="premium-table">
        <thead>
          <tr>
            <th>{{ t('monitoring.operational.col-asset') }}</th>
            <th>{{ t('monitoring.operational.col-type') }}</th>
            <th>{{ t('monitoring.operational.col-value') }}</th>
            <th>{{ t('monitoring.operational.col-date') }}</th>
            <th>{{ t('monitoring.operational.col-status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="alert in alerts" :key="alert.id">
            <td class="asset-name">{{ alert.assetName }}</td>
            <td>
              <div class="type-cell" :class="{warn: alert.severity === 'warning', crit: alert.severity === 'critical', info: alert.severity === 'info'}">
                <span class="material-icons">{{ alert.icon }}</span>
                <span>{{ t(alert.type) }}</span>
              </div>
            </td>
            <td class="value">{{ alert.value }}</td>
            <td class="date">{{ alert.date }}</td>
            <td><span class="badge" :class="{unack: alert.status === 'Unacknowledged', ack: alert.status === 'Acknowledged'}">{{ t(statusLabelKey(alert.status)) }}</span></td>
          </tr>
          <tr v-if="!alerts.length">
            <td colspan="5" class="empty-cell">{{ t('monitoring.operational.no-alerts') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px 28px 18px;
}

.card-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}

.card-title {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.more-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
}

.more-btn .material-icons {
  font-size: 20px;
}

.table-container {
  flex: 1;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.premium-table {
  border-collapse: collapse;
  min-width: 640px;
  width: 100%;
}

.premium-table th {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  color: #9ca3af;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  padding: 0 12px 8px;
  text-align: left;
  text-transform: none;
}

.premium-table td {
  border-bottom: 1px solid rgba(0, 0, 0, 0.035);
  color: #4b5563;
  font-size: 11.5px;
  height: 30px;
  padding: 6px 12px;
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
}

.type-cell {
  align-items: center;
  display: flex;
  font-size: 11.5px;
  font-weight: 500;
  gap: 8px;
}

.type-cell .material-icons {
  font-size: 16px;
  height: 16px;
  width: 16px;
}

.warn,
.crit {
  color: #dc2626;
}

.warn .material-icons {
  color: #fca5a5;
}

.crit .material-icons {
  color: #ef4444;
}

.info {
  color: #d97706;
}

.info .material-icons {
  color: #fbbf24;
}

.value {
  color: #111827;
  font-weight: 600;
}

.date {
  color: #6b7280;
  font-size: 11.5px;
  font-weight: 500;
}

.badge {
  border-radius: 5px;
  display: inline-block;
  font-size: 10px;
  font-weight: 500;
  min-width: 120px;
  padding: 4px 8px;
  text-align: center;
}

.unack {
  background: #fee2e2;
  color: #dc2626;
}

.ack {
  background: #dcfce7;
  color: #16a34a;
}

.empty-cell {
  color: #8b95a6;
  font-size: 12px;
  font-weight: 700;
  height: 180px !important;
  text-align: center !important;
}

tr:hover {
  background: #fafbfc;
}

tr:last-child td {
  border-bottom: none;
}
</style>
