<script setup>
import {computed, onMounted, onUnmounted} from 'vue';
import {useI18n} from 'vue-i18n';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import {AssetStatus} from '@/asset-management/domain/model/asset-status.js';
import {CalibrationStatus} from '@/asset-management/domain/model/calibration-status.js';
import {GatewayStatus} from '@/asset-management/domain/model/gateway-status.js';
import {IoTDeviceStatus} from '@/asset-management/domain/model/iot-device-status.js';
import useMonitoringStore from '@/monitoring/application/monitoring.store.js';
import {DashboardKpi} from '@/monitoring/domain/model/dashboard-kpi.js';
import {IncidentDay} from '@/monitoring/domain/model/incident-day-entity.js';
import {MaintenanceTask} from '@/monitoring/domain/model/maintenance-task-entity.js';
import {MaintenanceScheduleStatus} from '@/monitoring/domain/model/maintenance-schedule-entity.js';
import {RecentAlert} from '@/monitoring/domain/model/recent-alert-entity.js';
import {StorageDistributionItem} from '@/monitoring/domain/model/storage-distribution-item-entity.js';
import {TechnicalServiceStatus} from '@/monitoring/domain/model/technical-service-request-entity.js';
import {TemperaturePoint} from '@/monitoring/domain/model/temperature-point-entity.js';
import IncidentsChart from '@/monitoring/presentation/components/incidents-chart.vue';
import DashboardAiAssistant from '@/monitoring/presentation/components/dashboard-ai-assistant.vue';
import MaintenanceList from '@/monitoring/presentation/components/maintenance-list.vue';
import RecentAlerts from '@/monitoring/presentation/components/recent-alerts.vue';
import StatCard from '@/monitoring/presentation/components/stat-card.vue';
import StorageDistribution from '@/monitoring/presentation/components/storage-distribution.vue';
import TemperatureChart from '@/monitoring/presentation/components/temperature-chart.vue';

const TELEMETRY_POLLING_INTERVAL_MS = 12000;
const {t, locale} = useI18n();
const identityStore = useIdentityAccessStore();
const assetStore = useAssetManagementStore();
const monitoringStore = useMonitoringStore();
let telemetryIntervalId = null;

const activeOrganizationId = computed(() => identityStore.currentOrganizationIdFrom());
const organizationAssets = computed(() => assetStore.assetsForOrganization(activeOrganizationId.value));
const organizationAssetIds = computed(() => organizationAssets.value.map(asset => asset.id));
const organizationIoTDevices = computed(() => assetStore.iotDevicesForOrganization(activeOrganizationId.value));
const organizationGateways = computed(() => assetStore.gatewaysForOrganization(activeOrganizationId.value));
const organizationMaintenanceSchedules = computed(() => monitoringStore.schedulesForOrganization(activeOrganizationId.value));
const organizationTechnicalServices = computed(() => monitoringStore.technicalServicesForOrganization(activeOrganizationId.value));
const organizationReadings = computed(() => {
    const since = new Date();
    since.setHours(since.getHours() - 24);
    return monitoringStore.readingsForAssetIdsSince(organizationAssetIds.value, since);
});
const organizationIncidents = computed(() => monitoringStore.incidentsForOrganization(activeOrganizationId.value));
const activeIncidents = computed(() => organizationIncidents.value.filter(incident => !incident.isClosed));
const activeCriticalIncidents = computed(() => activeIncidents.value.filter(incident => incident.severity === 'critical'));
const assetSummary = computed(() => assetStore.operationalSummaryFor(activeOrganizationId.value));
const currentSettings = computed(() =>
    assetStore.defaultSettingsForOrganization(activeOrganizationId.value) ??
    assetStore.assetSettingsForOrganization(activeOrganizationId.value)[0] ??
    null,
);
const monitoredAssetsKpi = computed(() => buildMonitoredAssetsKpi());
const criticalAlertsKpi = computed(() => buildCriticalAlertsKpi());
const activeSensorsKpi = computed(() => buildActiveSensorsKpi());
const incidentsKpi = computed(() => buildIncidentsKpi());
const thermalComplianceKpi = computed(() => buildThermalComplianceKpi());
const temperaturePoints = computed(() => buildTemperaturePoints());
const storageDistribution = computed(() => buildStorageDistribution());
const maintenanceTasks = computed(() => buildMaintenanceTasks());
const recentAlerts = computed(() => buildRecentAlerts());
const incidentDays = computed(() => buildIncidentDays());
const timeline = computed(() => buildTimeline());
const maintenanceCompletionRate = computed(() => {
    const schedules = organizationMaintenanceSchedules.value.filter(schedule => schedule.status !== MaintenanceScheduleStatus.Canceled);
    const technicalServices = organizationTechnicalServices.value;
    const total = schedules.length + technicalServices.length;
    if (!total) return 0;

    const completed = schedules.filter(schedule => schedule.status === MaintenanceScheduleStatus.Completed).length +
        technicalServices.filter(request => request.status === TechnicalServiceStatus.Closed).length;

    return Math.round((completed / total) * 100);
});
const loading = computed(() => monitoringStore.loading || assetStore.loading);
const hasOperationalData = computed(() =>
    assetSummary.value.totalAssets > 0 ||
    organizationIoTDevices.value.length > 0 ||
    organizationGateways.value.length > 0 ||
    organizationMaintenanceSchedules.value.length > 0 ||
    organizationTechnicalServices.value.length > 0 ||
    organizationReadings.value.length > 0 ||
    organizationIncidents.value.length > 0,
);

onMounted(() => {
    loadOperationalDashboardData().then(async () => {
        await monitoringStore.syncGeneratedIncidentsForOrganization(activeOrganizationId.value).catch(() => undefined);
    }).catch(() => undefined);

    telemetryIntervalId = window.setInterval(() => {
        monitoringStore.updateOrganizationTelemetry(activeOrganizationId.value).catch(() => undefined);
    }, TELEMETRY_POLLING_INTERVAL_MS);
});

/**
 * Loads operational dashboard data for the active organization.
 *
 * @returns {Promise<void>}
 */
async function loadOperationalDashboardData() {
    if (!identityStore.usersLoaded || !identityStore.rolesLoaded || !identityStore.organizationsLoaded) {
        await identityStore.fetchAccessData();
    }

    const organizationId = activeOrganizationId.value;
    await Promise.all([
        assetStore.fetchAssetManagementData({organizationId}),
        monitoringStore.fetchMonitoringData({organizationId}),
    ]);
}

onUnmounted(() => {
    if (telemetryIntervalId) window.clearInterval(telemetryIntervalId);
});

/**
 * Builds monitored assets kpi for presentation or reporting.
 *
 * @returns {*}
 */
function buildMonitoredAssetsKpi() {
    const summary = assetSummary.value;
    return kpi({
        id: 1,
        key: 'monitored-assets',
        title: 'monitoring.operational.metric-monitored',
        value: `${summary.monitoredAssets}`,
        valueUnit: 'monitoring.operational.unit-assets',
        size: 'large',
        color: {bg: '#3B66F5', border: '#3B66F5', text: '#FFFFFF', chart: 'rgba(255,255,255,0.7)'},
        tooltip: {text: 'monitoring.operational.label-monitored', position: 82},
        chartData: buildSummaryBars([
            summary.totalAssets,
            summary.monitoredAssets,
            summary.connectedDevices,
            summary.connectedGateways,
            summary.assetsWithIssues,
            organizationReadings.value.length,
        ], 13),
        highlightedBar: 10,
        showAnchor: false,
    });
}

/**
 * Builds critical alerts kpi for presentation or reporting.
 *
 * @returns {*}
 */
function buildCriticalAlertsKpi() {
    return kpi({
        id: 2,
        key: 'critical-alerts',
        title: 'monitoring.operational.metric-critical-alerts',
        value: `${activeCriticalIncidents.value.length}`,
        valueUnit: 'monitoring.operational.label-open',
        size: 'large',
        type: 'wave',
        color: {bg: '#8B31E3', border: '#8B31E3', text: '#FFFFFF', chart: 'rgba(255,255,255,0.8)'},
        tooltip: {text: 'monitoring.operational.label-open', position: 52},
        chartData: [],
        highlightedBar: -1,
        showAnchor: true,
    });
}

/**
 * Builds active sensors kpi for presentation or reporting.
 *
 * @returns {*}
 */
function buildActiveSensorsKpi() {
    const summary = assetSummary.value;
    const linkedDevices = organizationIoTDevices.value.filter(iotDevice =>
        iotDevice.status === IoTDeviceStatus.Linked && iotDevice.calibrationStatus === CalibrationStatus.Calibrated,
    ).length;
    const availableDevices = organizationIoTDevices.value.filter(iotDevice => iotDevice.status === IoTDeviceStatus.Available).length;
    const offlineDevices = organizationIoTDevices.value.filter(iotDevice => iotDevice.status === IoTDeviceStatus.Offline).length;

    return kpi({
        id: 3,
        key: 'active-sensors',
        title: 'monitoring.operational.metric-sensors',
        value: `${linkedDevices}`,
        valueUnit: 'monitoring.operational.unit-devices',
        size: 'small',
        color: {bg: '#D8F0FF', border: '#D8F0FF', text: '#3B66F5', chart: '#3B66F5'},
        tooltip: {text: 'monitoring.operational.label-linked', position: 82},
        chartData: buildStatusBars([linkedDevices, availableDevices, offlineDevices, summary.connectedGateways]),
        highlightedBar: 8,
        showAnchor: false,
    });
}

/**
 * Builds incidents kpi for presentation or reporting.
 *
 * @returns {*}
 */
function buildIncidentsKpi() {
    const count = activeIncidents.value.length;
    const openCount = activeIncidents.value.filter(incident => incident.isOpen).length;
    const recognizedCount = activeIncidents.value.filter(incident => incident.isRecognized).length;
    const warningCount = activeIncidents.value.filter(incident => incident.severity === 'warning').length;
    const criticalCount = activeIncidents.value.filter(incident => incident.severity === 'critical').length;

    return kpi({
        id: 4,
        key: 'incidents',
        title: 'monitoring.operational.metric-incidents',
        value: `${count}`,
        valueUnit: 'monitoring.operational.label-open',
        size: 'small',
        color: {bg: '#F2E6FF', border: '#F2E6FF', text: '#8B31E3', chart: '#8B31E3'},
        tooltip: {text: 'monitoring.operational.label-open', position: 78},
        chartData: buildStatusBars([openCount, recognizedCount, warningCount, criticalCount]),
        highlightedBar: 5,
        showAnchor: false,
    });
}

/**
 * Builds thermal compliance kpi for presentation or reporting.
 *
 * @returns {*}
 */
function buildThermalComplianceKpi() {
    const thermalReadings = organizationReadings.value.filter(reading => reading.temperature !== null);
    const compliance = thermalComplianceFor(thermalReadings);

    return kpi({
        id: 5,
        key: 'thermal-compliance',
        title: 'monitoring.operational.metric-compliance',
        value: `${compliance}%`,
        valueUnit: 'monitoring.operational.label-in-range',
        size: 'small',
        color: {bg: '#E6F9EB', border: '#E6F9EB', text: '#10B981', chart: '#10B981'},
        tooltip: {text: 'monitoring.operational.label-avg', position: 85},
        chartData: buildStatusBars(thermalReadings.slice(0, 11).map(reading => isThermalReadingInRange(reading) ? 92 : 42)),
        highlightedBar: 9,
        showAnchor: false,
    });
}

/**
 * Builds temperature points for presentation or reporting.
 *
 * @returns {*}
 */
function buildTemperaturePoints() {
    const {max: maxLimit, min: minLimit} = currentTemperatureLimits();
    const readings = organizationReadings.value.filter(reading => reading.temperature !== null);
    if (!readings.length) return [];

    const now = new Date();
    const initialTemperature = [...readings].sort((left, right) =>
        new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
    )[0]?.temperature ?? (minLimit + maxLimit) / 2;
    let previousTemperature = initialTemperature;

    return Array.from({length: 24}, (_item, index) => {
        const bucketStart = new Date(now);
        bucketStart.setMinutes(0, 0, 0);
        bucketStart.setHours(bucketStart.getHours() - (23 - index));

        const bucketEnd = new Date(bucketStart);
        bucketEnd.setHours(bucketEnd.getHours() + 1);

        const readingsInBucket = readings.filter(reading => {
            const recordedAt = new Date(reading.recordedAt).getTime();
            return recordedAt >= bucketStart.getTime() && recordedAt < bucketEnd.getTime();
        });
        const temperature = readingsInBucket.length
            ? average(readingsInBucket.map(reading => reading.temperature ?? previousTemperature))
            : previousTemperature;
        const point = new TemperaturePoint({
            id: index + 1,
            label: hourLabel(bucketStart.toISOString()),
            temperature: Number(temperature.toFixed(1)),
            ghost: Number(previousTemperature.toFixed(1)),
            maxLimit,
            minLimit,
        });

        previousTemperature = point.temperature;
        return point;
    });
}

/**
 * Builds storage distribution for presentation or reporting.
 *
 * @returns {*}
 */
function buildStorageDistribution() {
    const assets = organizationAssets.value;
    const total = assets.length;
    if (!total) return [];

    const latestReadingsByAssetId = latestTemperatureReadingsByAssetId();
    const counts = {
        frozen: 0,
        refrigerated: 0,
        ambient: 0,
        noData: 0,
    };

    assets.forEach(asset => {
        counts[thermalStateForAsset(asset, latestReadingsByAssetId)] += 1;
    });

    const groups = [
        {
            id: 1,
            label: 'monitoring.operational.storage-frozen',
            count: counts.frozen,
            color: '#91BDFF',
        },
        {
            id: 2,
            label: 'monitoring.operational.storage-refrigerated',
            count: counts.refrigerated,
            color: '#51BD7A',
        },
        {
            id: 3,
            label: 'monitoring.operational.storage-ambient',
            count: counts.ambient,
            color: '#F5BD38',
        },
        {
            id: 4,
            label: 'monitoring.operational.storage-other',
            count: counts.noData,
            color: '#9AA3AF',
        },
    ];

    return groups.map(group => new StorageDistributionItem({
        id: group.id,
        label: group.label,
        assetCount: group.count,
        percentage: Number(((group.count / total) * 100).toFixed(1)),
        color: group.color,
    }));
}

/**
 * Resolves the latest temperature reading per asset.
 *
 * @returns {Map<number, *>}
 */
function latestTemperatureReadingsByAssetId() {
    const readingsByAssetId = new Map();

    organizationReadings.value.forEach(reading => {
        if (reading.temperature === null || readingsByAssetId.has(Number(reading.assetId))) return;
        readingsByAssetId.set(Number(reading.assetId), reading);
    });

    return readingsByAssetId;
}

/**
 * Resolves the dashboard thermal state for one asset.
 *
 * @param {*} asset
 * @param {Map<number, *>} readingsByAssetId
 * @returns {'frozen'|'refrigerated'|'ambient'|'noData'}
 */
function thermalStateForAsset(asset, readingsByAssetId) {
    const reading = readingsByAssetId.get(Number(asset.id));
    const settings = assetStore.settingsForAsset(activeOrganizationId.value, asset.id);

    if (!reading || reading.temperature === null || !settings) return 'noData';
    if (reading.temperature <= 0) return 'frozen';
    if (reading.temperature <= settings.maximumTemperature) return 'refrigerated';
    return 'ambient';
}

/**
 * Builds maintenance tasks for presentation or reporting.
 *
 * @returns {*}
 */
function buildMaintenanceTasks() {
    const technicalServiceTasks = organizationTechnicalServices.value
        .filter(request => request.status !== TechnicalServiceStatus.Closed)
        .sort((left, right) => priorityForRequest(right.priority) - priorityForRequest(left.priority))
        .slice(0, 3)
        .map((request, index) => new MaintenanceTask({
            id: index + 1,
            label: `${request.uuid} · ${assetNameFor(request.assetId)}`,
            icon: iconForTechnicalService(request.priority),
            status: request.status === TechnicalServiceStatus.PendingReview ? 'doing' : 'to-do',
        }));

    const preventiveTasks = organizationMaintenanceSchedules.value
        .filter(schedule => schedule.status !== MaintenanceScheduleStatus.Canceled)
        .sort((left, right) =>
            maintenanceStatusWeight(left.status) - maintenanceStatusWeight(right.status) ||
            new Date(left.scheduledDate).getTime() - new Date(right.scheduledDate).getTime(),
        )
        .slice(0, Math.max(0, 5 - technicalServiceTasks.length))
        .map((schedule, index) => new MaintenanceTask({
            id: technicalServiceTasks.length + index + 1,
            label: maintenanceScheduleLabel(schedule.assetId, schedule.iotDeviceId),
            icon: schedule.iotDeviceId ? 'sensors' : 'inventory_2',
            status: maintenanceTaskStatus(schedule.status),
        }));

    const tasks = [...technicalServiceTasks, ...preventiveTasks];
    return tasks.length ? tasks.slice(0, 5) : buildOperationalMaintenanceFallbackTasks();
}

/**
 * Builds operational maintenance fallback tasks for presentation or reporting.
 *
 * @returns {*}
 */
function buildOperationalMaintenanceFallbackTasks() {
    const calibrationTasks = organizationIoTDevices.value
        .filter(iotDevice => iotDevice.calibrationStatus !== CalibrationStatus.Compliant)
        .slice(0, 3)
        .map((iotDevice, index) => new MaintenanceTask({
            id: index + 1,
            label: `${iotDevice.uuid} · ${iotDevice.model}`,
            icon: iotDevice.calibrationStatus === CalibrationStatus.Expired ? 'warning' : 'sensors',
            status: iotDevice.calibrationStatus === CalibrationStatus.Expired ? 'to-do' : 'doing',
        }));
    const gatewayTasks = organizationGateways.value
        .filter(gateway => gateway.status !== GatewayStatus.Active)
        .slice(0, Math.max(0, 5 - calibrationTasks.length))
        .map((gateway, index) => new MaintenanceTask({
            id: calibrationTasks.length + index + 1,
            label: `${gateway.uuid} · ${gateway.location}`,
            icon: gateway.status === GatewayStatus.Offline ? 'wifi_off' : 'router',
            status: gateway.status === GatewayStatus.Offline ? 'to-do' : 'doing',
        }));
    const assetTasks = organizationAssets.value
        .filter(asset => asset.status === AssetStatus.Maintenance)
        .slice(0, Math.max(0, 5 - calibrationTasks.length - gatewayTasks.length))
        .map((asset, index) => new MaintenanceTask({
            id: calibrationTasks.length + gatewayTasks.length + index + 1,
            label: `${asset.uuid} · ${asset.name}`,
            icon: 'inventory_2',
            status: 'doing',
        }));

    return [...calibrationTasks, ...gatewayTasks, ...assetTasks].slice(0, 5);
}

/**
 * Builds recent alerts for presentation or reporting.
 *
 * @returns {*}
 */
function buildRecentAlerts() {
    return [...activeIncidents.value]
        .sort((left, right) => new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime())
        .slice(0, 5)
        .map(incident => new RecentAlert({
            id: incident.id,
            assetName: incident.assetName,
            type: incidentTypeKey(incident),
            value: incident.value,
            date: formatDate(incident.detectedAt),
            status: incident.isRecognized ? 'Acknowledged' : 'Unacknowledged',
            severity: incident.severity,
            icon: incidentIcon(incident),
        }));
}

/**
 * Builds incident days for presentation or reporting.
 *
 * @returns {*}
 */
function buildIncidentDays() {
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const days = dayLabels.map((label, index) => ({id: index + 1, label, normal: 0, warning: 0, critical: 0, offline: 0}));
    applyIncidentRecords(days, incidentsSince(startOfCurrentWeek()), incident => {
        const day = new Date(incident.detectedAt).getDay();
        return day === 0 ? 6 : day - 1;
    });
    return days.map(day => new IncidentDay(day));
}

/**
 * Builds timeline for presentation or reporting.
 *
 * @returns {string}
 */
function buildTimeline() {
    const hours = Array.from({length: 24}, (_item, index) => ({
        id: index + 1,
        label: `${index.toString().padStart(2, '0')}h`,
        normal: 0,
        warning: 0,
        critical: 0,
        offline: 0,
    }));

    const since = new Date();
    since.setHours(since.getHours() - 24);
    applyIncidentRecords(hours, incidentsSince(since), incident => new Date(incident.detectedAt).getHours());
    return hours.map(hour => new IncidentDay(hour));
}

/**
 * Handles apply incident records behavior in the monitoring context.
 *
 * @param {*} buckets
 * @param {Array<*>} incidents
 * @param {number|string} indexFor
 * @returns {*}
 */
function applyIncidentRecords(buckets, incidents, indexFor) {
    incidents.forEach(incident => {
        const bucket = buckets[indexFor(incident)];
        if (!bucket) return;

        if (incident.isClosed) bucket.normal += 1;
        else if (incident.type === 'connectivity' || incident.conditionKey === 'low-signal') bucket.offline += 1;
        else if (incident.severity === 'critical') bucket.critical += 1;
        else bucket.warning += 1;
    });
}

/**
 * Handles incidents since behavior in the monitoring context.
 *
 * @param {*} since
 * @returns {*}
 */
function incidentsSince(since) {
    const sinceTime = since.getTime();
    return organizationIncidents.value.filter(incident => {
        const detectedAt = new Date(incident.detectedAt).getTime();
        return Number.isFinite(detectedAt) && detectedAt >= sinceTime;
    });
}

/**
 * Handles start of current week behavior in the monitoring context.
 *
 * @returns {*}
 */
function startOfCurrentWeek() {
    const date = new Date();
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + mondayOffset);
    date.setHours(0, 0, 0, 0);
    return date;
}

/**
 * Handles incident type key behavior in the monitoring context.
 *
 * @param {*} incident
 * @returns {string}
 */
function incidentTypeKey(incident) {
    switch (incident.conditionKey) {
        case 'high-temperature':
            return 'monitoring.operational.type-high-temp';
        case 'low-temperature':
            return 'monitoring.operational.type-low-temp';
        case 'high-humidity':
            return 'monitoring.operational.type-high-humidity';
        case 'low-battery':
            return 'monitoring.operational.type-low-battery';
        case 'low-signal':
            return 'monitoring.operational.type-low-signal';
        case 'thermal-configuration-pending':
            return 'monitoring.operational.type-configuration';
        default:
            break;
    }

    if (incident.type === 'connectivity') return 'monitoring.operational.type-connectivity';
    if (incident.type === 'humidity') return 'monitoring.operational.type-high-humidity';
    if (incident.type === 'temperature') return 'monitoring.operational.type-high-temp';
    return 'monitoring.operational.type-other';
}

/**
 * Handles incident icon behavior in the monitoring context.
 *
 * @param {*} incident
 * @returns {string}
 */
function incidentIcon(incident) {
    switch (incident.conditionKey) {
        case 'low-temperature':
            return 'ac_unit';
        case 'high-temperature':
            return 'device_thermostat';
        case 'high-humidity':
            return 'water_drop';
        case 'low-battery':
            return 'battery_alert';
        case 'low-signal':
            return 'signal_wifi_bad';
        default:
            break;
    }

    if (incident.type === 'connectivity') return 'wifi_off';
    if (incident.type === 'humidity') return 'water_drop';
    if (incident.type === 'temperature') return 'device_thermostat';
    return 'report_problem';
}

/**
 * Handles thermal compliance for behavior in the monitoring context.
 *
 * @param {Array<*>} readings
 * @returns {*}
 */
function thermalComplianceFor(readings) {
    if (!readings.length) return 0;
    const compliantReadings = readings.filter(reading => isThermalReadingInRange(reading)).length;
    return Math.round((compliantReadings / readings.length) * 100);
}

/**
 * Determines whether thermal reading in range is true.
 *
 * @param {*} reading
 * @returns {boolean}
 */
function isThermalReadingInRange(reading) {
    const settings = assetStore.settingsForAsset(activeOrganizationId.value, reading.assetId);
    if (!settings || reading.temperature === null) return false;
    return reading.temperature >= settings.minimumTemperature && reading.temperature <= settings.maximumTemperature;
}

/**
 * Builds summary bars for presentation or reporting.
 *
 * @param {string} values
 * @param {*} size
 * @returns {*}
 */
function buildSummaryBars(values, size) {
    const baseValues = values.filter(value => value > 0);
    if (!baseValues.length) return [];
    const max = Math.max(...baseValues, 1);
    return Array.from({length: size}, (_item, index) => {
        const source = baseValues[index % baseValues.length];
        const variation = index % 2 === 0 ? 1 : 0.72;
        return Math.max(18, Math.round((source / max) * 100 * variation));
    });
}

/**
 * Builds status bars for presentation or reporting.
 *
 * @param {string} values
 * @returns {string}
 */
function buildStatusBars(values) {
    const baseValues = values.length ? values : [0];
    const max = Math.max(...baseValues, 1);
    return Array.from({length: 11}, (_item, index) => {
        const source = baseValues[index % baseValues.length];
        return Math.max(16, Math.round((source / max) * 100));
    });
}

/**
 * Handles hour label behavior in the monitoring context.
 *
 * @param {string} date
 * @returns {string}
 */
function hourLabel(date) {
    return `${new Date(date).getHours().toString().padStart(2, '0')}:00`;
}

/**
 * Handles current temperature limits behavior in the monitoring context.
 *
 * @returns {*}
 */
function currentTemperatureLimits() {
    const settings = currentSettings.value;
    if (settings) return {min: settings.minimumTemperature, max: settings.maximumTemperature};

    return temperatureLimitsFromValues([
        ...organizationReadings.value.map(reading => reading.temperature),
        ...organizationAssets.value.map(asset => temperatureFromAsset(asset.currentTemperature)),
    ]);
}

/**
 * Handles maximum temperature for asset behavior in the monitoring context.
 *
 * @param {*} asset
 * @returns {number}
 */
function maximumTemperatureForAsset(asset) {
    return assetStore.settingsForAsset(activeOrganizationId.value, asset.id)?.maximumTemperature ??
        currentSettings.value?.maximumTemperature ??
        null;
}

/**
 * Handles temperature limits from values behavior in the monitoring context.
 *
 * @param {string} values
 * @returns {*}
 */
function temperatureLimitsFromValues(values) {
    const temperatures = values.filter(temperature => temperature !== null && Number.isFinite(temperature));
    if (!temperatures.length) return {min: 0, max: 1};

    const min = Math.min(...temperatures);
    const max = Math.max(...temperatures);
    if (min === max) return {min: Math.floor(min - 1), max: Math.ceil(max + 1)};
    return {min: Math.floor(min), max: Math.ceil(max)};
}

/**
 * Handles average behavior in the monitoring context.
 *
 * @param {string} values
 * @returns {number}
 */
function average(values) {
    return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

/**
 * Handles temperature from asset behavior in the monitoring context.
 *
 * @param {*} currentTemperature
 * @returns {*}
 */
function temperatureFromAsset(currentTemperature) {
    const temperature = Number(String(currentTemperature).replace('°C', '').trim());
    return Number.isFinite(temperature) ? temperature : null;
}

/**
 * Handles maintenance schedule label behavior in the monitoring context.
 *
 * @param {number|string} assetId
 * @param {number|string} iotDeviceId
 * @returns {string}
 */
function maintenanceScheduleLabel(assetId, iotDeviceId) {
    const iotDevice = iotDeviceId
        ? organizationIoTDevices.value.find(device => device.id === iotDeviceId)
        : null;
    if (iotDevice) return `${iotDevice.uuid} · ${iotDevice.model}`;

    const asset = organizationAssets.value.find(currentAsset => currentAsset.id === assetId);
    return asset ? `${asset.uuid} · ${asset.name}` : `Asset #${assetId}`;
}

/**
 * Handles asset name for behavior in the monitoring context.
 *
 * @param {number|string} assetId
 * @returns {string}
 */
function assetNameFor(assetId) {
    return organizationAssets.value.find(asset => asset.id === assetId)?.name ?? `Asset #${assetId}`;
}

/**
 * Handles maintenance task status behavior in the monitoring context.
 *
 * @param {string} status
 * @returns {string}
 */
function maintenanceTaskStatus(status) {
    if (status === MaintenanceScheduleStatus.Completed) return 'done';
    return status === MaintenanceScheduleStatus.Pending ? 'doing' : 'to-do';
}

/**
 * Handles maintenance status weight behavior in the monitoring context.
 *
 * @param {string} status
 * @returns {number}
 */
function maintenanceStatusWeight(status) {
    if (status === MaintenanceScheduleStatus.Pending) return 0;
    if (status === MaintenanceScheduleStatus.Scheduled) return 1;
    return 2;
}

/**
 * Handles priority for request behavior in the monitoring context.
 *
 * @param {*} priority
 * @returns {*}
 */
function priorityForRequest(priority) {
    const weights = {critical: 4, high: 3, medium: 2, low: 1};
    return weights[priority] ?? 0;
}

/**
 * Handles icon for technical service behavior in the monitoring context.
 *
 * @param {*} priority
 * @returns {string}
 */
function iconForTechnicalService(priority) {
    return priority === 'critical' || priority === 'high' ? 'build_circle' : 'construction';
}

/**
 * Formats date for display.
 *
 * @param {string} date
 * @returns {string}
 */
function formatDate(date) {
    const formatterLocale = locale.value === 'es' ? 'es-PE' : 'en-GB';
    return new Intl.DateTimeFormat(formatterLocale, {day: '2-digit', month: 'short', year: 'numeric'}).format(new Date(date));
}

/**
 * Handles kpi behavior in the monitoring context.
 *
 * @param {Object} config
 * @returns {*}
 */
function kpi(config) {
    return new DashboardKpi(config);
}
</script>

<template>
  <div class="dashboard-content">
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>

    <header class="dashboard-hero">
      <div class="dashboard-title-block">
        <h1>{{ t('monitoring.operational.title') }}</h1>
        <p>{{ t('monitoring.operational.subtitle') }}</p>
      </div>
    </header>

    <div v-if="hasOperationalData" class="dashboard-board">
      <dashboard-ai-assistant
        :organization-id="activeOrganizationId"
        :thermal-compliance="Number(thermalComplianceKpi.value.replace('%', ''))"
        :active-incidents="activeIncidents.length"
        :critical-incidents="activeCriticalIncidents.length"
        :monitored-assets="assetSummary.monitoredAssets"
        :active-sensors="organizationIoTDevices.length"
        :readings-count="organizationReadings.length"
        :maintenance-completion="maintenanceCompletionRate"
        :asset-issue-count="assetSummary.assetsWithIssues"
      />

      <section class="primary-column">
        <div class="temp-chart-container dashboard-card-slot">
          <temperature-chart
            title="monitoring.operational.chart-temp-title"
            subtitle="monitoring.operational.chart-temp-subtitle"
            :points="temperaturePoints"
          />
        </div>

        <div class="lower-grid">
          <div class="storage-box dashboard-card-slot">
            <storage-distribution :items="storageDistribution"/>
          </div>

          <div class="maintenance-box dashboard-card-slot">
            <maintenance-list :tasks="maintenanceTasks" :completion-rate="maintenanceCompletionRate"/>
          </div>
        </div>

        <div class="alerts-row dashboard-card-slot">
          <recent-alerts :alerts="recentAlerts"/>
        </div>
      </section>

      <aside class="secondary-column">
        <div class="right-kpis">
          <div class="feature-kpis">
            <stat-card v-bind="monitoredAssetsKpi"/>
            <stat-card v-bind="criticalAlertsKpi"/>
          </div>

          <div class="compact-kpis">
            <stat-card v-bind="activeSensorsKpi"/>
            <stat-card v-bind="incidentsKpi"/>
            <stat-card v-bind="thermalComplianceKpi"/>
          </div>
        </div>

        <div class="incidents-box dashboard-card-slot">
          <incidents-chart :days="incidentDays" :timeline="timeline"/>
        </div>
      </aside>
    </div>
    <div v-else-if="!loading" class="empty-state">
      <span class="material-icons">dashboard</span>
      <h2>{{ t('monitoring.operational.empty-title') }}</h2>
      <p>{{ t('monitoring.operational.empty-description') }}</p>
    </div>
  </div>
</template>

<style scoped>
.dashboard-content {
  background: #f5f6f8;
  box-sizing: border-box;
  container-type: inline-size;
  min-height: 100%;
  padding: 8px 18px 40px;
}

.dashboard-hero {
  margin-bottom: 18px;
}

.dashboard-title-block h1 {
  color: #263348;
  font-size: 22px;
  font-weight: 800;
  margin: 0;
}

.dashboard-title-block p {
  color: #98a2b3;
  font-size: 12px;
  font-weight: 800;
  margin: 6px 0 0;
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
  border: 4px solid #dbe3ef;
  border-radius: 50%;
  border-top-color: #2563eb;
  height: 40px;
  width: 40px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.dashboard-board {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.58fr);
  margin: 0;
  max-width: 1352px;
  width: 100%;
}

.primary-column,
.secondary-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.dashboard-card-slot {
  min-width: 0;
}

.temp-chart-container {
  height: 390px;
}

.right-kpis {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.feature-kpis,
.compact-kpis {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feature-kpis :deep(.stat-card) {
  height: 244px;
}

.compact-kpis :deep(.stat-card) {
  height: 156px;
}

.lower-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1.62fr) minmax(260px, 0.95fr);
}

.storage-box,
.maintenance-box {
  height: 292px;
}

.alerts-row {
  height: 336px;
}

.incidents-box {
  height: 534px;
}

.empty-state {
  align-items: center;
  background: #ffffff;
  border: 1px solid rgba(17, 24, 39, 0.06);
  border-radius: 8px;
  box-shadow: 0 3px 8px rgba(15, 23, 42, 0.08);
  color: #6b7280;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 320px;
  padding: 32px;
  text-align: center;
}

.empty-state .material-icons {
  color: #c5ceda;
  font-size: 42px;
  height: 42px;
  margin-bottom: 10px;
  width: 42px;
}

.empty-state h2 {
  color: #263348;
  font-size: 18px;
  font-weight: 800;
  margin: 0 0 8px;
}

.empty-state p {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  max-width: 420px;
}

:deep(.premium-card) {
  background: #ffffff;
  border: 1px solid rgba(17, 24, 39, 0.055);
  border-radius: 8px;
  box-shadow:
    0 3px 8px rgba(15, 23, 42, 0.09),
    0 18px 34px rgba(15, 23, 42, 0.055);
  overflow: hidden;
}

:deep(.stat-card) {
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

:deep(.stat-card:hover) {
  box-shadow: 0 15px 35px rgba(15, 23, 42, 0.08);
  transform: translateY(-3px);
}

@media (max-width: 1180px) {
  .dashboard-board {
    grid-template-columns: 1fr;
    margin-inline: auto;
    max-width: 760px;
  }

  .right-kpis,
  .lower-grid {
    grid-template-columns: 1fr;
  }

  .incidents-box {
    height: 430px;
  }
}

@container (max-width: 1210px) {
  .dashboard-board {
    grid-template-columns: 1fr;
    margin-inline: auto;
    max-width: 760px;
  }

  .right-kpis,
  .lower-grid {
    grid-template-columns: 1fr;
  }

  .incidents-box {
    height: 430px;
  }
}

@container (max-width: 680px) {
  .dashboard-content {
    padding: 8px 12px 32px;
  }

  .temp-chart-container,
  .storage-box,
  .maintenance-box,
  .alerts-row,
  .incidents-box {
    height: auto;
    min-height: 260px;
  }

  .feature-kpis :deep(.stat-card),
  .compact-kpis :deep(.stat-card) {
    height: 190px;
  }
}

@media (max-width: 760px) {
  .dashboard-content {
    padding: 18px;
  }

  .temp-chart-container,
  .storage-box,
  .maintenance-box,
  .alerts-row,
  .incidents-box {
    height: auto;
    min-height: 260px;
  }
}
</style>
