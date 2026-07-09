import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import {CalibrationStatus} from '@/asset-management/domain/model/calibration-status.js';
import {IoTDeviceStatus} from '@/asset-management/domain/model/iot-device-status.js';
import {OfflineReading} from '@/monitoring/domain/model/offline-reading-entity.js';
import {SyncStatus} from '@/monitoring/domain/model/sync-status.js';
import {Incident} from '@/monitoring/domain/model/incident-entity.js';
import {MonitoringApi} from '@/monitoring/infrastructure/monitoring-api.js';
import {SensorReadingAssembler} from '@/monitoring/infrastructure/sensor-reading.assembler.js';
import {IncidentAssembler} from '@/monitoring/infrastructure/incident.assembler.js';
import {MaintenanceScheduleAssembler} from '@/monitoring/infrastructure/maintenance-schedule.assembler.js';
import {TechnicalServiceRequestAssembler} from '@/monitoring/infrastructure/technical-service-request.assembler.js';

const monitoringApi = new MonitoringApi();
const escalationPolicies = [
    {severity: 'critical', waitingMinutes: 30, level: 2, targetKey: 'operations-manager'},
    {severity: 'warning', waitingMinutes: 720, level: 1, targetKey: 'shift-supervisor'},
];

/**
 * Pinia store that coordinates monitoring application state and use cases.
 *
 * @returns {import('pinia').StoreDefinition}
 */
const useMonitoringStore = defineStore('monitoring', () => {
    const readings = ref([]);
    const offlineReadings = ref([]);
    const incidents = ref([]);
    const maintenanceSchedules = ref([]);
    const technicalServiceRequests = ref([]);
    const errors = ref([]);
    const loading = ref(false);
    const readingsLoaded = ref(false);
    const incidentsLoaded = ref(false);
    const maintenanceSchedulesLoaded = ref(false);
    const technicalServiceRequestsLoaded = ref(false);
    const totalAssets = computed(() => new Set(readings.value.map(reading => reading.assetId)).size);
    const assetsWithAlerts = computed(() => new Set(readings.value.filter(reading => reading.isOutOfRange).map(reading => reading.assetId)).size);
    const outOfRangeReadings = computed(() => readings.value.filter(reading => reading.isOutOfRange));
    const pendingCount = computed(() => offlineReadings.value.filter(reading => reading.isPending).length);
    const syncedCount = computed(() => offlineReadings.value.filter(reading => reading.isSynced).length);
    const failedCount = computed(() => offlineReadings.value.filter(reading => reading.isFailed).length);
    const seededOrganizationIds = new Set();

    /**
     * Loads readings from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchReadings(organizationId) {
        if (!organizationId) {
            readings.value = [];
            readingsLoaded.value = false;
            initOfflineReadings(readings.value);
            return readings.value;
        }

        const response = await monitoringApi.getSensorReadingsForOrganization(organizationId);
        readings.value = SensorReadingAssembler.toEntitiesFromResponse(response);
        readingsLoaded.value = true;
        initOfflineReadings(readings.value);
        return readings.value;
    }

    /**
     * Loads incidents from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchIncidents(organizationId) {
        if (!organizationId) {
            incidents.value = [];
            incidentsLoaded.value = false;
            return incidents.value;
        }

        const response = await monitoringApi.getIncidentsForOrganization(organizationId);
        incidents.value = IncidentAssembler.toEntitiesFromResponse(response);
        incidentsLoaded.value = true;
        return incidents.value;
    }

    /**
     * Creates incident in the monitoring context.
     *
     * @param {*} incident
     * @returns {Promise<*>}
     */
    async function createIncident(incident) {
        const response = await monitoringApi.createIncident(incident.organizationId, IncidentAssembler.toResourceFromEntity(incident));
        const createdIncident = IncidentAssembler.toEntityFromResource(response.data);
        incidents.value.push(createdIncident);
        return createdIncident;
    }

    /**
     * Updates incident in the monitoring context.
     *
     * @param {*} incident
     * @returns {Promise<*>}
     */
    async function updateIncident(incident) {
        const response = await monitoringApi.updateIncident(incident.organizationId, incident.id, IncidentAssembler.toResourceFromEntity(incident));
        const updatedIncident = IncidentAssembler.toEntityFromResource(response.data);
        incidents.value = incidents.value.map(currentIncident => currentIncident.id === updatedIncident.id ? updatedIncident : currentIncident);
        return updatedIncident;
    }

    /**
     * Loads maintenance schedules from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchMaintenanceSchedules(organizationId) {
        if (!organizationId) {
            maintenanceSchedules.value = [];
            maintenanceSchedulesLoaded.value = false;
            return maintenanceSchedules.value;
        }

        const response = await monitoringApi.getMaintenanceSchedulesForOrganization(organizationId);
        maintenanceSchedules.value = MaintenanceScheduleAssembler.toEntitiesFromResponse(response);
        maintenanceSchedulesLoaded.value = true;
        return maintenanceSchedules.value;
    }

    /**
     * Loads technical service requests from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchTechnicalServiceRequests(organizationId) {
        if (!organizationId) {
            technicalServiceRequests.value = [];
            technicalServiceRequestsLoaded.value = false;
            return technicalServiceRequests.value;
        }

        const response = await monitoringApi.getTechnicalServiceRequestsForOrganization(organizationId);
        technicalServiceRequests.value = TechnicalServiceRequestAssembler.toEntitiesFromResponse(response);
        technicalServiceRequestsLoaded.value = true;
        return technicalServiceRequests.value;
    }

    /**
     * Loads monitoring data from the API and updates application state.
     *
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async function fetchMonitoringData({organizationId, includeDependencies = true} = {}) {
        loading.value = true;
        errors.value = [];

        try {
            if (!organizationId) {
                readings.value = [];
                incidents.value = [];
                maintenanceSchedules.value = [];
                technicalServiceRequests.value = [];
                return {
                    readings: readings.value,
                    incidents: incidents.value,
                    maintenanceSchedules: maintenanceSchedules.value,
                    technicalServiceRequests: technicalServiceRequests.value,
                };
            }

            const requests = [fetchReadings(organizationId)];
            if (includeDependencies) {
                requests.push(
                    fetchIncidents(organizationId),
                    fetchMaintenanceSchedules(organizationId),
                    fetchTechnicalServiceRequests(organizationId),
                );
            }
            await Promise.all(requests);
            return {
                readings: readings.value,
                incidents: incidents.value,
                maintenanceSchedules: maintenanceSchedules.value,
                technicalServiceRequests: technicalServiceRequests.value,
            };
        } catch (error) {
            errors.value.push(error);
            throw error;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Creates sensor reading in the monitoring context.
     *
     * @param {*} sensorReading
     * @returns {Promise<*>}
     */
    async function createSensorReading(sensorReading, organizationId = null) {
        const response = await monitoringApi.createSensorReading(organizationId, SensorReadingAssembler.toResourceFromEntity(sensorReading));
        const createdReading = SensorReadingAssembler.toEntityFromResource(response.data);
        readings.value.push(createdReading);
        return createdReading;
    }

    /**
     * Handles get latest temperature by asset behavior in the monitoring context.
     *
     * @param {number|string} assetId
     * @returns {*}
     */
    function getLatestTemperatureByAsset(assetId) {
        const sorted = readings.value
            .filter(reading => reading.assetId === Number(assetId) && reading.temperature !== null)
            .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());
        return sorted.length > 0 ? sorted[0].temperature : null;
    }

    /**
     * Handles get latest humidity by asset behavior in the monitoring context.
     *
     * @param {number|string} assetId
     * @returns {*}
     */
    function getLatestHumidityByAsset(assetId) {
        const sorted = readings.value
            .filter(reading => reading.assetId === Number(assetId) && reading.humidity !== null)
            .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());
        return sorted.length > 0 ? sorted[0].humidity : null;
    }

    /**
     * Handles get readings by asset behavior in the monitoring context.
     *
     * @param {number|string} assetId
     * @param {*} from
     * @param {*} to
     * @returns {*}
     */
    function getReadingsByAsset(assetId, from = null, to = null) {
        return readings.value
            .filter(reading => {
                if (reading.assetId !== Number(assetId)) return false;
                const time = new Date(reading.recordedAt).getTime();
                if (from && time < new Date(from).getTime()) return false;
                if (to && time > new Date(to).getTime() + 86399999) return false;
                return true;
            })
            .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());
    }

    /**
     * Handles readings for asset ids behavior in the monitoring context.
     *
     * @param {*} assetIds
     * @returns {*}
     */
    function readingsForAssetIds(assetIds) {
        const assetIdSet = new Set(assetIds.map(id => Number(id)));

        return readings.value
            .filter(reading => assetIdSet.has(reading.assetId))
            .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());
    }

    /**
     * Handles recent readings for asset ids behavior in the monitoring context.
     *
     * @param {*} assetIds
     * @param {*} limit
     * @returns {*}
     */
    function recentReadingsForAssetIds(assetIds, limit = 6) {
        return readingsForAssetIds(assetIds).slice(0, limit);
    }

    /**
     * Handles readings for asset ids since behavior in the monitoring context.
     *
     * @param {*} assetIds
     * @param {*} since
     * @returns {*}
     */
    function readingsForAssetIdsSince(assetIds, since) {
        const sinceTime = since.getTime();
        const nowTime = Date.now();

        return readingsForAssetIds(assetIds).filter(reading => {
            const readingTime = new Date(reading.recordedAt).getTime();
            return readingTime >= sinceTime && readingTime <= nowTime;
        });
    }

    /**
     * Handles out of range count for asset ids behavior in the monitoring context.
     *
     * @param {*} assetIds
     * @returns {number}
     */
    function outOfRangeCountForAssetIds(assetIds) {
        return readingsForAssetIds(assetIds).filter(reading => reading.isOutOfRange).length;
    }

    /**
     * Handles thermal compliance for asset ids behavior in the monitoring context.
     *
     * @param {*} assetIds
     * @returns {*}
     */
    function thermalComplianceForAssetIds(assetIds) {
        const assetReadings = readingsForAssetIds(assetIds);

        if (!assetReadings.length) return 0;

        const inRangeReadings = assetReadings.filter(reading => !reading.isOutOfRange).length;
        return Math.round((inRangeReadings / assetReadings.length) * 100);
    }

    /**
     * Handles sync reading behavior in the monitoring context.
     *
     * @param {number|string} id
     * @returns {*}
     */
    function syncReading(id) {
        offlineReadings.value = offlineReadings.value.map(reading =>
            reading.id === Number(id) ? reading.withSyncStatus(SyncStatus.Synced) : reading,
        );
    }

    /**
     * Handles sync all pending behavior in the monitoring context.
     *
     * @returns {*}
     */
    function syncAllPending() {
        offlineReadings.value = offlineReadings.value.map(reading =>
            reading.isPending ? reading.withSyncStatus(SyncStatus.Synced) : reading,
        );
    }

    /**
     * Handles schedules for organization behavior in the monitoring context.
     *
     * @param {number|string} organizationId
     * @returns {*}
     */
    function schedulesForOrganization(organizationId) {
        if (!organizationId) return [];
        return maintenanceSchedules.value.filter(schedule => schedule.organizationId === Number(organizationId));
    }

    /**
     * Handles technical services for organization behavior in the monitoring context.
     *
     * @param {number|string} organizationId
     * @returns {*}
     */
    function technicalServicesForOrganization(organizationId) {
        if (!organizationId) return [];
        return technicalServiceRequests.value.filter(request => request.organizationId === Number(organizationId));
    }

    /**
     * Handles incidents for organization behavior in the monitoring context.
     *
     * @param {number|string} organizationId
     * @returns {*}
     */
    function incidentsForOrganization(organizationId) {
        if (!organizationId) return [];
        return incidents.value.filter(incident => incident.organizationId === Number(organizationId));
    }

    /**
     * Handles sync generated incidents for organization behavior in the monitoring context.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    async function syncGeneratedIncidentsForOrganization(organizationId) {
        if (!organizationId) return [];

        const assetManagementStore = useAssetManagementStore();
        const assets = assetManagementStore.assetsForOrganization(organizationId);
        const settings = assetManagementStore.assetSettingsForOrganization(organizationId);
        const generatedIncidents = generatedParameterIncidentsFrom(incidents.value, readings.value, assets, settings);
        const createdIncidents = [];

        for (const generatedIncident of generatedIncidents) {
            const createdIncident = await createIncident(generatedIncident).catch(() => null);
            if (createdIncident) createdIncidents.push(createdIncident);
        }

        const escalatedUpdates = escalationUpdatesFrom(incidents.value);
        for (const updatedIncident of escalatedUpdates) {
            await updateIncident(updatedIncident).catch(() => undefined);
        }

        return createdIncidents;
    }

    /**
     * Updates organization telemetry in the monitoring context.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    async function updateOrganizationTelemetry(organizationId) {
        if (!organizationId) return [];

        const assetManagementStore = useAssetManagementStore();
        const assets = assetManagementStore.assetsForOrganization(organizationId);
        const monitoredAssets = assets.filter(asset =>
            assetManagementStore
                .iotDevicesForAsset(asset.id)
                .some(iotDevice => iotDevice.status !== IoTDeviceStatus.Offline),
        );
        if (!monitoredAssets.length) return [];

        const count = demoReadingCountForOrganization(
            organizationId,
            monitoredAssets.map(asset => asset.id),
        );
        const response = await monitoringApi.generateDemoSensorReadings(organizationId, {count});
        const generatedReadings = SensorReadingAssembler.toEntitiesFromResponse(response);
        mergeReadings(generatedReadings);
        return generatedReadings;
    }

    /**
     * Determines how many backend-owned readings are needed for the next demo refresh.
     *
     * @param {number|string} organizationId
     * @param {number[]} assetIds
     * @returns {number}
     */
    function demoReadingCountForOrganization(organizationId, assetIds) {
        if (seededOrganizationIds.has(organizationId)) return 1;

        seededOrganizationIds.add(organizationId);
        const since = new Date();
        since.setHours(since.getHours() - 24);
        return readingsForAssetIdsSince(assetIds, since).length ? 1 : 8;
    }

    /**
     * Merges backend-generated readings into local application state.
     *
     * @param {Array<*>} generatedReadings
     * @returns {void}
     */
    function mergeReadings(generatedReadings) {
        if (!generatedReadings.length) return;

        const readingsById = new Map(readings.value.map(reading => [reading.id, reading]));
        generatedReadings.forEach(reading => readingsById.set(reading.id, reading));
        readings.value = [...readingsById.values()].sort(
            (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
        );
        readingsLoaded.value = true;
        initOfflineReadings(readings.value);
    }

    /**
     * Handles init offline readings behavior in the monitoring context.
     *
     * @param {Array<*>} availableReadings
     * @returns {*}
     */
    function initOfflineReadings(availableReadings) {
        if (offlineReadings.value.length > 0) return;
        const sorted = [...availableReadings].sort(
            (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
        );
        offlineReadings.value = sorted
            .filter(reading => reading.temperature !== null && reading.humidity !== null)
            .slice(0, 6)
            .map((reading, index) => new OfflineReading({
                id: reading.id,
                assetId: reading.assetId,
                iotDeviceId: reading.iotDeviceId,
                temperature: reading.temperature ?? 0,
                humidity: reading.humidity ?? 0,
                recordedAt: reading.recordedAt,
                syncStatus: index < 3 ? SyncStatus.Pending : index === 3 ? SyncStatus.Failed : SyncStatus.Synced,
            }));
    }

    /**
     * Generates d parameter incidents from for the current workflow.
     *
     * @param {Array<*>} currentIncidents
     * @param {Array<*>} currentReadings
     * @param {Array<*>} assets
     * @param {*} settings
     * @returns {number}
     */
    function generatedParameterIncidentsFrom(currentIncidents, currentReadings, assets, settings) {
        const candidates = [
            ...latestParameterCandidates(currentReadings, assets, settings),
            ...pendingReviewCandidates(currentReadings, assets, settings),
        ];
        let nextId = Math.max(...currentIncidents.map(incident => incident.id), 0) + 1;
        const now = new Date();
        const generatedIncidents = [];

        candidates.forEach(candidate => {
            if (hasActiveEquivalentIncident(
                [...currentIncidents, ...generatedIncidents],
                candidate.asset.organizationId,
                candidate.asset.id,
                candidate.type,
            )) {
                return;
            }

            const incident = new Incident({
                id: nextId,
                organizationId: candidate.asset.organizationId,
                assetId: candidate.asset.id,
                assetName: candidate.asset.name,
                type: candidate.type,
                severity: candidate.severity,
                value: candidate.value,
                detectedAt: candidate.reading.recordedAt,
                status: 'open',
                recognizedBy: null,
                recognizedAt: null,
                conditionStable: false,
                correctiveAction: null,
                closureEvidence: null,
                closedBy: null,
                closedAt: null,
                conditionKey: candidate.conditionKey,
                source: 'sensor-reading',
                sourceReadingId: candidate.reading.id,
                reviewStatus: candidate.reviewStatus,
                escalationStatus: 'none',
                escalationLevel: 0,
                escalationPolicyMinutes: null,
                escalatedAt: null,
                escalatedTo: null,
                escalationReviewedBy: null,
                escalationReviewedAt: null,
            });

            nextId += 1;
            generatedIncidents.push(incidentWithCurrentEscalation(incident, now) ?? incident);
        });

        return generatedIncidents;
    }

    /**
     * Handles latest parameter candidates behavior in the monitoring context.
     *
     * @param {Array<*>} currentReadings
     * @param {Array<*>} assets
     * @param {*} settings
     * @returns {string}
     */
    function latestParameterCandidates(currentReadings, assets, settings) {
        const latestByAsset = new Map();

        currentReadings
            .filter(reading => reading.isOutOfRange)
            .forEach(reading => {
                const asset = assets.find(currentAsset => currentAsset.id === reading.assetId);
                if (!asset) return;

                const previous = latestByAsset.get(asset.id);
                if (!previous || isNewerReading(reading, previous.reading)) {
                    latestByAsset.set(asset.id, {reading, asset});
                }
            });

        return [...latestByAsset.values()]
            .flatMap(({reading, asset}) => {
                const assetSettings = settingsForAsset(asset, settings);
                return conditionCandidatesForReading(reading, asset, assetSettings);
            })
            .sort((left, right) => String(right.reading.recordedAt).localeCompare(String(left.reading.recordedAt)));
    }

    /**
     * Handles condition candidates for reading behavior in the monitoring context.
     *
     * @param {*} reading
     * @param {*} asset
     * @param {Array<*>} assetSettings
     * @returns {string}
     */
    function conditionCandidatesForReading(reading, asset, assetSettings) {
        const candidates = [];

        if (assetSettings && reading.temperature !== null) {
            const conditionKey = temperatureConditionKey(reading.temperature, assetSettings);

            if (conditionKey) {
                candidates.push({
                    reading,
                    asset,
                    type: 'temperature',
                    conditionKey,
                    severity: thermalSeverity(reading.temperature, assetSettings),
                    value: `${reading.temperature}${assetSettings.temperatureUnit}`,
                    reviewStatus: 'complete',
                });
            }
        }

        if (assetSettings && reading.humidity !== null && reading.humidity > assetSettings.maximumHumidity) {
            candidates.push({
                reading,
                asset,
                type: 'humidity',
                conditionKey: 'high-humidity',
                severity: humiditySeverity(reading.humidity, assetSettings),
                value: `${reading.humidity}${assetSettings.humidityUnit}`,
                reviewStatus: 'complete',
            });
        }

        if (reading.batteryLevel !== null && reading.batteryLevel < 15) {
            candidates.push({
                reading,
                asset,
                type: 'other',
                conditionKey: 'low-battery',
                severity: reading.batteryLevel < 10 ? 'critical' : 'warning',
                value: `${reading.batteryLevel}% battery`,
                reviewStatus: 'complete',
            });
        }

        if (reading.signalStrength !== null && reading.signalStrength < 35) {
            candidates.push({
                reading,
                asset,
                type: 'connectivity',
                conditionKey: 'low-signal',
                severity: reading.signalStrength < 30 ? 'critical' : 'warning',
                value: `${reading.signalStrength}% signal`,
                reviewStatus: 'complete',
            });
        }

        return candidates;
    }

    /**
     * Handles pending review candidates behavior in the monitoring context.
     *
     * @param {Array<*>} currentReadings
     * @param {Array<*>} assets
     * @param {*} settings
     * @returns {string}
     */
    function pendingReviewCandidates(currentReadings, assets, settings) {
        const latestByAsset = new Map();

        currentReadings
            .filter(reading => reading.isOutOfRange && (reading.temperature !== null || reading.humidity !== null))
            .forEach(reading => {
                const asset = assets.find(currentAsset => currentAsset.id === reading.assetId);

                if (!asset || settingsForAsset(asset, settings)) return;

                const previous = latestByAsset.get(asset.id);
                if (!previous || isNewerReading(reading, previous.reading)) {
                    latestByAsset.set(asset.id, {reading, asset});
                }
            });

        return [...latestByAsset.values()].map(({reading, asset}) => ({
            reading,
            asset,
            type: 'other',
            conditionKey: 'thermal-configuration-pending',
            severity: 'warning',
            value: 'Pending safety range',
            reviewStatus: 'pending-review',
        }));
    }

    /**
     * Handles escalation updates from behavior in the monitoring context.
     *
     * @param {Array<*>} currentIncidents
     * @returns {string}
     */
    function escalationUpdatesFrom(currentIncidents) {
        const now = new Date();
        const updates = [];

        currentIncidents.forEach(incident => {
            const updated = incidentWithCurrentEscalation(incident, now);
            if (updated && hasEscalationChanges(incident, updated)) updates.push(updated);
        });

        return updates;
    }

    /**
     * Handles incident with current escalation behavior in the monitoring context.
     *
     * @param {*} incident
     * @param {*} now
     * @returns {*}
     */
    function incidentWithCurrentEscalation(incident, now) {
        if (incident.isClosed || incident.isEscalated || incident.escalationStatus === 'reviewed') return null;

        if (!incident.isOpen) {
            return incident.escalationStatus === 'pending-configuration'
                ? incidentWith(incident, {
                    escalationStatus: 'none',
                    escalationLevel: 0,
                    escalationPolicyMinutes: escalationPolicyFor(incident)?.waitingMinutes ?? null,
                    escalatedAt: null,
                    escalatedTo: null,
                })
                : null;
        }

        const policy = escalationPolicyFor(incident);

        if (!policy) {
            return incidentWith(incident, {
                escalationStatus: 'pending-configuration',
                escalationLevel: 0,
                escalationPolicyMinutes: null,
                escalatedAt: null,
                escalatedTo: null,
            });
        }

        if (!hasExceededEscalationThreshold(incident, policy, now)) {
            return incidentWith(incident, {
                escalationStatus: 'none',
                escalationLevel: 0,
                escalationPolicyMinutes: policy.waitingMinutes,
                escalatedAt: null,
                escalatedTo: null,
            });
        }

        return incidentWith(incident, {
            escalationStatus: 'escalated',
            escalationLevel: policy.level,
            escalationPolicyMinutes: policy.waitingMinutes,
            escalatedAt: incident.escalatedAt ?? now.toISOString(),
            escalatedTo: policy.targetKey,
        });
    }

    /**
     * Handles incident with behavior in the monitoring context.
     *
     * @param {*} incident
     * @param {*} changes
     * @returns {*}
     */
    function incidentWith(incident, changes) {
        return new Incident({
            id: incident.id,
            organizationId: incident.organizationId,
            assetId: incident.assetId,
            assetName: incident.assetName,
            type: incident.type,
            severity: incident.severity,
            value: incident.value,
            detectedAt: incident.detectedAt,
            status: incident.status,
            recognizedBy: incident.recognizedBy,
            recognizedAt: incident.recognizedAt,
            conditionStable: incident.conditionStable,
            correctiveAction: incident.correctiveAction,
            closureEvidence: incident.closureEvidence,
            closedBy: incident.closedBy,
            closedAt: incident.closedAt,
            conditionKey: incident.conditionKey,
            source: incident.source,
            sourceReadingId: incident.sourceReadingId,
            reviewStatus: incident.reviewStatus,
            escalationStatus: incident.escalationStatus,
            escalationLevel: incident.escalationLevel,
            escalationPolicyMinutes: incident.escalationPolicyMinutes,
            escalatedAt: incident.escalatedAt,
            escalatedTo: incident.escalatedTo,
            escalationReviewedBy: incident.escalationReviewedBy,
            escalationReviewedAt: incident.escalationReviewedAt,
            ...changes,
        });
    }

    /**
     * Handles escalation policy for behavior in the monitoring context.
     *
     * @param {*} incident
     * @returns {*}
     */
    function escalationPolicyFor(incident) {
        return escalationPolicies.find(policy => policy.severity === incident.severity);
    }

    /**
     * Determines whether exceeded escalation threshold exists.
     *
     * @param {*} incident
     * @param {*} policy
     * @param {*} now
     * @returns {boolean}
     */
    function hasExceededEscalationThreshold(incident, policy, now) {
        const detectedAt = new Date(incident.detectedAt);
        if (Number.isNaN(detectedAt.getTime())) return false;

        const elapsedMinutes = (now.getTime() - detectedAt.getTime()) / 60000;
        return elapsedMinutes >= policy.waitingMinutes;
    }

    /**
     * Determines whether escalation changes exists.
     *
     * @param {*} current
     * @param {string} updated
     * @returns {boolean}
     */
    function hasEscalationChanges(current, updated) {
        return current.escalationStatus !== updated.escalationStatus ||
            current.escalationLevel !== updated.escalationLevel ||
            current.escalationPolicyMinutes !== updated.escalationPolicyMinutes ||
            current.escalatedAt !== updated.escalatedAt ||
            current.escalatedTo !== updated.escalatedTo ||
            current.escalationReviewedBy !== updated.escalationReviewedBy ||
            current.escalationReviewedAt !== updated.escalationReviewedAt;
    }

    /**
     * Determines whether active equivalent incident exists.
     *
     * @param {Array<*>} currentIncidents
     * @param {number|string} organizationId
     * @param {number|string} assetId
     * @param {string} type
     * @returns {boolean}
     */
    function hasActiveEquivalentIncident(currentIncidents, organizationId, assetId, type) {
        return currentIncidents.some(incident => {
            if (incident.isClosed || incident.organizationId !== organizationId || incident.assetId !== assetId) return false;
            return incident.type === type;
        });
    }

    /**
     * Handles settings for asset behavior in the monitoring context.
     *
     * @param {*} asset
     * @param {*} settings
     * @returns {void}
     */
    function settingsForAsset(asset, settings) {
        return settings.find(setting => setting.assetId === asset.id) ??
            settings.find(setting => setting.organizationId === asset.organizationId && setting.assetId === null);
    }

    /**
     * Handles temperature condition key behavior in the monitoring context.
     *
     * @param {*} temperature
     * @param {*} settings
     * @returns {string}
     */
    function temperatureConditionKey(temperature, settings) {
        if (temperature > settings.maximumTemperature) return 'high-temperature';
        if (temperature < settings.minimumTemperature) return 'low-temperature';
        return null;
    }

    /**
     * Handles thermal severity behavior in the monitoring context.
     *
     * @param {*} temperature
     * @param {*} settings
     * @returns {*}
     */
    function thermalSeverity(temperature, settings) {
        const upperDelta = temperature - settings.maximumTemperature;
        const lowerDelta = settings.minimumTemperature - temperature;
        const deviation = Math.max(upperDelta, lowerDelta);
        return deviation >= 2 ? 'critical' : 'warning';
    }

    /**
     * Handles humidity severity behavior in the monitoring context.
     *
     * @param {*} humidity
     * @param {*} settings
     * @returns {*}
     */
    function humiditySeverity(humidity, settings) {
        return humidity - settings.maximumHumidity >= 5 ? 'critical' : 'warning';
    }

    /**
     * Determines whether newer reading is true.
     *
     * @param {*} current
     * @param {*} previous
     * @returns {boolean}
     */
    function isNewerReading(current, previous) {
        return new Date(current.recordedAt).getTime() > new Date(previous.recordedAt).getTime();
    }

    /**
     * Determines whether calibration issue exists.
     *
     * @param {*} iotDevice
     * @returns {boolean}
     */
    function hasCalibrationIssue(iotDevice) {
        return iotDevice.calibrationStatus && iotDevice.calibrationStatus !== CalibrationStatus.Compliant;
    }

    return {
        readings,
        offlineReadings,
        incidents,
        maintenanceSchedules,
        technicalServiceRequests,
        errors,
        loading,
        readingsLoaded,
        incidentsLoaded,
        maintenanceSchedulesLoaded,
        technicalServiceRequestsLoaded,
        totalAssets,
        assetsWithAlerts,
        outOfRangeReadings,
        pendingCount,
        syncedCount,
        failedCount,
        fetchReadings,
        fetchIncidents,
        fetchMaintenanceSchedules,
        fetchTechnicalServiceRequests,
        fetchMonitoringData,
        createSensorReading,
        getLatestTemperatureByAsset,
        getLatestHumidityByAsset,
        getReadingsByAsset,
        readingsForAssetIds,
        recentReadingsForAssetIds,
        readingsForAssetIdsSince,
        outOfRangeCountForAssetIds,
        thermalComplianceForAssetIds,
        syncReading,
        syncAllPending,
        schedulesForOrganization,
        technicalServicesForOrganization,
        incidentsForOrganization,
        syncGeneratedIncidentsForOrganization,
        updateOrganizationTelemetry,
        hasCalibrationIssue,
    };
});

export default useMonitoringStore;
