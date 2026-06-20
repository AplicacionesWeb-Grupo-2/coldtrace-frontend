<script setup>
import {computed, onMounted, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import {AssetType} from '@/asset-management/domain/model/asset-type.js';
import useMonitoringStore from '@/monitoring/application/monitoring.store.js';
import {TemperaturePoint} from '@/monitoring/domain/model/temperature-point-entity.js';
import MonitoringAssetCard from '@/monitoring/presentation/components/monitoring-asset-card.vue';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';

const {t} = useI18n();
const identityStore = useIdentityAccessStore();
const assetStore = useAssetManagementStore();
const monitoringStore = useMonitoringStore();
const searchTerm = ref('');
const activeType = ref(AssetType.ColdRoom);
const currentPage = ref(1);
const pageSize = 10;
const tabs = [
    {type: AssetType.ColdRoom, labelKey: 'monitoring.asset-monitoring.tabs.cold-room'},
    {type: AssetType.Transport, labelKey: 'monitoring.asset-monitoring.tabs.transport'},
];

const activeOrganizationId = computed(() => identityStore.currentOrganizationIdFrom());
const canMonitorAssets = computed(() => identityStore.canMonitorAssets());
const identityDataReady = computed(() => identityStore.roles.length > 0);
const filteredItems = computed(() => {
    const query = searchTerm.value.trim().toLowerCase();
    const organizationId = activeOrganizationId.value;

    return assetStore
        .assetsForOrganization(organizationId)
        .filter(asset => asset.type === activeType.value)
        .filter(asset => matchesSearch(asset, query))
        .map(asset => buildMonitoringItem(asset))
        .sort((left, right) => {
            const leftIssue = left.latestReading?.isOutOfRange ? 1 : 0;
            const rightIssue = right.latestReading?.isOutOfRange ? 1 : 0;
            return rightIssue - leftIssue || left.asset.name.localeCompare(right.asset.name);
        });
});
const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    return filteredItems.value.slice(start, start + pageSize);
});
const totalAssets = computed(() => filteredItems.value.length);
const assetsWithReadings = computed(() => filteredItems.value.filter(item => item.latestReading !== null).length);
const assetsOutOfRange = computed(() => filteredItems.value.filter(item => item.latestReading?.isOutOfRange).length);

watch([searchTerm, activeType], () => {
    currentPage.value = 1;
});

onMounted(() => {
    loadMonitoringDashboardData().catch(() => undefined);
});

/**
 * Loads monitoring dashboard data for the active organization.
 *
 * @returns {Promise<void>}
 */
async function loadMonitoringDashboardData() {
    if (!identityStore.usersLoaded || !identityStore.rolesLoaded || !identityStore.organizationsLoaded) {
        await identityStore.fetchAccessData();
    }

    const organizationId = activeOrganizationId.value;
    await Promise.all([
        assetStore.fetchAssetManagementData({organizationId}),
        monitoringStore.fetchMonitoringData({organizationId, includeDependencies: false}),
    ]);
}

/**
 * Builds monitoring item for presentation or reporting.
 *
 * @param {*} asset
 * @returns {*}
 */
function buildMonitoringItem(asset) {
    const readings = monitoringStore.getReadingsByAsset(asset.id);
    const settings = assetStore.settingsForAsset(activeOrganizationId.value, asset.id);
    const chartReadings = readings
        .filter(reading => reading.temperature !== null)
        .slice(0, 24)
        .reverse();
    const limits = temperatureLimitsFor(chartReadings, settings);

    return {
        asset,
        device: linkedDeviceFor(asset),
        location: assetLocationFor(asset),
        latestReading: readings[0] ?? null,
        settings,
        chartPoints: chartReadings.map((reading, index) => toTemperaturePoint(reading, index, limits)),
    };
}

/**
 * Handles linked device for behavior in the monitoring context.
 *
 * @param {*} asset
 * @returns {*}
 */
function linkedDeviceFor(asset) {
    return assetStore
        .iotDevicesForOrganization(activeOrganizationId.value)
        .find(device => device.assetId === asset.id) ?? null;
}

/**
 * Handles to temperature point behavior in the monitoring context.
 *
 * @param {*} reading
 * @param {number|string} index
 * @param {*} limits
 * @returns {*}
 */
function toTemperaturePoint(reading, index, limits) {
    const temperature = reading.temperature ?? 0;

    return new TemperaturePoint({
        id: reading.id || index,
        label: new Date(reading.recordedAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
        temperature,
        ghost: temperature,
        maxLimit: limits.max,
        minLimit: limits.min,
    });
}

/**
 * Handles temperature limits for behavior in the monitoring context.
 *
 * @param {Array<*>} readings
 * @param {*} settings
 * @returns {*}
 */
function temperatureLimitsFor(readings, settings) {
    if (settings) {
        return {min: settings.minimumTemperature, max: settings.maximumTemperature};
    }

    const temperatures = readings
        .map(reading => reading.temperature)
        .filter(temperature => temperature !== null && Number.isFinite(temperature));

    if (!temperatures.length) return {min: 0, max: 1};

    const min = Math.min(...temperatures);
    const max = Math.max(...temperatures);
    if (min === max) return {min: Math.floor(min - 1), max: Math.ceil(max + 1)};
    return {min: Math.floor(min), max: Math.ceil(max)};
}

/**
 * Handles matches search behavior in the monitoring context.
 *
 * @param {*} asset
 * @param {*} query
 * @returns {*}
 */
function matchesSearch(asset, query) {
    if (!query) return true;
    return [asset.name, asset.uuid, assetLocationFor(asset), asset.description]
        .join(' ')
        .toLowerCase()
        .includes(query);
}

/**
 * Handles asset location for behavior in the monitoring context.
 *
 * @param {*} asset
 * @returns {string}
 */
function assetLocationFor(asset) {
    return assetStore.locationForAsset(asset);
}
</script>

<template>
  <div class="monitoring-page">
    <header class="monitoring-header">
      <div class="header-main">
        <h1 class="page-title">{{ t('monitoring.asset-monitoring.title') }}</h1>
        <p class="page-subtitle">{{ t('monitoring.asset-monitoring.subtitle') }}</p>
      </div>

      <div v-if="canMonitorAssets" class="assets-toolbar monitoring-workbar" aria-label="Monitoring filters and status">
        <nav class="monitoring-tabs" aria-label="Monitoring asset sections">
          <button
            v-for="tab in tabs"
            :key="tab.type"
            type="button"
            :class="{active: activeType === tab.type}"
            @click="activeType = tab.type"
          >
            {{ t(tab.labelKey) }}
          </button>
        </nav>

        <label class="search-box">
          <span class="material-icons search-icon">search</span>
          <input
            v-model="searchTerm"
            type="search"
            :placeholder="t('monitoring.asset-monitoring.search-placeholder')"
          />
        </label>

        <div class="summary-pills" aria-label="Monitoring summary">
          <span>{{ t('monitoring.asset-monitoring.summary-assets') }}: {{ totalAssets }}</span>
          <span>{{ t('monitoring.asset-monitoring.summary-readings') }}: {{ assetsWithReadings }}</span>
          <span class="warning">{{ t('monitoring.asset-monitoring.summary-alerts') }}: {{ assetsOutOfRange }}</span>
        </div>
      </div>
    </header>

    <div v-if="!canMonitorAssets && identityDataReady" class="access-notice">
      <span class="material-icons">lock</span>
      <span>{{ t('monitoring.asset-monitoring.access-description') }}</span>
    </div>
    <div v-else class="monitoring-list">
      <monitoring-asset-card
        v-for="item in paginatedItems"
        :key="item.asset.id"
        :asset="item.asset"
        :device="item.device"
        :location="item.location"
        :latest-reading="item.latestReading"
        :settings="item.settings"
        :chart-points="item.chartPoints"
      />

      <div v-if="filteredItems.length === 0" class="empty-state">
        <span class="material-icons">inventory_2</span>
        <p>{{ t('monitoring.asset-monitoring.empty') }}</p>
      </div>

      <list-pagination
        v-if="filteredItems.length > 0"
        v-model="currentPage"
        :total="filteredItems.length"
        :page-size="pageSize"
      />
    </div>
  </div>
</template>

<style scoped>
.monitoring-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.monitoring-header {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.page-title {
  color: #0f172a;
  font-family: 'Inter', sans-serif;
  font-size: 24px;
  font-weight: 800;
  margin: 0;
}

.page-subtitle {
  color: #8a95a8;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
  margin: 0;
}

.monitoring-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.monitoring-tabs button {
  background: transparent;
  border: 0;
  color: #98a2b3;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 800;
  line-height: 20px;
  padding: 0;
  text-decoration: none;
}

.monitoring-tabs button.active {
  color: #2563eb;
  text-decoration: underline;
}

.assets-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  margin-top: 8px;
}

.monitoring-workbar {
  background: #ffffff;
  border: 1px solid #e5eaf1;
  border-radius: 8px;
  padding: 10px 12px;
}

.search-box {
  align-items: center;
  color: #cfd5df;
  display: flex;
  gap: 8px;
  min-width: min(320px, 100%);
}

.search-icon {
  color: #cfd5df;
  font-size: 26px;
  height: 26px;
  width: 26px;
}

.search-box input {
  background: transparent;
  border: 0;
  color: #404040;
  flex: 1;
  font: 800 12px/20px 'Inter', Arial, sans-serif;
  outline: 0;
}

.search-box input::placeholder {
  color: #98a2b3;
}

.summary-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-pills span {
  background: #ffffff;
  border: 1px solid #e5eaf1;
  border-radius: 8px;
  color: #667388;
  font-size: 12px;
  font-weight: 800;
  padding: 8px 10px;
}

.summary-pills .warning {
  color: #b45309;
}

.monitoring-list {
  display: flex;
  flex-direction: column;
}

.access-notice {
  align-items: center;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  color: #9a3412;
  display: flex;
  font-size: 13px;
  font-weight: 700;
  gap: 10px;
  padding: 14px 16px;
}

.access-notice .material-icons {
  font-size: 18px;
  height: 18px;
  width: 18px;
}

.empty-state {
  align-items: center;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  gap: 16px;
  justify-content: center;
  padding: 80px 0;
}

.empty-state .material-icons {
  font-size: 48px;
  height: 48px;
  width: 48px;
}

@media (max-width: 860px) {
  .assets-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
